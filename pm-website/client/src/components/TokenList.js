import React, { useState, useEffect } from 'react';
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
} from '@mui/material';

export default function TokenList() {
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
  const [tokenNames, setTokenNames] = useState({});

  useEffect(() => {
    if (!staticContract || !account) return;

    async function loadTokens() {
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
      } catch (err) {
        console.error('TokenList load error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTokens();
  }, [staticContract, account]);

  const handleRecipientChange = (id, value) => {
    setRecipients(prev => ({ ...prev, [id]: value }));
  };

  const handleAmountChange = (id, value) => {
    setAmounts(prev => ({ ...prev, [id]: value }));
  };

  const handleTransfer = async (id) => {
    if (!signerContract || !account) {
      setErrors(prev => ({ ...prev, [id]: 'Connect wallet first' }));
      return;
    }
    setTransferring(prev => ({ ...prev, [id]: true }));
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
        const addr = await staticContract.tokenID_proofRequest_address(id, pid);
        if (addr !== ethers.ZeroAddress) {
          proofPairs.push({ requestId: pid.toString(), prover: addr });
        }
      }

      // --- Call getProofStatus, getZKPRequest, and fetch URL for failures ---
      const statuses = proofPairs.map(pair => ({ ...pair, isVerified: false, zkpRequest: null, url: null }));
      for (let i = 0; i < proofPairs.length; i++) {
        const { prover, requestId } = proofPairs[i];
        // fetch proof verification status
        const statusData = await verifierContract.getProofStatus(prover, requestId);
        statuses[i].isVerified = statusData.isVerified;
        // fetch ZKP request tuple and extract first element
        const [zkpRequest] = await verifierContract.getZKPRequest(requestId);
        statuses[i].zkpRequest = zkpRequest;
        // if not verified, get URL from helper
        if (!statuses[i].isVerified) {
          statuses[i].url = await getUrlFromZkpRequest(zkpRequest);
        }
      }
      setProofStatuses(prev => ({ ...prev, [id]: statuses }));

      // --- Proceed with ERC-1155 safeTransferFrom ---
      const recipient = recipients[id] || '';
      const amount = amounts[id] || '0';
      const tx = await signerContract.safeTransferFrom(
        account,
        recipient,
        id,
        amount,
        '0x'
      );
      await tx.wait();

      // Refresh this token's balance
      const newBal = await staticContract.balanceOf(account, id);
      setBalances(prev =>
        prev.map((b, i) => (tokenIds[i] === id ? newBal.toString() : b))
      );
      setErrors(prev => ({ ...prev, [id]: null }));
    } catch (err) {
      const msg = err.reason || err.errorArgs?.[1] || err.message;
      setErrors(prev => ({ ...prev, [id]: msg }));
    } finally {
      setTransferring(prev => ({ ...prev, [id]: false }));
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, mt: 2 }}>
      <Typography variant="h5" gutterBottom align="center">
        List of Programmable Money
      </Typography>
      <Grid container spacing={3}>
        {tokenIds.map(id => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={id}>
            <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" gutterBottom>
                  {tokenNames[id] || 'Unnamed Token'}
                </Typography>
                <Typography variant="subtitle1" gutterBottom>
                  Token #{id}
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Balance: <b>{balances[tokenIds.indexOf(id)] || '0'}</b>
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Recipient Address"
                    value={recipients[id] || ''}
                    onChange={e => handleRecipientChange(id, e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Amount"
                    type="number"
                    inputProps={{ min: 0 }}
                    value={amounts[id] || ''}
                    onChange={e => handleAmountChange(id, e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Stack>
                {errors[id] && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {errors[id]}
                  </Alert>
                )}
                {proofStatuses[id] && (
                  <Box mt={2}>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="subtitle2" gutterBottom>
                      Proof Statuses:
                    </Typography>
                    {proofStatuses[id].map(ps => (
                      <Box key={`${ps.prover}-${ps.requestId}`} sx={{ mb: 1, pl: 1 }}>
                        <Typography variant="caption" display="block">
                          Address: {ps.prover}
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
                  onClick={() => handleTransfer(id)}
                  disabled={transferring[id]}
                  startIcon={transferring[id] && <CircularProgress size={18} />}
                >
                  {transferring[id] ? 'Transferring...' : 'Transfer'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}