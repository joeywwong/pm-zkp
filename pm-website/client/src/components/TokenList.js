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
  CardActions,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Link,
  Stack,
  Divider,
  Modal,
  Grow,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

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

  // Expose refreshTokens via ref
  async function loadTokens() {
    if (!staticContract || !account) return;
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
          const [scIds, scArr] = await staticContract.getSpendingConditions(id, account);
          // Fetch roles for each spending condition
          const roles = [];
          for (let i = 0; i < scIds.length; i++) {
            const role = await staticContract.tokenID_requestSetter_proofRequest_role(id, account, scIds[i]);
            roles.push(role);
          }
          scs[id] = scIds.map((scId, idx) => {
            const cond = scArr[idx];
            // Support both named and indexed struct return
            const attribute = cond.attribute || cond[0] || '';
            const operatorStr = cond.operatorStr || cond[1] || '';
            const value = cond.value || cond[2] || '';
            const role = roles[idx] || '';
            return {
              proofRequestId: scId,
              attribute,
              operatorStr,
              value,
              role
            };
          });
        } catch {
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
    if (!staticContract || !account) return;
    try {
      const [scIds, scArr] = await staticContract.getSpendingConditions(tokenId, account);
      // Fetch roles for each spending condition
      const roles = [];
      for (let i = 0; i < scIds.length; i++) {
        const role = await staticContract.tokenID_requestSetter_proofRequest_role(tokenId, account, scIds[i]);
        roles.push(role);
      }
      const updated = scIds.map((scId, idx) => {
        const c = scArr[idx];
        const attribute = c.attribute || c[0] || '';
        const operatorStr = c.operatorStr || c[1] || '';
        const value = c.value || c[2] || '';
        const role = roles[idx] || '';
        return {
          proofRequestId: scId,
          attribute,
          operatorStr,
          value,
          role
        };
      });
      setSpendingConditions(prev => ({ ...prev, [tokenId]: updated }));
    } catch {}
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
      let scArr = [];
      try {
        const [scIds, scStructArr] = await staticContract.getSpendingConditions(tokenId);
        // Fetch roles for each spending condition
        const roles = [];
        for (let i = 0; i < scIds.length; i++) {
          const role = await staticContract.tokenID_requestSetter_proofRequest_role(tokenId, account, scIds[i]);
          roles.push(role);
        }
        scArr = scIds.map((scId, idx) => {
          const c = scStructArr[idx];
          const attribute = c.attribute || c[0] || '';
          const operatorStr = c.operatorStr || c[1] || '';
          const value = c.value || c[2] || '';
          const role = roles[idx] || '';
          return {
            proofRequestId: scId,
            attribute,
            operatorStr,
            value,
            role
          };
        });
      } catch {}
      // Append to state arrays
      setTokenIds(prev => prev.includes(tokenId) ? prev : [...prev, tokenId]);
      setBalances(prev => {
        if (tokenIds.includes(tokenId)) return prev;
        return [...prev, bal.toString()];
      });
      setTokenNames(prev => ({ ...prev, [tokenId]: name }));
      setSpendingConditions(prev => ({ ...prev, [tokenId]: scArr }));
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
  }, [staticContract, account]);

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
    let txStartTime = null;
    let txHash = null;
    let minedTime = null;
    let gasFee = null;
    try {
      // --- Fetch only current user's spending conditions ---
      const [scIds, scArr] = await staticContract.getSpendingConditions(id, account);
      const proofPairs = [];
      for (let i = 0; i < scIds.length; i++) {
        const role = await staticContract.tokenID_requestSetter_proofRequest_role(id, account, scIds[i]);
        if (role === 'sender' || role === 'receiver') {
          proofPairs.push({ requestId: scIds[i].toString(), role });
        }
      }

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
      <Box sx={{ flexGrow: 1, mt: 2, minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h5" gutterBottom align="center" sx={{ mt: 0 }}>
          List of Programmable Money
        </Typography>
        <Typography variant="body1" align="center" color="text.secondary" sx={{ mt: 2 }}>
          Connect MetaMask to show your programmable money
        </Typography>
      </Box>
    );
  }
  if (loading) {
    return (
      <Box sx={{ flexGrow: 1, mt: 2, minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h5" gutterBottom align="center" sx={{ mt: 0 }}>
          List of Programmable Money
        </Typography>
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      </Box>
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
  };

  return (
    <>
      <Box sx={{ flexGrow: 1, mt: 2 }}>
        <Typography variant="h5" gutterBottom align="center">
          List of Programmable Money
        </Typography>
        <Grid container spacing={3} justifyContent="flex-start">
          {tokenIds.map(id => (
            <Grid item key={id}>
              <Card elevation={3} sx={{ width: 320, height: '100%', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                onClick={() => setSelectedTokenId(id)}>
                <CardContent sx={{ flexGrow: 1, minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <Typography variant="h6" gutterBottom>
                    {tokenNames[id] || 'Unnamed Token'}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Balance: <b>{balances[tokenIds.indexOf(id)] || '0'}</b>
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Modal for enlarged card */}
      <Modal
        open={!!selectedTokenId}
        onClose={() => setSelectedTokenId(null)}
        closeAfterTransition
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Grow in={!!selectedTokenId} timeout={300}>
          <Box sx={{ outline: 'none', width: '100vw', height: '100vh', p: 0, m: 0 }}>
            {selectedTokenId && (
              <Card
                elevation={6}
                sx={{
                  width: '100vw',
                  height: '100vh',
                  borderRadius: 0,
                  p: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Header row: close button and token name, blue background */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    bgcolor: 'primary.main', // Use theme's primary blue
                    color: 'primary.contrastText',
                    minHeight: 64,
                    px: 2,
                    py: 1,
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                  }}
                >
                  <IconButton
                    aria-label="close"
                    onClick={() => setSelectedTokenId(null)}
                    sx={{
                      color: 'primary.contrastText',
                      mr: 2,
                      background: 'transparent',
                      '&:hover': { background: 'rgba(255,255,255,0.1)' }
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                  <Typography variant="h5" component="div" sx={{ fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tokenNames[selectedTokenId] || 'Unnamed Token'}
                  </Typography>
                </Box>
                <CardContent
                  sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'row',
                    minHeight: 0,
                    overflow: 'hidden',
                    maxHeight: '100vh',
                    p: 4,
                    gap: 4
                  }}
                >
                  {/* Left column: token details and actions */}
                  <Box sx={{ flex: '0 0 370px', maxWidth: 400, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Token #{selectedTokenId}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      Balance: <b>{balances[tokenIds.indexOf(selectedTokenId)] || '0'}</b>
                    </Typography>
                    <Box sx={{ mb: 1, flexGrow: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                      {spendingConditions[selectedTokenId] && spendingConditions[selectedTokenId].length > 0 ? (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                            <Typography variant="body2" sx={{ mr: 2, mt: 0.5 }}>Spending Conditions:</Typography>
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
                  <Box key={cond.proofRequestId.toString()} sx={{ display: 'flex', alignItems: 'center', bgcolor: 'grey.100', borderRadius: 2, px: 2, py: 0.5, boxShadow: 1 }}>
                    <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
                      {proverRole} {cond.attribute} {opLabel} {cond.value}
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      sx={{
                        bgcolor: 'error.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'error.dark' },
                        fontWeight: 600,
                        px: 1.5,
                        py: 0.2,
                        borderRadius: 2,
                        width: 90,
                        minWidth: 90,
                        maxWidth: 90,
                        ml: 1
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
                            const [scIds, scArr] = await staticContract.getSpendingConditions(selectedTokenId, account);
                            const roles = [];
                            for (let i = 0; i < scIds.length; i++) {
                              const role = await staticContract.tokenID_requestSetter_proofRequest_role(selectedTokenId, account, scIds[i]);
                              roles.push(role);
                            }
                            const updated = scIds.map((scId, idx) => {
                              const c = scArr[idx];
                              const attribute = c.attribute || c[0] || '';
                              const operatorStr = c.operatorStr || c[1] || '';
                              const value = c.value || c[2] || '';
                              const role = roles[idx] || '';
                              return {
                                proofRequestId: scId,
                                attribute,
                                operatorStr,
                                value,
                                role
                              };
                            });
                            setSpendingConditions(prev => ({ ...prev, [selectedTokenId]: updated }));
                          } catch {}
                        } catch (err) {
                          alert('Failed to remove spending condition: ' + (err.reason || err.message));
                        } finally {
                          setRemoving(prev => ({ ...prev, [cond.proofRequestId]: false }));
                        }
                      }}
                      startIcon={removing[cond.proofRequestId] && <CircularProgress size={18} />}
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
                    <Stack spacing={1.5} sx={{ mb: 1 }}>
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
                  </Box>
                  {/* Right column: proof statuses */}
                  <Box sx={{ flex: 1, minWidth: 0, maxWidth: '100%', overflowY: 'auto', pl: 4, display: 'flex', flexDirection: 'column' }}>
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
                      <Accordion defaultExpanded sx={{ mt: 0, mb: 2 }}>
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
                                <Typography variant="caption" display="block" sx={{ color: ps.isVerified ? 'success.main' : 'error.main', fontWeight: 600 }}>
                                  Verified: {ps.isVerified ? 'Yes' : 'No'}
                                </Typography>
                                {!ps.isVerified && ps.url && (
                                  <Typography variant="caption" display="block">
                                    URL:{' '}
                                    <Link href={ps.url} target="_blank" rel="noopener noreferrer">
                                      {ps.url}
                                    </Link>
                                  </Typography>
                                )}
                              </Box>
                            );
                          })}
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </Box>
                </CardContent>
                <CardActions sx={{ p: 3 }}>
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
                    startIcon={transferring[selectedTokenId] && <CircularProgress size={18} />}
                  >
                    {transferring[selectedTokenId] ? 'Transferring...' : 'Transfer'}
                  </Button>
                </CardActions>
              </Card>
            )}
          </Box>
        </Grow>
      </Modal>
    </>
  );
});

export default TokenList;