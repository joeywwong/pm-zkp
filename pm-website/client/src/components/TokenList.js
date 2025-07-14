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
} from '@mui/material';

const TokenList = forwardRef((props, ref) => {
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const { staticContract, signerContract, verifierContract } = useContract();
  const { account } = useMetaMask();
  const [tokenIds, setTokenIds] = useState([]);
  const [balances, setBalances] = useState([]);
  const [recipients, setRecipients] = useState({});
  const [amounts, setAmounts] = useState({});
  const [errors, setErrors] = useState({});
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
          const [scIds, scArr] = await staticContract.getSpendingConditions(id);
          // Fetch roles for each spending condition
          const roles = [];
          for (let i = 0; i < scIds.length; i++) {
            const role = await staticContract.tokenID_proofRequest_role(id, scIds[i]);
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
    if (!staticContract) return;
    try {
      const [scIds, scArr] = await staticContract.getSpendingConditions(tokenId);
      // Fetch roles for each spending condition
      const roles = [];
      for (let i = 0; i < scIds.length; i++) {
        const role = await staticContract.tokenID_proofRequest_role(tokenId, scIds[i]);
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
          const role = await staticContract.tokenID_proofRequest_role(tokenId, scIds[i]);
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
      // --- Fetch all proofRequestIDs ---
      const proofIds = [];
      let idx = 0;
      while (true) {
        try {
          const pid = await staticContract.proofRequestIDs(idx);
          proofIds.push(pid);
          idx++;
        } catch {
          break;
        }
      }

      // --- Build pairs and filter zero address ---
      const proofPairs = [];
      for (const pid of proofIds) {
        const role = await staticContract.tokenID_proofRequest_role(id, pid);
        if (role === 'sender' || role === 'receiver') {
          proofPairs.push({ requestId: pid.toString(), role });
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
        await fetch('http://localhost:5000/api/logTx', {
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
    } catch (err) {
      // If any proof is not verified, show spending condition error
      if (proofNotVerified) {
        setErrors(prev => ({ ...prev, [id]: 'Spending condition not verified.' }));
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
          <Box sx={{ outline: 'none' }}>
            {selectedTokenId && (
              <Card elevation={6} sx={{ width: 420, maxWidth: '90vw', minHeight: 420, p: 2, display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h5" gutterBottom>
                    {tokenNames[selectedTokenId] || 'Unnamed Token'}
                  </Typography>
                  <Typography variant="subtitle1" gutterBottom>
                    Token #{selectedTokenId}
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    Balance: <b>{balances[tokenIds.indexOf(selectedTokenId)] || '0'}</b>
                  </Typography>
                  <Box sx={{ mb: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                    {spendingConditions[selectedTokenId] && spendingConditions[selectedTokenId].length > 0 ? (
                      <>
                        <Typography variant="body2" sx={{ mb: 2 }}>Spending Conditions:</Typography>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {spendingConditions[selectedTokenId].map((cond, idx) => {
                            // ...existing code for rendering conditions and remove button...
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
                              <li key={cond.proofRequestId.toString()} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <Typography variant="body2" sx={{ mb: 0 }}>
                                    Proof request ID: {cond.proofRequestId.toString()}
                                  </Typography>
                                  <Typography variant="body2" sx={{ mb: 0 }}>
                                    {proverRole} {cond.attribute} {opLabel} {cond.value}
                                  </Typography>
                                </div>
                                <Button
                                  variant="outlined"
                                  color="error"
                                  size="small"
                                  sx={{ ml: 2 }}
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
                                      // Only admin can remove
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
                                        await fetch('http://localhost:5000/api/logTx', {
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
                                        const [scIds, scArr] = await staticContract.getSpendingConditions(selectedTokenId);
                                        const roles = [];
                                        for (let i = 0; i < scIds.length; i++) {
                                          const role = await staticContract.tokenID_proofRequest_role(selectedTokenId, scIds[i]);
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
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
                        No spending conditions set for this token.
                      </Typography>
                    )}
                  </Box>
                  <Stack spacing={2}>
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
                  {errors[selectedTokenId] && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {errors[selectedTokenId]}
                    </Alert>
                  )}
                  {proofStatuses[selectedTokenId] && (
                    <Box mt={2}>
                      <Divider sx={{ mb: 1 }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Proof Statuses:
                      </Typography>
                      {proofStatuses[selectedTokenId].map(ps => (
                        <Box key={`${ps.role}-${ps.requestId}`} sx={{ mb: 1, pl: 1 }}>
                          <Typography variant="caption" display="block">
                            Prover: {ps.role === 'sender' ? 'money sender' : ps.role === 'receiver' ? 'money receiver' : ps.role}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Request ID: {ps.requestId}
                          </Typography>
                          <Typography variant="caption" display="block">
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
                      ))}
                    </Box>
                  )}
                </CardContent>
                <CardActions>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={e => { e.stopPropagation(); handleTransfer(selectedTokenId); }}
                    disabled={transferring[selectedTokenId]}
                    startIcon={transferring[selectedTokenId] && <CircularProgress size={18} />}
                  >
                    {transferring[selectedTokenId] ? 'Transferring...' : 'Transfer'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    fullWidth
                    onClick={() => setSelectedTokenId(null)}
                  >
                    Close
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