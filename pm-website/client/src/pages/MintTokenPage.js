import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useContract } from '../hooks/useContract';
import { useMetaMask } from '../hooks/useMetaMask';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import NumbersRoundedIcon from '@mui/icons-material/NumbersRounded';
import TokenRoundedIcon from '@mui/icons-material/TokenRounded';

export default function MintTokenPage({ tokenListRef }) {
  const { staticContract, signerContract } = useContract();
  const { account } = useMetaMask();
  const [mintRecipient, setMintRecipient] = useState('');
  const [mintTokenName, setMintTokenName] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const [allTokenNames, setAllTokenNames] = useState([]);
  const [result, setResult] = useState(null);

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
        try { names.push(await staticContract.tokenName(id)); }
        catch { names.push(`Token #${id}`); }
      }
      setAllTokenNames(names);
    } catch { setAllTokenNames([]); }
  };

  useEffect(() => {
    fetchTokenNames();
    // Fetch again whenever the read contract instance changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticContract]);

  const mintToken = async () => {
    setResult(null);
    if (!signerContract || !account) {
      setResult({ severity: 'warning', message: 'Connect your wallet before minting a token.' });
      return;
    }
    setIsMinting(true);
    try {
      const tx = await signerContract.mintToken(mintRecipient, mintAmount, '0x', mintTokenName);
      setResult({ severity: 'info', message: 'Transaction submitted. Waiting for network confirmation…', hash: tx.hash });
      const provider = signerContract.runner.provider;
      let startTime;
      const pendingPromise = new Promise(resolve => {
        const onPending = hash => {
          if (hash === tx.hash) {
            startTime = Date.now();
            provider.off('pending', onPending);
            resolve();
          }
        };
        provider.on('pending', onPending);
        setTimeout(() => {
          if (!startTime) {
            startTime = Date.now();
            provider.off('pending', onPending);
            resolve();
          }
        }, 2000);
      });
      await pendingPromise;
      const receipt = await tx.wait();
      const runtime = ((Date.now() - startTime) / 1000).toFixed(3);
      let gas_fee = 0;
      if (receipt?.gasUsed && receipt?.gasPrice) {
        gas_fee = ethers.formatEther(BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice));
      }
      try {
        await fetch('http://localhost:5010/api/logTx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation_name: 'mint_token', tx_hash: tx.hash, runtime, gas_fee })
        });
      } catch (err) { console.error('Failed to log tx:', err); }

      setResult({ severity: 'success', message: `${mintTokenName} was minted successfully.`, hash: tx.hash });
      if (tokenListRef?.current) {
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
                if (typeof tokenListRef.current.hasToken === 'function') tokenExists = await tokenListRef.current.hasToken(mintedTokenId);
                break;
              }
            } catch {}
          }
        }
        if (mintedTokenId) {
          if (tokenExists && typeof tokenListRef.current.refreshTokenBalance === 'function') await tokenListRef.current.refreshTokenBalance(mintedTokenId);
          else if (!tokenExists && typeof tokenListRef.current.addNewToken === 'function') await tokenListRef.current.addNewToken(mintedTokenId);
        } else if (typeof tokenListRef.current.refreshTokens === 'function') {
          tokenListRef.current.refreshTokens();
        }
      }
      await fetchTokenNames();
    } catch (err) {
      setResult({ severity: 'error', message: `Mint failed: ${err.reason || err.message}` });
    } finally { setIsMinting(false); }
  };

  const addressError = mintRecipient && !ethers.isAddress(mintRecipient);

  return (
    <Box sx={{ maxWidth: 1050, mx: 'auto' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.45fr) minmax(280px, .7fr)' }, gap: 2.5, alignItems: 'start' }}>
        <Paper sx={{ p: { xs: 2.5, sm: 4 }, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={3.5}>
            <Box sx={{ width: 48, height: 48, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'rgba(91,79,233,.09)', color: 'primary.main' }}><AddCircleRoundedIcon /></Box>
            <Box>
              <Typography variant="h3">Token issuance</Typography>
              <Typography variant="body2" color="text.secondary">Create a new token type or issue more of an existing one.</Typography>
            </Box>
          </Stack>

          {!account && <Alert severity="warning" sx={{ mb: 3 }}>Connect MetaMask from the top bar to enable minting.</Alert>}
          {result && <Alert severity={result.severity} sx={{ mb: 3 }}>{result.message}</Alert>}

          <Stack spacing={2.5}>
            <TextField
              label="Recipient wallet"
              placeholder="0x…"
              value={mintRecipient}
              onChange={event => setMintRecipient(event.target.value.trim())}
              error={Boolean(addressError)}
              helperText={addressError ? 'Enter a valid Ethereum address.' : 'The wallet that will receive the minted balance.'}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><AccountBalanceWalletRoundedIcon fontSize="small" color="action" /></InputAdornment> }}
            />
            <Autocomplete
              freeSolo
              options={allTokenNames}
              value={mintTokenName}
              onChange={(event, newValue) => setMintTokenName(newValue || '')}
              onInputChange={(event, newInputValue) => setMintTokenName(newInputValue)}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Token name"
                  placeholder="Select an existing token or enter a new name"
                  helperText="Matching an existing name issues additional units of that token."
                  InputProps={{ ...params.InputProps, startAdornment: <InputAdornment position="start"><TokenRoundedIcon fontSize="small" color="action" /></InputAdornment> }}
                />
              )}
            />
            <TextField
              label="Amount"
              type="number"
              value={mintAmount}
              onChange={event => setMintAmount(event.target.value)}
              inputProps={{ min: 1 }}
              helperText="Enter the whole-token quantity to issue."
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><NumbersRoundedIcon fontSize="small" color="action" /></InputAdornment> }}
            />
          </Stack>
          <Divider sx={{ my: 3.5 }} />
          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={2}>
            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 430 }}>Your wallet will ask you to review gas fees and approve the transaction.</Typography>
            <Button
              variant="contained"
              onClick={mintToken}
              disabled={isMinting || !account || !mintRecipient || !mintTokenName || !mintAmount || Boolean(addressError)}
              startIcon={isMinting ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeRoundedIcon />}
              sx={{ minWidth: 150 }}
            >
              {isMinting ? 'Minting…' : 'Mint token'}
            </Button>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3, borderRadius: 4, color: 'white', background: 'linear-gradient(150deg, #1F1B55 0%, #4238B5 100%)', position: 'relative', overflow: 'hidden' }}>
          <Box sx={{ position: 'absolute', width: 170, height: 170, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.06)', right: -55, top: -55 }} />
          <AutoAwesomeRoundedIcon sx={{ mb: 4, opacity: .85 }} />
          <Typography variant="h3" color="inherit">Issuance preview</Typography>
          <Typography sx={{ opacity: .7, mt: .7, mb: 3 }} variant="body2">Review the essential details before requesting a wallet signature.</Typography>
          <Stack spacing={2}>
            <Box><Typography variant="caption" sx={{ opacity: .65 }}>Token</Typography><Typography fontWeight={750}>{mintTokenName || 'Not selected'}</Typography></Box>
            <Box><Typography variant="caption" sx={{ opacity: .65 }}>Amount</Typography><Typography fontWeight={750}>{mintAmount || '—'} units</Typography></Box>
            <Box><Typography variant="caption" sx={{ opacity: .65 }}>Recipient</Typography><Typography fontFamily="monospace" variant="body2" sx={{ overflowWrap: 'anywhere' }}>{mintRecipient || 'No wallet entered'}</Typography></Box>
          </Stack>
          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,.14)' }} />
          <Typography variant="caption" sx={{ opacity: .7 }}>Testing environment</Typography>
          <Typography variant="body2" mt={.5} lineHeight={1.55}>Anyone can mint in this thesis deployment. Production permissions can be restricted by contract roles.</Typography>
        </Paper>
      </Box>
    </Box>
  );
}
