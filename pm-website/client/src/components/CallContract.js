import React, { useState, useEffect } from 'react';
import { useContract } from '../hooks/useContract';
import { useMetaMask } from '../hooks/useMetaMask';
import ReadJsonLD from './ReadJsonLD';
import { ethers } from 'ethers';
//import { prepareRequestParams } from '../iden3_repo/scripts/maintenance/prepareRequestParams';

// Material UI imports
import {
  Box,
  Button,
  TextField,
  Typography,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  FormHelperText,
  CircularProgress,
  Paper,
  Link,
  Stack,
  Autocomplete,
} from '@mui/material';

export default function CallContract({ tokenListRef }) {
  const { staticContract, signerContract, signerVerifierContract } = useContract();
  const { account } = useMetaMask();

  // proof request setup (json-LD) related
  const [jsonLD, setJsonLD] = useState(null);
  const [credentialNames, setCredentialNames] = useState([]);
  const [selectedSchema, setSelectedSchema] = useState('');
  const [attributeNames, setAttributeNames] = useState([]);
  const [selectedAttribute, setSelectedAttribute] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [attributeType, setAttributeType] = useState('');
  const [filterValue, setFilterValue] = useState('');

  // Balance check state
  const [balanceAddress, setBalanceAddress] = useState('');
  const [balanceTokenId, setBalanceTokenId] = useState('');
  const [balance, setBalance] = useState(null);
  const [spendingConditions, setSpendingConditions] = useState([]);

  const fetchBalance = async () => {
    if (!staticContract) {
      console.error('Contract not ready');
      return;
    }
    try {
      const result = await staticContract.balanceOf(balanceAddress, balanceTokenId);
      setBalance(result.toString());
      // Fetch spending conditions for this token
      if (balanceTokenId) {
        try {
          const [ids, conditions] = await staticContract.getSpendingConditions(balanceTokenId);
          const formatted = ids.map((id, idx) => ({
            proofRequestId: id,
            ...conditions[idx]
          }));
          setSpendingConditions(formatted);
          console.log('Spending conditions:', formatted);
        } catch (err) {
          setSpendingConditions([]);
        }
      } else {
        setSpendingConditions([]);
      }
    } catch (error) {
      console.error('Balance fetch failed:', error);
    }
  };

  // Transfer state
  const [recipient, setRecipient] = useState('');
  const [transferTokenId, setTransferTokenId] = useState('');
  const [amount, setAmount] = useState('1');
  const [error, setError] = useState('');

  const transferToken = async () => {
    if (!signerContract || !account) {
      alert('Connect wallet and load contract first');
      return;
    }
    try {
      // Fetch all proofRequestIDs array from contract
      const proofIds = [];
      let idx = 0;
      while (true) {
        try {
          const id = await staticContract.proofRequestIDs(idx);
          proofIds.push(id);
          idx++;
          console.log("request id: ", id);
        } catch {
          console.log("break!!!");
          break;
        }
      }
      // Retrieve addresses for each proof ID and filter out zero address
      const provers = [];
      for (const pid of proofIds) {
        const addr = await staticContract.tokenID_proofRequest_address(transferTokenId, pid);
        if (addr !== ethers.ZeroAddress) {
          provers.push(addr);
        }
      }
      console.log('Valid prover addresses:', provers);

      console.log('contract runner:', signerContract.runner);
      const tx = await signerContract.safeTransferFrom(
        account,
        recipient,
        transferTokenId,
        amount,
        '0x'
      );
      console.log('Transfer tx hash:', tx.hash);
      await tx.wait();
      console.log('Transfer confirmed');
    } catch (err) {
      const reason = err.reason || err.errorArgs?.[1] || err.message;
      setError(`Transfer failed: ${reason}`);
    }
  };

  // Proof request inputs
  const [tokenID_addRequest, set_tokenID_addRequest] = useState('');
  const [requestID, set_requestID] = useState('');
  // const [proverAddress, set_proverAddress] = useState(''); // REMOVE this line
  // Role selection for proof request ('sender' or 'receiver')
  const [proverRole, setproverRole] = useState('');

  // NEW transaction feedback state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [txStatus, setTxStatus] = useState('');

  // const addProofRequest = async () => {
  //   if (!signerContract || !account) {
  //     alert('Connect wallet and load contract first');
  //     return;
  //   }

  //   setIsSubmitting(true);
  //   setTxHash('');
  //   setTxStatus('Pending…');

  //   try {
  //     const tx = await signerContract.addProofRequestAndAddress(
  //       tokenID_addRequest,
  //       requestID,
  //       proverAddress
  //     );

  //     // capture tx hash immediately
  //     setTxHash(tx.hash);

  //     // wait for confirmation
  //     const receipt = await tx.wait();
  //     if (receipt.status === 1) {
  //       setTxStatus('Confirmed');
  //     } else {
  //       setTxStatus('Failed');
  //     }
  //   } catch (err) {
  //     const reason = err.reason || err.errorArgs?.[1] || err.message;
  //     setTxStatus(`Error: ${reason}`);
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  // proof request setup (json-LD) related
  // Determine attribute data type to adjust operator options
  useEffect(() => {
    if (!jsonLD || !selectedSchema || !selectedAttribute) {
      setAttributeType('');
      return;
    }
    const ctx = (jsonLD['@context'] && jsonLD['@context'][0]) || {};
    const schemaCtx = ctx[selectedSchema] && ctx[selectedSchema]['@context'] ? ctx[selectedSchema]['@context'] : {};
    const attrObj = schemaCtx[selectedAttribute] || {};
    const typeUri = attrObj['@type'] || '';
    const parts = typeUri.split(/[#\/:]/);
    const tname = parts[parts.length - 1] || '';
    setAttributeType(tname.toLowerCase());
  }, [jsonLD, selectedSchema, selectedAttribute]);

  // Update attribute list when schema changes
  useEffect(() => {
    if (!jsonLD || !selectedSchema) {
      setAttributeNames([]);
      setSelectedAttribute('');
      return;
    }
    const ctx = (jsonLD['@context'] && jsonLD['@context'][0]) || {};
    const schemaCtx = ctx[selectedSchema] && ctx[selectedSchema]['@context'] ? ctx[selectedSchema]['@context'] : {};
    const attrs = Object.entries(schemaCtx)
      .filter(([key, val]) => typeof val === 'object')
      .map(([key]) => key);
    setAttributeNames(attrs);
  }, [jsonLD, selectedSchema]);

  // Validation handler, triggered onBlur
  const validateValue = value => {
    let err = '';
    if (attributeType === 'integer' && !/^[-]?\d+$/.test(value)) {
      err = 'Please enter a valid integer.';
    } else if (attributeType === 'double' && !/^[-]?\d*(\.\d+)?$/.test(value)) {
      err = 'Please enter a valid number.';
    }
    setError(err);
  };

  // Mint Token state (single form for both new and existing)
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

  // Mint Token handler (uses contract's mintToken logic)
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
        // Try to use receipt.effectiveGasPrice first.
        // If not available, fallback to receipt.gasPrice.
        // Testnet may not have effectiveGasPrice.
        gas_fee = receipt.gasPrice
          ? ethers.formatEther(BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice))
          : 0;
      }
      console.log('gasUsed:', receipt.gasUsed, 'gasPrice:', receipt.gasPrice);
      // Logging to backend
      try {
        await fetch('http://localhost:5000/api/logTx', {
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
      // Add new token to TokenList if not present, otherwise refresh balance
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
                // Check if token already exists in TokenList
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
          // fallback: refresh all tokens if not found
          if (typeof tokenListRef.current.refreshTokens === 'function') {
            tokenListRef.current.refreshTokens();
          }
        }
      }
      // Refresh token name dropdown
      await fetchTokenNames();
      // Refresh owned tokens for proof request dropdown
      if (typeof fetchOwnedTokens === 'function') {
        await fetchOwnedTokens();
      }
    } catch (err) {
      alert('Mint failed: ' + (err.reason || err.message));
    } finally {
      setIsMinting(false);
    }
  };

  // NEW: JSON-LD URL state
  const [jsonLdUrl, setJsonLdUrl] = useState('');
  const [requestResult, setRequestResult] = useState('');

  // Add these states near the other tx feedback states
  const [verifierTxHash, setVerifierTxHash] = useState('');
  const [verifierTxStatus, setVerifierTxStatus] = useState('');
  const [verifierTxError, setVerifierTxError] = useState('');
  const [isSettingSpendingCondition, setIsSettingSpendingCondition] = useState(false);

  const handleSetProofRequest = async () => {
    setVerifierTxHash('');
    setVerifierTxStatus('');
    setVerifierTxError('');
    setRequestResult('');
    setIsSettingSpendingCondition(true);

    // Log the React state variable attributeType
    console.log('[React state] attributeType:', attributeType);

    // Prepare valueParam for POST
    const valueParam =
      attributeType === 'integer' || attributeType === 'double'
        ? Number(filterValue)
        : filterValue;

    // Log the actual JS type of valueParam
    console.log('[JS typeof] valueParam:', valueParam, 'type:', typeof valueParam);

    if (!jsonLD || !selectedSchema || !selectedAttribute || !selectedOperator || !filterValue || !jsonLdUrl) {
      alert('Please fill in all required fields.');
      setIsSettingSpendingCondition(false);
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/requestPayload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedSchema,
          attribute: selectedAttribute,
          schema: jsonLD,
          operatorStr: selectedOperator,
          valueParam,
          tokenID: selectedTokenId, // Use the selected token ID from dropdown
          contextParam: jsonLdUrl,
          attributeType
        })
      });
      const data = await response.json();

      // Show requestId if present, otherwise show the whole response
      if (data.requestId) {
        setRequestResult(`Request ID: ${data.requestId}`);
      } else {
        setRequestResult(`Response: ${JSON.stringify(data)}`);
      }

      // Now call the signerContract's addProofRequest_VerifierAndPM
      if (
        signerContract &&
        data.requestId &&
        data.metadata &&
        data.validator &&
        data.data &&
        selectedTokenId &&
        proverRole
      ) {
        setVerifierTxStatus('Submitting...');
        const requestIdBN = BigInt(data.requestId); // uint64
        const metadata = data.metadata;
        const validator = data.validator;
        const bytesData = data.data; // should be 0x... hex string
        const tokenId = selectedTokenId;
        const role = proverRole; // 'sender' or 'receiver'

        // Prepare spending condition struct for Solidity
        const condition = {
          attribute: selectedAttribute,
          operatorStr: selectedOperator,
          value: filterValue
        };

        try {
          const tx = await signerContract.addProofRequest_VerifierAndPM(
            requestIdBN,
            metadata,
            validator,
            bytesData,
            tokenId,
            role,
            condition
          );
          setVerifierTxHash(tx.hash);
          setVerifierTxStatus('Pending...');
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
            // Try to use receipt.effectiveGasPrice first.
            // If not available, fallback to receipt.gasPrice.
            // Testnet may not have effectiveGasPrice.
            gas_fee = receipt.gasPrice
              ? ethers.formatEther(BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice))
              : 0;
          }
          console.log('gasUsed:', receipt.gasUsed, 'gasPrice:', receipt.gasPrice);
          // Logging to backend
          try {
            await fetch('http://localhost:5000/api/logTx', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operation_name: 'add_spending_condition',
                tx_hash: tx.hash,
                runtime,
                gas_fee
              })
            });
          } catch (err) {
            console.error('Failed to log tx:', err);
          }
          if (receipt.status === 1) {
            setVerifierTxStatus('Confirmed');
            // Refresh spending conditions for this token only
            if (tokenListRef && tokenListRef.current && typeof tokenListRef.current.refreshTokenSpendingConditions === 'function') {
              tokenListRef.current.refreshTokenSpendingConditions(tokenId);
            }
            if (tokenId) {
              try {
                const [ids, conditions] = await staticContract.getSpendingConditions(tokenId);
                const formatted = ids.map((id, idx) => ({
                  proofRequestId: id,
                  ...conditions[idx]
                }));
                setSpendingConditions(formatted);
              } catch {}
            }
          } else {
            setVerifierTxStatus('Failed');
          }
        } catch (err) {
          setVerifierTxError(err.reason || err.message);
          setVerifierTxStatus('Error');
        }
      }
    } catch (err) {
      setRequestResult('Failed to send proof request: ' + err.message);
    } finally {
      setIsSettingSpendingCondition(false);
    }
  };

  // Add state for selectable tokens
  const [ownedTokens, setOwnedTokens] = useState([]);
  const [selectedTokenId, setSelectedTokenId] = useState('');

  // Move fetchOwnedTokens to component scope
  const fetchOwnedTokens = async () => {
    if (!staticContract || !account) {
      setOwnedTokens([]);
      setSelectedTokenId('');
      return;
    }
    try {
      // Get all token IDs as array of BigNumbers
      const idsBig = await staticContract.allTokenIDs();
      const ids = Array.isArray(idsBig) ? idsBig.map(id => id.toString()) : [];
      if (ids.length === 0) {
        setOwnedTokens([]);
        setSelectedTokenId('');
        return;
      }
      // Prepare batch for balanceOfBatch
      const accountsArray = ids.map(() => account);
      // balanceOfBatch expects [accounts], [ids] as arrays of same length
      const balancesBig = await staticContract.balanceOfBatch(accountsArray, ids);
      // Convert balances to string
      const balances = Array.isArray(balancesBig) ? balancesBig.map(b => b.toString()) : [];
      // Get token names
      const names = {};
      for (const id of ids) {
        try {
          names[id] = await staticContract.tokenName(id);
        } catch {
          names[id] = `Token #${id}`;
        }
      }
      // Only include tokens with nonzero balance
      const owned = ids
        .map((id, idx) => ({ id, name: names[id] || `Token #${id}`, balance: balances[idx] }))
        .filter(t => t.balance && t.balance !== '0');
      setOwnedTokens(owned);
      // Always reset selectedTokenId if the new account does not own the previously selected token
      if (!owned.some(t => t.id === selectedTokenId)) {
        setSelectedTokenId(owned.length > 0 ? owned[0].id : '');
      }
    } catch (err) {
      setOwnedTokens([]);
      setSelectedTokenId('');
    }
  };
  useEffect(() => {
    fetchOwnedTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticContract, account]);

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mx: 'auto', mt: 4 }}>
      {/* Mint Token Section (single form) */}
      <Typography variant="h5" gutterBottom>
        Mint Token
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
            // Show triangle (dropdown arrow) at right if no input, show clear icon if there is input
            const showTriangle = !mintTokenName;
            const showClear = !!mintTokenName;
            // To ensure the triangle is at the rightmost position, use absolute positioning over the input box when empty
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

      {/* Check ERC-1155 Balance Section */}
      {/*
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Check ERC-1155 Balance
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <TextField
          label="Wallet Address"
          value={balanceAddress}
          onChange={e => setBalanceAddress(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Token ID"
          value={balanceTokenId}
          onChange={e => setBalanceTokenId(e.target.value)}
          size="small"
          fullWidth
        />
        <Button variant="contained" onClick={fetchBalance}>
          Get Balance
        </Button>
      </Stack>
      {balance !== null && (
        <>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Balance: <b>{balance}</b>
          </Typography>
          {spendingConditions.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1">Spending Conditions:</Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {spendingConditions.map((cond, idx) => {
                  // Translate operatorStr if possible
                  let opLabel = cond.operatorStr;
                  const operatorLabelMap = {
                    '$eq': 'is equal to',
                    '$ne': 'is not equal to',
                    '$in': 'matches one of the values',
                    '$nin': 'matches none of the values',
                    '$lt': 'is less than',
                    '$gt': 'is greater than',
                  };
                  if (operatorLabelMap[opLabel]) {
                    opLabel = operatorLabelMap[opLabel];
                  } else if ((opLabel || '').startsWith('$')) {
                    opLabel = opLabel.substring(1);
                  } else if (!opLabel) {
                    opLabel = '';
                  }
                  // Determine prover role (sender/receiver)
                  let proverRole = '';
                  if (cond.role === 'sender' || cond.proverRole === 'sender') {
                    proverRole = "Sender's";
                  } else if (cond.role === 'receiver' || cond.proverRole === 'receiver') {
                    proverRole = "Receiver's";
                  } else {
                    proverRole = '';
                  }
                  return (
                    <li key={cond.proofRequestId.toString()}>
                      <span>
                        {proverRole} {cond.attribute} {opLabel} {cond.value}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Box>
          )}
        </>
      )}
      */}

      {/* Uncomment to enable transfer UI */}
      {/*
      <Typography variant="h5" gutterBottom>
        Transfer ERC-1155 Token
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <TextField
          label="Recipient Address"
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Token ID"
          value={transferTokenId}
          onChange={e => setTransferTokenId(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Amount"
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          size="small"
          fullWidth
        />
        <Button variant="contained" onClick={transferToken}>
          Transfer Token
        </Button>
      </Stack>
      {error && (
        <Typography color="error" variant="body2">{error}</Typography>
      )}
      */}

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Set Proof Request
      </Typography>

      {/* JSON-LD URL Input */}
      {/* <TextField
        label="JSON-LD URL"
        value={jsonLdUrl}
        onChange={e => setJsonLdUrl(e.target.value)}
        fullWidth
        margin="normal"
      /> */}

      {/* JSON-LD Loader */}
      <Box mb={2}>
        <ReadJsonLD
          url={jsonLdUrl}
          setUrl={setJsonLdUrl}
          onData={data => {
            setJsonLD(data);
            const ctx = (data['@context'] && data['@context'][0]) || {};
            const names = Object.entries(ctx)
              .filter(([key, val]) => typeof val === 'object')
              .map(([key]) => key);
            setCredentialNames(names);
          }}
        />
      </Box>

      {/* Schema Type Dropdown */}
      <FormControl fullWidth margin="normal" disabled={credentialNames.length === 0}>
        <InputLabel id="schemaType-label">Schema Type</InputLabel>
        <Select
          labelId="schemaType-label"
          id="schemaType"
          value={selectedSchema}
          label="Schema Type"
          onChange={e => setSelectedSchema(e.target.value)}
        >
          <MenuItem value="" disabled>
            Select a schema
          </MenuItem>
          {credentialNames.map(schema => (
            <MenuItem key={schema} value={schema}>{schema}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Attribute Dropdown */}
      <FormControl fullWidth margin="normal" disabled={!selectedSchema || attributeNames.length === 0}>
        <InputLabel id="attributeType-label">Attribute</InputLabel>
        <Select
          labelId="attributeType-label"
          id="attributeType"
          value={selectedAttribute}
          label="Attribute"
          onChange={e => setSelectedAttribute(e.target.value)}
        >
          <MenuItem value="" disabled>
            Select an attribute
          </MenuItem>
          {attributeNames.map(attr => (
            <MenuItem key={attr} value={attr}>{attr}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Operator Dropdown */}
      <FormControl fullWidth margin="normal" disabled={!selectedAttribute}>
        <InputLabel id="operator-label">Operator</InputLabel>
        <Select
          labelId="operator-label"
          id="operator"
          value={selectedOperator}
          label="Operator"
          onChange={e => setSelectedOperator(e.target.value)}
        >
          <MenuItem value="" disabled>
            Select an operator
          </MenuItem>
          {(() => {
            let ops = [];
            if (attributeType === 'boolean') {
              ops = [
                { value: '$eq', label: 'Is equal to ($eq)' },
                { value: '$ne', label: 'Is not equal to ($ne)' }
              ];
            } else if (attributeType === 'integer') {
              ops = [
                { value: '$eq', label: 'Is equal to ($eq)' },
                { value: '$ne', label: 'Is not equal to ($ne)' },
                { value: '$in', label: 'Matches one of the values ($in)' },
                { value: '$nin', label: 'Matches none of the values ($nin)' },
                { value: '$lt', label: 'Is less than ($lt)' },
                { value: '$gt', label: 'Is greater than ($gt)' }
              ];
            } else if (attributeType === 'string' || attributeType === 'double') {
              ops = [
                { value: '$eq', label: 'Is equal to ($eq)' },
                { value: '$ne', label: 'Is not equal to ($ne)' },
                { value: '$in', label: 'Matches one of the values ($in)' },
                { value: '$nin', label: 'Matches none of the values ($nin)' }
              ];
            }
            return ops.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ));
          })()}
        </Select>
      </FormControl>

      {/* Value Input with onBlur validation and inline error */}
      {selectedOperator && (
        <FormControl fullWidth margin="normal" error={!!error}>
          {attributeType === 'boolean' ? (
            <>
              <InputLabel id="boolean-value-label">Value</InputLabel>
              <Select
                labelId="boolean-value-label"
                value={filterValue}
                label="Value"
                onChange={e => setFilterValue(e.target.value)}
                onBlur={e => validateValue(e.target.value)}
              >
                <MenuItem value="" disabled>
                  Select true or false
                </MenuItem>
                <MenuItem value="true">True</MenuItem>
                <MenuItem value="false">False</MenuItem>
              </Select>
              {error && <FormHelperText>{error}</FormHelperText>}
            </>
          ) : (
            <>
              <TextField
                label={`Value (${attributeType})`}
                type={attributeType === 'string' ? 'text' : 'number'}
                step={attributeType === 'double' ? 'any' : '1'}
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                onBlur={e => validateValue(e.target.value)}
                error={!!error}
                helperText={error}
              />
            </>
          )}
        </FormControl>
      )}

      {/* PM Contract Fields */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Select Token to Attach Spending Condition
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Choose a token you own (balance &gt; 0) to attach this spending condition.
      </Typography>
      <Stack direction="row" spacing={2} mt={2}>
        <FormControl fullWidth size="small">
          <InputLabel id="owned-token-label">Token Name</InputLabel>
          <Select
            labelId="owned-token-label"
            id="owned-token-select"
            value={selectedTokenId}
            label="Token Name"
            onChange={e => setSelectedTokenId(e.target.value)}
          >
            {ownedTokens.length === 0 && (
              <MenuItem value="" disabled>
                No tokens with balance
              </MenuItem>
            )}
            {ownedTokens.map(token => (
              <MenuItem key={token.id} value={token.id}>
                {token.name} (#{token.id})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {/*
        <TextField
          label="TokenID"
          value={tokenID_addRequest}
          onChange={e => set_tokenID_addRequest(e.target.value)}
          size="small"
          fullWidth
        />
        */}
        {/*
        <TextField
          label="Proof Request ID"
          value={requestID}
          onChange={e => set_requestID(e.target.value)}
          size="small"
          fullWidth
        />
        */}
        <FormControl fullWidth size="small">
          <InputLabel id="proof-role-label">Who is the prover?</InputLabel>
          <Select
            labelId="proof-role-label"
            id="proof-role"
            value={proverRole}
            label="Who is the prover?"
            onChange={e => setproverRole(e.target.value)}
          >
            <MenuItem value="" disabled>
              Select prover
            </MenuItem>
            <MenuItem value="sender">sender</MenuItem>
            <MenuItem value="receiver">receiver</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* Buttons */}
      <Stack direction="row" spacing={2} mt={3}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSetProofRequest}
          disabled={
            isSettingSpendingCondition ||
            !selectedSchema ||
            !selectedAttribute ||
            !selectedOperator ||
            !filterValue ||
            !!error ||
            !selectedTokenId ||
            !proverRole
          }
          startIcon={isSettingSpendingCondition && <CircularProgress size={18} />}
        >
          {isSettingSpendingCondition ? 'Setting…' : 'Set Spending Condition'}
        </Button>
        {/*
        <Button
          variant="outlined"
          onClick={addProofRequest}
          disabled={isSubmitting}
          startIcon={isSubmitting && <CircularProgress size={18} />}
        >
          {isSubmitting ? 'Submitting…' : 'Add to PM Contract'}
        </Button>
        */}
      </Stack>

      {/* PM Contract Transaction Status */}
      {txHash && (
        <Paper elevation={1} sx={{ mt: 3, p: 2, bgcolor: '#f9f9f9' }}>
          <Typography variant="body2">
            <strong>PM Contract Tx Hash:</strong>{' '}
            <Link
              href={`https://amoy.polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
            >
              {txHash}
            </Link>
          </Typography>
          <Typography variant="body2">
            <strong>PM Contract Status:</strong> {txStatus}
          </Typography>
        </Paper>
      )}

      {/* Verifier Contract Transaction Status */}
      {(verifierTxHash || verifierTxStatus || verifierTxError) && (
        <Paper elevation={1} sx={{ mt: 3, p: 2, bgcolor: '#fffde7' }}>
          {verifierTxHash && (
            <Typography variant="body2">
              <strong>Tx Hash:</strong>{' '}
              <Link
                href={`https://amoy.polygonscan.com/tx/${verifierTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
              >
                {verifierTxHash}
              </Link>
            </Typography>
          )}
          {verifierTxStatus && (
            <Typography variant="body2">
              <strong>Status:</strong> {verifierTxStatus}
            </Typography>
          )}
          {verifierTxError && (
            <Typography color="error" variant="body2">
              <strong>Error:</strong> {verifierTxError}
            </Typography>
          )}
        </Paper>
      )}

      {/* Request Result Display */}
      {requestResult && (
        <Paper elevation={1} sx={{ mt: 3, p: 2, bgcolor: '#e8f5e9' }}>
          <Typography variant="body2">
            <strong>{requestResult}</strong>
          </Typography>
        </Paper>
      )}
    </Paper>
  );
}