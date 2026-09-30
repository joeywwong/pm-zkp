import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useContract } from '../hooks/useContract';
import { useMetaMask } from '../hooks/useMetaMask';
import { ethers } from 'ethers'; // using ethers.ZeroAddress
import getUrlFromZkpRequest from '../utils/configUniversalLink';

// Material UI imports
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Link,
  Stack,
  Divider,
  Drawer,
  Chip,
  LinearProgress,
  Paper,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import TokenRoundedIcon from '@mui/icons-material/TokenRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';

const TokenList = forwardRef((props, ref) => {
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const { staticContract, signerContract, verifierContract } = useContract();
  const { account } = useMetaMask();
  const [tokenIds, setTokenIds] = useState([]);
  const [balances, setBalances] = useState([]);
  const [recipients, setRecipients] = useState({});
  const [amounts, setAmounts] = useState({});
  const [errors, setErrors] = useState({});
  const [successes, setSuccesses] = useState({});
  const [proofStatuses, setProofStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState({});
  const [removing, setRemoving] = useState({});
  const [tokenNames, setTokenNames] = useState({});
  const [spendingConditions, setSpendingConditions] = useState({});

  const readSpendingConditions = async (tokenId) => {
    if (!signerContract || !account) {
      throw new Error('Connect the wallet before loading spending conditions.');
    }

    // This view is access-controlled by msg.sender, so it must use the
    // wallet-backed contract even though it does not create a transaction.
    const [scIds, scArr] = await signerContract.getSpendingConditions(tokenId, account);

    return Promise.all(scIds.map(async (scId, idx) => {
      const condition = scArr[idx];
      let role = '';

      // Some deployed PMNoAdmin versions keep the role mapping private and do
      // not expose this getter. A missing role must not hide the condition.
      try {
        role = await signerContract.tokenID_requestSetter_proofRequest_role(tokenId, account, scId);
      } catch (err) {
        console.warn('Spending-condition role is unavailable on the deployed contract:', err);
      }

      return {
        proofRequestId: scId,
        attribute: condition.attribute || condition[0] || '',
        operatorStr: condition.operatorStr || condition[1] || '',
        value: condition.value || condition[2] || '',
        role,
      };
    }));
  };

  // Expose refreshTokens via ref
  async function loadTokens() {
    if (!staticContract || !signerContract || !account) return;
    setProofStatuses({});
    setErrors({});
    setLoading(true);
    try {
      // 1. Fetch all token IDs
      const idsBig = await staticContract.allTokenIDs();
      const idsBigArray = [...idsBig];
      const ids = idsBigArray.map(id => id.toString());
      setTokenIds(ids);

      // 2. Fetch balances in batch
      const accountsArray = idsBigArray.map(() => account);
      const balancesBig = await staticContract.balanceOfBatch(accountsArray, idsBigArray);
      setBalances(balancesBig.map(b => b.toString()));

      // 3. Fetch token names in batch
      const names = {};
      for (const id of ids) {
        names[id] = await staticContract.tokenName(id);
      }
      setTokenNames(names);

      // 4. Fetch spending conditions for each token
      const scs = {};
      for (const id of ids) {
        try {
          scs[id] = await readSpendingConditions(id);
        } catch (err) {
          console.error(`Failed to load spending conditions for token ${id}:`, err);
          scs[id] = [];
        }
      }
      setSpendingConditions(scs);
    } catch (err) {
      console.error('TokenList load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // Expose refreshTokens and per-token refresh methods to parent component
  // This allows parent components to trigger a refresh of the token list or individual tokens
  const refreshTokenSpendingConditions = async (tokenId) => {
    if (!signerContract || !account) return;
    try {
      const updated = await readSpendingConditions(tokenId);
      setSpendingConditions(prev => ({ ...prev, [tokenId]: updated }));
    } catch (err) {
      console.error(`Failed to refresh spending conditions for token ${tokenId}:`, err);
    }
  };

  const refreshTokenBalance = async (tokenId) => {
    if (!staticContract || !account) return;
    try {
      const newBal = await staticContract.balanceOf(account, tokenId);
      setBalances(prev => {
        const idx = tokenIds.indexOf(tokenId);
        if (idx === -1) return prev;
        return prev.map((b, i) => (i === idx ? newBal.toString() : b));
      });
    } catch {}
  };

  // Add a method to append a new token to the list
  const addNewToken = async (tokenId) => {
    if (!staticContract || !account) return;
    try {
      // Fetch balance
      const bal = await staticContract.balanceOf(account, tokenId);
      // Fetch name
      let name = '';
      try {
        name = await staticContract.tokenName(tokenId);
      } catch {}
      // Fetch spending conditions
      let conditions = [];
      try {
        conditions = await readSpendingConditions(tokenId);
      } catch (err) {
        console.error(`Failed to load spending conditions for new token ${tokenId}:`, err);
      }
      // Append to state arrays
      setTokenIds(prev => prev.includes(tokenId) ? prev : [...prev, tokenId]);
      setBalances(prev => {
        if (tokenIds.includes(tokenId)) return prev;
        return [...prev, bal.toString()];
      });
      setTokenNames(prev => ({ ...prev, [tokenId]: name }));
      setSpendingConditions(prev => ({ ...prev, [tokenId]: conditions }));
    } catch {}
  };

  useImperativeHandle(ref, () => ({
    refreshTokens: loadTokens,
    refreshTokenSpendingConditions,
    refreshTokenBalance,
    addNewToken,
    hasToken: (tokenId) => tokenIds.includes(tokenId)
  }));

  useEffect(() => {
    loadTokens();
    // Contract/account changes are the refresh boundary for the dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticContract, signerContract, account]);

  const handleRecipientChange = (id, value) => {
    setRecipients(prev => ({ ...prev, [id]: value }));
  };

  const handleAmountChange = (id, value) => {
    setAmounts(prev => ({ ...prev, [id]: value }));
  };

  const handleTransfer = async (id) => {
    // Clear previous warning/error for this token
    setErrors(prev => ({ ...prev, [id]: null }));
    setSuccesses(prev => ({ ...prev, [id]: null }));
    if (!signerContract || !account) {
      setErrors(prev => ({ ...prev, [id]: 'Connect wallet first' }));
      return;
    }
    setTransferring(prev => ({ ...prev, [id]: true }));
    let proofNotVerified = false;
    try {
      // --- Fetch only current user's spending conditions ---
      const conditions = await readSpendingConditions(id);
      setSpendingConditions(prev => ({ ...prev, [id]: conditions }));

      if (conditions.some(condition => condition.role !== 'sender' && condition.role !== 'receiver')) {
        setErrors(prev => ({
          ...prev,
          [id]: 'The deployed contract does not expose the prover role for this spending condition. Redeploy PMNoAdmin with a role getter before transferring this token.',
        }));
        return;
      }
      const proofPairs = conditions.map(condition => ({
        requestId: condition.proofRequestId.toString(),
        role: condition.role,
      }));

      // --- Call getProofStatus, getZKPRequest, and fetch URL for failures ---
      const statuses = proofPairs.map(pair => ({ ...pair, isVerified: false, zkpRequest: null, url: null }));
      for (let i = 0; i < proofPairs.length; i++) {
        const { role, requestId } = proofPairs[i];
        let prover = null;
        if (role === 'sender') {
          prover = account;
        } else if (role === 'receiver') {
          prover = recipients[id] || '';
        }
        // fetch proof verification status
        const statusData = await verifierContract.getProofStatus(prover, requestId);
        statuses[i].isVerified = statusData.isVerified;
        // fetch ZKP request tuple and extract first element
        const [zkpRequest] = await verifierContract.getZKPRequest(requestId);
        statuses[i].zkpRequest = zkpRequest;
        // if not verified, get URL from helper
        if (!statuses[i].isVerified) {
          statuses[i].url = await getUrlFromZkpRequest(zkpRequest);
          proofNotVerified = true;
        }
      }
      setProofStatuses(prev => ({ ...prev, [id]: statuses }));

      // --- Proceed with ERC-1155 safeTransferFrom ---
      const recipient = recipients[id] || '';
      const amount = amounts[id] || '0';
      const provider = signerContract.runner?.provider || signerContract.provider;
      let startTime;
      let txHash;
      const tx = await signerContract.safeTransferFrom(
        account,
        recipient,
        id,
        amount,
        '0x'
      );
      txHash = tx.hash;
      const pendingPromise = new Promise(resolve => {
        const onPending = hash => {
          if (hash === txHash) {
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
      const endTime = Date.now();
      const runtime = ((endTime - startTime) / 1000).toFixed(3);
      let gas_fee = 0;
      if (receipt && receipt.gasUsed) {
        // Try to use receipt.effectiveGasPrice first.
        // If not available, fallback to receipt.gasPrice.
        // Testnet may not have effectiveGasPrice.
        const gasPrice = receipt.effectiveGasPrice ?? receipt.gasPrice;
        if (gasPrice) {
          gas_fee = ethers.formatEther(BigInt(receipt.gasUsed) * BigInt(gasPrice));
        }
      }
      // Logging to backend
      try {
        await fetch('http://localhost:5010/api/logTx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation_name: 'transfer_token',
            tx_hash: txHash,
            runtime,
            gas_fee
          })
        });
      } catch (e) {
        // Ignore logging errors
      }

      // Refresh this token's balance
      const newBal = await staticContract.balanceOf(account, id);
      setBalances(prev =>
        prev.map((b, i) => (tokenIds[i] === id ? newBal.toString() : b))
      );
      setErrors(prev => ({ ...prev, [id]: null }));
      setSuccesses(prev => ({ ...prev, [id]: 'Transfer successful.' }));
    } catch (err) {
      // If any proof is not verified, show spending condition error
      if (proofNotVerified) {
        setErrors(prev => ({
          ...prev,
          [id]: "Transfer failed: Submit proof for all spending conditions below (see 'Spending condition status' for details/links). After submitting, try transferring again."
        }));
      } else {
        // Otherwise, show short error message
        const msg = err.reason || err.errorArgs?.[1] || err.message;
        setErrors(prev => ({ ...prev, [id]: msg ? String(msg).split('\n')[0] : 'Transfer failed.' }));
      }
    } finally {
      setTransferring(prev => ({ ...prev, [id]: false }));
    }
  };

  if (!account) {
    return (
      <Paper sx={{ minHeight: 420, display: 'grid', placeItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 4, px: 3 }}>
        <Stack alignItems="center" spacing={2} sx={{ maxWidth: 440, textAlign: 'center' }}>
          <Box sx={theme => ({ width: 64, height: 64, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.09), color: 'primary.main' })}>
            <AccountBalanceWalletRoundedIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h3">Connect your wallet</Typography>
            <Typography color="text.secondary" mt={1} lineHeight={1.65}>
              Use the wallet control above to view balances, manage spending conditions, and transfer programmable tokens.
            </Typography>
          </Box>
          <Chip label="MetaMask required" variant="outlined" size="small" />
        </Stack>
      </Paper>
    );
  }
  if (loading) {
    return (
      <Paper sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
        <LinearProgress />
        <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ minHeight: 360, p: 3 }}>
          <CircularProgress size={34} thickness={4} />
          <Typography variant="h4">Loading programmable assets</Typography>
          <Typography color="text.secondary">Reading token balances and proof policies from the network…</Typography>
        </Stack>
      </Paper>
    );
  }

  // Operator translation map
  const operatorLabelMap = {
    '$eq': 'is equal to',
    '$ne': 'is not equal to',
    '$in': 'matches one of the values',
    '$nin': 'matches none of the values',
    '$lt': 'is less than',
    '$gt': 'is greater than',
    '$gte': 'is greater than or equal to',
    '$lte': 'is less than or equal to',
  };

  const totalBalance = balances.reduce((sum, balance) => {
    try { return sum + BigInt(balance || 0); } catch { return sum; }
  }, 0n).toString();
  const conditionCount = Object.values(spendingConditions).reduce((sum, conditions) => sum + conditions.length, 0);

  return (
    <>
      <Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) repeat(2, minmax(190px, .55fr))' },
            gap: 2,
            mb: 3,
          }}
        >
          <Paper sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 4, color: 'white', background: 'linear-gradient(125deg, #282268 0%, #5B4FE9 62%, #7770F4 100%)', position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.07)', right: -45, top: -70 }} />
            <Typography variant="overline" sx={{ opacity: .78, letterSpacing: '.12em', fontWeight: 800 }}>Portfolio balance</Typography>
            <Stack direction="row" alignItems="baseline" spacing={1} mt={0.5}>
              <Typography variant="h1" sx={{ color: 'inherit' }}>{totalBalance}</Typography>
              <Typography sx={{ opacity: .78, fontWeight: 700 }}>units</Typography>
            </Stack>
            <Typography variant="body2" sx={{ opacity: .74, mt: 1 }}>Across every programmable token held by this wallet</Typography>
          </Paper>
          <Paper sx={{ p: 2.5, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={theme => ({ width: 42, height: 42, borderRadius: 2.5, bgcolor: alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.16 : 0.1), color: 'secondary.main', display: 'grid', placeItems: 'center', mb: 2 })}><TokenRoundedIcon /></Box>
            <Typography variant="h2">{tokenIds.length}</Typography>
            <Typography color="text.secondary" variant="body2">Token types</Typography>
          </Paper>
          <Paper sx={{ p: 2.5, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={theme => ({ width: 42, height: 42, borderRadius: 2.5, bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.09), color: 'primary.main', display: 'grid', placeItems: 'center', mb: 2 })}><VerifiedUserRoundedIcon /></Box>
            <Typography variant="h2">{conditionCount}</Typography>
            <Typography color="text.secondary" variant="body2">Active conditions</Typography>
          </Paper>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} mb={2}>
          <Box>
            <Typography variant="h3">Your tokens</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.4}>Select an asset to inspect its policy or start a transfer.</Typography>
          </Box>
          <Chip label={`${tokenIds.length} ${tokenIds.length === 1 ? 'asset' : 'assets'}`} size="small" variant="outlined" />
        </Stack>

        {tokenIds.length === 0 ? (
          <Paper sx={{ py: 7, px: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 4 }}>
            <TokenRoundedIcon sx={{ fontSize: 38, color: 'text.secondary', mb: 1 }} />
            <Typography variant="h4">No tokens found</Typography>
            <Typography color="text.secondary" mt={0.7}>Mint a token to begin building a programmable asset policy.</Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 2 }}>
          {tokenIds.map(id => (
            <Card
              key={id}
              component="button"
              onClick={() => setSelectedTokenId(id)}
              sx={theme => ({
                width: '100%', minHeight: 190, p: 0, textAlign: 'left', cursor: 'pointer', bgcolor: 'background.paper',
                transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
                '&:hover': { transform: 'translateY(-3px)', borderColor: alpha(theme.palette.primary.main, 0.38), boxShadow: theme.palette.mode === 'dark' ? '0 18px 44px rgba(0,0,0,.3)' : '0 18px 44px rgba(30,39,65,.11)' },
                '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`, outlineOffset: 2 },
              })}
            >
                <CardContent sx={{ width: '100%', p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box sx={theme => ({ width: 46, height: 46, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.09) })}>
                      <TokenRoundedIcon />
                    </Box>
                    <Chip size="small" label={`#${id}`} sx={{ fontFamily: 'monospace' }} />
                  </Stack>
                  <Typography variant="h4" mt={2.5} noWrap>{tokenNames[id] || 'Unnamed Token'}</Typography>
                  <Stack direction="row" alignItems="flex-end" justifyContent="space-between" mt={1.4}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Available balance</Typography>
                      <Typography variant="h3">{balances[tokenIds.indexOf(id)] || '0'}</Typography>
                    </Box>
                    <Tooltip title="Open token details"><ArrowForwardRoundedIcon color="primary" /></Tooltip>
                  </Stack>
                  <Divider sx={{ my: 1.8 }} />
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <LockRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {(spendingConditions[id] || []).length === 0 ? 'No spending conditions' : `${spendingConditions[id].length} spending ${(spendingConditions[id] || []).length === 1 ? 'condition' : 'conditions'}`}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
          ))}
          </Box>
        )}
      </Box>

      <Drawer
        anchor="right"
        open={!!selectedTokenId}
        onClose={() => setSelectedTokenId(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 'min(760px, 92vw)' }, bgcolor: 'background.default' } }}
      >
          <Box sx={{ outline: 'none', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedTokenId && (
              <Box
                sx={{
                  minHeight: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    minHeight: 76,
                    px: { xs: 2, sm: 3 },
                    py: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    position: 'sticky',
                    top: 0,
                    zIndex: 3,
                  }}
                >
                  <IconButton
                    aria-label="close"
                    onClick={() => setSelectedTokenId(null)}
                    sx={{
                      color: 'text.primary',
                      mr: 1.5,
                      bgcolor: 'background.default',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="h4" noWrap>{tokenNames[selectedTokenId] || 'Unnamed Token'}</Typography>
                    <Typography variant="caption" color="text.secondary">Token #{selectedTokenId}</Typography>
                  </Box>
                  <Chip size="small" color="success" variant="outlined" label="On-chain" />
                </Box>
                <CardContent
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(280px, .9fr)' },
                    p: { xs: 2, sm: 3 },
                    gap: 2.5,
                    alignItems: 'start',
                  }}
                >
                  {/* Left column: token details and actions */}
                  <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                    <Paper sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                      <Typography variant="caption" color="text.secondary">Available balance</Typography>
                      <Typography variant="h1" mt={0.5}>{balances[tokenIds.indexOf(selectedTokenId)] || '0'}</Typography>
                      <Typography variant="body2" color="text.secondary">units ready to transfer</Typography>
                    </Paper>
                    <Paper sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                        <LockRoundedIcon color="primary" fontSize="small" />
                        <Typography variant="h4">Spending conditions</Typography>
                      </Stack>
                    <Box sx={{ mb: 1, flexGrow: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                      {spendingConditions[selectedTokenId] && spendingConditions[selectedTokenId].length > 0 ? (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {spendingConditions[selectedTokenId].map((cond, idx) => {
                                let opLabel = cond.operatorStr;
                                if (operatorLabelMap[opLabel]) {
                                  opLabel = operatorLabelMap[opLabel];
                                } else if ((opLabel || '').startsWith('$')) {
                                  opLabel = opLabel.substring(1);
                                } else if (!opLabel) {
                                  opLabel = '';
                                }
                                let proverRole = '';
                                if (cond.role === 'sender') {
                                  proverRole = "Sender's";
                                } else if (cond.role === 'receiver') {
                                  proverRole = "Receiver's";
                                } else {
                                  proverRole = '';
                                }
                return (
                  <Box key={cond.proofRequestId.toString()} sx={{ display: 'flex', alignItems: 'center', width: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 2.5, px: 1.5, py: 1.2, bgcolor: 'background.default' }}>
                    <Typography variant="body2" sx={{ mr: 1, fontWeight: 650, flex: 1 }}>
                      {proverRole} {cond.attribute} {opLabel} {cond.value}
                    </Typography>
                    <Button
                      variant="text"
                      color="error"
                      size="small"
                      sx={{
                        fontWeight: 600,
                        px: 1,
                        minWidth: 'auto',
                        ml: 1,
                      }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!signerContract || !account) {
                          alert('Connect wallet and load contract first');
                          return;
                        }
                        setRemoving(prev => ({ ...prev, [cond.proofRequestId]: true }));
                        let gas_fee = 0;
                        let startTime;
                        let txHash;
                        try {
                          const provider = signerContract.runner?.provider || signerContract.provider;
                          // Remove only user's own spending condition
                          const tx = await signerContract.deleteProofRequestAndRole(selectedTokenId, cond.proofRequestId);
                          txHash = tx.hash;
                          const pendingPromise = new Promise(resolve => {
                            const onPending = hash => {
                              if (hash === txHash) {
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
                          const endTime = Date.now();
                          const runtime = ((endTime - startTime) / 1000).toFixed(3);
                          // Calculate gas fee
                          if (receipt && receipt.gasUsed) {
                            // Try to use receipt.effectiveGasPrice first.
                            // If not available, fallback to receipt.gasPrice.
                            // Testnet may not have effectiveGasPrice.
                            const gasPrice = receipt.effectiveGasPrice ?? receipt.gasPrice;
                            if (gasPrice) {
                              gas_fee = ethers.formatEther(BigInt(receipt.gasUsed) * BigInt(gasPrice));
                            }
                          }
                          // Logging to backend
                          try {
                            await fetch('http://localhost:5010/api/logTx', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                operation_name: 'remove_spending_condition',
                                tx_hash: txHash,
                                runtime,
                                gas_fee
                              })
                            });
                          } catch (e) {
                            // Ignore logging errors
                          }
                          // Refresh spending conditions for this token
                          try {
                            const updated = await readSpendingConditions(selectedTokenId);
                            setSpendingConditions(prev => ({ ...prev, [selectedTokenId]: updated }));
                          } catch (err) {
                            console.error(`Failed to refresh spending conditions for token ${selectedTokenId}:`, err);
                          }
                        } catch (err) {
                          alert('Failed to remove spending condition: ' + (err.reason || err.message));
                        } finally {
                          setRemoving(prev => ({ ...prev, [cond.proofRequestId]: false }));
                        }
                      }}
                      startIcon={removing[cond.proofRequestId] ? <CircularProgress size={16} /> : <DeleteOutlineRoundedIcon fontSize="small" />}
                      disabled={removing[cond.proofRequestId]}
                    >
                      {removing[cond.proofRequestId] ? 'Removing...' : 'Remove'}
                    </Button>
                  </Box>
                                );
                              })}
                            </Box>
                          </Box>
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ mb: 1 }} color="text.secondary">
                          No spending conditions set for this token.
                        </Typography>
                      )}
                    </Box>
                    </Paper>
                    <Paper sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                      <SendRoundedIcon color="primary" fontSize="small" />
                      <Typography variant="h4">Transfer token</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mb={2}>Enter the destination wallet and amount. Proof requirements are checked before execution.</Typography>
                    <Stack spacing={1.5} sx={{ mb: 2 }}>
                      <TextField
                        label="Recipient Address"
                        value={recipients[selectedTokenId] || ''}
                        onChange={e => handleRecipientChange(selectedTokenId, e.target.value)}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        label="Amount"
                        type="number"
                        inputProps={{ min: 0 }}
                        value={amounts[selectedTokenId] || ''}
                        onChange={e => handleAmountChange(selectedTokenId, e.target.value)}
                        size="small"
                        fullWidth
                      />
                    </Stack>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      onClick={e => { e.stopPropagation(); handleTransfer(selectedTokenId); }}
                      disabled={
                        transferring[selectedTokenId] ||
                        !recipients[selectedTokenId] ||
                        !amounts[selectedTokenId]
                      }
                      startIcon={transferring[selectedTokenId] ? <CircularProgress size={18} color="inherit" /> : <SendRoundedIcon />}
                      sx={{ minHeight: 50 }}
                    >
                      {transferring[selectedTokenId] ? 'Verifying & transferring…' : 'Review & transfer'}
                    </Button>
                    </Paper>
                  </Stack>
                  {/* Right column: proof statuses */}
                  <Stack spacing={2} sx={{ minWidth: 0 }}>
                    <Paper sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                        <VerifiedUserRoundedIcon color="primary" fontSize="small" />
                        <Typography variant="h4">Proof readiness</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                        Proof status is evaluated when you initiate the transfer. If a credential is required, a secure wallet link will appear here.
                      </Typography>
                    </Paper>
                    {errors[selectedTokenId] && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {errors[selectedTokenId]}
                      </Alert>
                    )}
                    {successes[selectedTokenId] && !errors[selectedTokenId] && (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        {successes[selectedTokenId]}
                      </Alert>
                    )}
                    {proofStatuses[selectedTokenId] && (
                      <Accordion defaultExpanded disableGutters sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px !important', '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2">Spending condition status</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Divider sx={{ mb: 1 }} />
                          {proofStatuses[selectedTokenId].map(ps => {
                            // Find the matching spending condition for this proof status
                            const cond = (spendingConditions[selectedTokenId] || []).find(c => c.proofRequestId.toString() === ps.requestId.toString());
                            let opLabel = cond && cond.operatorStr;
                            const operatorLabelMap = {
                              '$eq': 'is equal to',
                              '$ne': 'is not equal to',
                              '$in': 'matches one of the values',
                              '$nin': 'matches none of the values',
                              '$lt': 'is less than',
                              '$gt': 'is greater than',
                            };
                            if (opLabel && operatorLabelMap[opLabel]) {
                              opLabel = operatorLabelMap[opLabel];
                            } else if (opLabel && opLabel.startsWith('$')) {
                              opLabel = opLabel.substring(1);
                            } else if (!opLabel) {
                              opLabel = '';
                            }
                            let proverRole = '';
                            if (ps.role === 'sender') {
                              proverRole = "Sender's";
                            } else if (ps.role === 'receiver') {
                              proverRole = "Receiver's";
                            } else {
                              proverRole = ps.role;
                            }
                            return (
                              <Box key={`${ps.role}-${ps.requestId}`} sx={{ mb: 1, pl: 1 }}>
                                <Typography variant="caption" display="block">
                                  Prover: {ps.role === 'sender' ? 'money sender' : ps.role === 'receiver' ? 'money receiver' : ps.role}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Request ID: {ps.requestId}
                                </Typography>
                                {cond && (
                                  <Typography variant="caption" display="block">
                                    Condition: {proverRole} {cond.attribute} {opLabel} {cond.value}
                                  </Typography>
                                )}
                                <Chip size="small" sx={{ mt: 1 }} color={ps.isVerified ? 'success' : 'warning'} label={ps.isVerified ? 'Proof verified' : 'Proof required'} />
                                {!ps.isVerified && ps.url && (
                                  <Typography variant="caption" display="block">
                                    URL:{' '}
                                    <Link href={ps.url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: .5, fontWeight: 700 }}>
                                      Open proof request <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                                    </Link>
                                  </Typography>
                                )}
                              </Box>
                            );
                          })}
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </Stack>
                </CardContent>
              </Box>
            )}
          </Box>
      </Drawer>
    </>
  );
});

export default TokenList;
