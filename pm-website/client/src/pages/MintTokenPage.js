import React, { useState, useEffect } from 'react';
import { useContract } from '../hooks/useContract';
import { useMetaMask } from '../hooks/useMetaMask';
import { ethers } from 'ethers';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Stack,
  Autocomplete,
  CircularProgress,
} from '@mui/material';

export default function MintTokenPage({ tokenListRef }) {
  const { staticContract, signerContract } = useContract();
  const { account } = useMetaMask();

  // Mint Token state
  const [mintRecipient, setMintRecipient] = useState('');
  const [mintTokenName, setMintTokenName] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const [allTokenNames, setAllTokenNames] = useState([]);

  // Fetch all token names for mint dropdown
  const fetchTokenNames = async () => {
    if (!staticContract) {
      setAllTokenNames([]);
      return;
    }
    try {
      const idsBig = await staticContract.allTokenIDs();
      const ids = Array.isArray(idsBig) ? idsBig.map(id => id.toString()) : [];
      const names = [];
      for (const id of ids) {
        try {
          const name = await staticContract.tokenName(id);
          names.push(name);
        } catch {
          names.push(`Token #${id}`);
        }
      }
      setAllTokenNames(names);
    } catch {
      setAllTokenNames([]);
    }
  };

  useEffect(() => {
    fetchTokenNames();
  }, [staticContract]);

  // Mint Token handler
  const mintToken = async () => {
    if (!signerContract || !account) {
      alert('Connect wallet and load contract first');
      return;
    }
    setIsMinting(true);
    try {
      const tx = await signerContract.mintToken(
        mintRecipient,
        mintAmount,
        "0x",
        mintTokenName
      );
      // Start timer at broadcast
      const provider = signerContract.runner.provider;
      let startTime;
      const pendingPromise = new Promise(resolve => {
        const onPending = hash => {
          if (hash === tx.hash) {
            startTime = Date.now();
            provider.off("pending", onPending);
            resolve();
          }
        };
        provider.on("pending", onPending);
        setTimeout(() => {
          if (!startTime) {
            startTime = Date.now();
            provider.off("pending", onPending);
            resolve();
          }
        }, 2000);
      });
      await pendingPromise;
      const receipt = await tx.wait();
      const endTime = Date.now();
      const runtime = ((endTime - startTime) / 1000).toFixed(3);
      let gas_fee = 0;
      if (receipt && receipt.gasUsed && receipt.gasPrice) {
        gas_fee = receipt.gasPrice
          ? ethers.formatEther(BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice))
          : 0;
      }
      // Logging to backend
      try {
        await fetch('http://localhost:5010/api/logTx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation_name: 'mint_token',
            tx_hash: tx.hash,
            runtime,
            gas_fee
          })
        });
      } catch (err) {
        console.error('Failed to log tx:', err);
      }
      alert('Token minted!');
      // Update TokenList if ref available
      if (tokenListRef && tokenListRef.current) {
        let mintedTokenId = null;
        let tokenExists = false;
        if (staticContract) {
          const idsBig = await staticContract.allTokenIDs();
          const ids = Array.isArray(idsBig) ? idsBig.map(id => id.toString()) : [];
          for (const id of ids) {
            try {
              const name = await staticContract.tokenName(id);
              if (name === mintTokenName) {
                mintedTokenId = id;
                if (typeof tokenListRef.current.hasToken === 'function') {
                  tokenExists = await tokenListRef.current.hasToken(mintedTokenId);
                }
                break;
              }
            } catch {}
          }
        }
        if (mintedTokenId) {
          if (tokenExists && typeof tokenListRef.current.refreshTokenBalance === 'function') {
            await tokenListRef.current.refreshTokenBalance(mintedTokenId);
          } else if (!tokenExists && typeof tokenListRef.current.addNewToken === 'function') {
            await tokenListRef.current.addNewToken(mintedTokenId);
          }
        } else {
          if (typeof tokenListRef.current.refreshTokens === 'function') {
            tokenListRef.current.refreshTokens();
          }
        }
      }
      // Refresh token name dropdown
      await fetchTokenNames();
    } catch (err) {
      alert('Mint failed: ' + (err.reason || err.message));
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom align="center">
        Mint Token
      </Typography>
      <Typography variant="body1" sx={{ mb: 3 }} color="text.secondary" align="center">
        For testing purposes, anyone can mint. In production, only the contract owner or specific roles can mint.
      </Typography>
      
      <Stack direction="row" spacing={2} mt={2}>
        <TextField
          label="Recipient Address"
          value={mintRecipient}
          onChange={e => setMintRecipient(e.target.value)}
          size="small"
          sx={{ minWidth: 120, flex: 1 }}
        />
        <Autocomplete
          freeSolo
          options={allTokenNames}
          value={mintTokenName}
          onChange={(e, newValue) => setMintTokenName(newValue || '')}
          onInputChange={(e, newInputValue) => setMintTokenName(newInputValue)}
          renderInput={(params) => {
            const showTriangle = !mintTokenName;
            const showClear = !!mintTokenName;
            return (
              <Box sx={{ position: 'relative', width: '100%' }}>
                <TextField
                  {...params}
                  label="Token Name"
                  size="small"
                  sx={{ minWidth: 420, flex: 3.5 }}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: null,
                    endAdornment: showClear ? params.InputProps.endAdornment : null,
                  }}
                  placeholder="Select from list or enter a new token name"
                />
                {showTriangle && (
                  <Box sx={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}>
                    <svg
                      width={18}
                      height={18}
                      viewBox="0 0 24 24"
                      style={{ color: '#888' }}
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </Box>
                )}
              </Box>
            );
          }}
        />
        <TextField
          label="Amount"
          type="number"
          value={mintAmount}
          onChange={e => setMintAmount(e.target.value)}
          size="small"
          sx={{ minWidth: 80, maxWidth: 120, flex: 0.7 }}
        />
      </Stack>
      <Box mt={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={mintToken}
          disabled={isMinting || !mintRecipient || !mintTokenName || !mintAmount}
          startIcon={isMinting && <CircularProgress size={18} />}
        >
          {isMinting ? 'Minting…' : 'Mint Token'}
        </Button>
      </Box>
    </Paper>
  );
}