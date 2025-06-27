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
} from '@mui/material';

export default function CallContract() {
  const { staticContract, signerContract } = useContract();
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

  const fetchBalance = async () => {
    if (!staticContract) {
      console.error('Contract not ready');
      return;
    }
    try {
      const result = await staticContract.balanceOf(balanceAddress, balanceTokenId);
      setBalance(result.toString());
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
  const [proverAddress, set_proverAddress] = useState('');

  // NEW transaction feedback state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [txStatus, setTxStatus] = useState('');

  const addProofRequest = async () => {
    if (!signerContract || !account) {
      alert('Connect wallet and load contract first');
      return;
    }

    setIsSubmitting(true);
    setTxHash('');
    setTxStatus('Pending…');

    try {
      const tx = await signerContract.addProofRequestAndAddress(
        tokenID_addRequest,
        requestID,
        proverAddress
      );

      // capture tx hash immediately
      setTxHash(tx.hash);

      // wait for confirmation
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        setTxStatus('Confirmed');
      } else {
        setTxStatus('Failed');
      }
    } catch (err) {
      const reason = err.reason || err.errorArgs?.[1] || err.message;
      setTxStatus(`Error: ${reason}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // Minting state
  const [mintRecipient, setMintRecipient] = useState('');
  const [mintTokenId, setMintTokenId] = useState('');
  const [mintTokenName, setMintTokenName] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [isMinting, setIsMinting] = useState(false);

  const mintToken = async () => {
    if (!signerContract || !account) {
      alert('Connect wallet and load contract first');
      return;
    }
    setIsMinting(true);
    try {
      const tx = await signerContract.mintNewToken(
        mintRecipient,
        mintTokenId,
        mintAmount,
        "0x",
        mintTokenName
      );
      await tx.wait();
      alert('Token minted!');
    } catch (err) {
      alert('Mint failed: ' + (err.reason || err.message));
    } finally {
      setIsMinting(false);
    }
  };

  // Mint Existing Token state
  const [mintExistRecipient, setMintExistRecipient] = useState('');
  const [mintExistTokenId, setMintExistTokenId] = useState('');
  const [mintExistAmount, setMintExistAmount] = useState('');
  const [isMintingExisting, setIsMintingExisting] = useState(false);

  // Mint Existing Token handler
  const mintExistingToken = async () => {
    if (!signerContract || !account) {
      alert('Connect wallet and load contract first');
      return;
    }
    setIsMintingExisting(true);
    try {
      const tx = await signerContract.mintExistingToken(
        mintExistRecipient,
        mintExistTokenId,
        mintExistAmount,
        "0x"
      );
      await tx.wait();
      alert('Existing token minted!');
    } catch (err) {
      alert('Mint failed: ' + (err.reason || err.message));
    } finally {
      setIsMintingExisting(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 600, mx: 'auto', mt: 4 }}>
      {/* Mint New Token Section */}
      <Typography variant="h5" gutterBottom>
        Mint New Token
      </Typography>
      <Stack direction="row" spacing={2} mt={2}>
        <TextField
          label="Recipient Address"
          value={mintRecipient}
          onChange={e => setMintRecipient(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Token ID"
          value={mintTokenId}
          onChange={e => setMintTokenId(e.target.value)}
          size="small"
          fullWidth
        />
      </Stack>
      <Stack direction="row" spacing={2} mt={2}>
        <TextField
          label="Token Name"
          value={mintTokenName}
          onChange={e => setMintTokenName(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Amount"
          type="number"
          value={mintAmount}
          onChange={e => setMintAmount(e.target.value)}
          size="small"
          fullWidth
        />
      </Stack>
      <Box mt={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={mintToken}
          disabled={isMinting || !mintRecipient || !mintTokenId || !mintTokenName || !mintAmount}
          startIcon={isMinting && <CircularProgress size={18} />}
        >
          {isMinting ? 'Minting…' : 'Mint Token'}
        </Button>
      </Box>

      {/* Mint Existing Token Section */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Mint Existing Token
      </Typography>
      <Stack direction="row" spacing={2} mt={2}>
        <TextField
          label="Recipient Address"
          value={mintExistRecipient}
          onChange={e => setMintExistRecipient(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Token ID"
          value={mintExistTokenId}
          onChange={e => setMintExistTokenId(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Amount"
          type="number"
          value={mintExistAmount}
          onChange={e => setMintExistAmount(e.target.value)}
          size="small"
          fullWidth
        />
      </Stack>
      <Box mt={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={mintExistingToken}
          disabled={isMintingExisting || !mintExistRecipient || !mintExistTokenId || !mintExistAmount}
          startIcon={isMintingExisting && <CircularProgress size={18} />}
        >
          {isMintingExisting ? 'Minting…' : 'Mint Existing Token'}
        </Button>
      </Box>

      {/* Check ERC-1155 Balance Section */}
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
        <Typography variant="body1" sx={{ mb: 2 }}>
          Balance: <b>{balance}</b>
        </Typography>
      )}

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
        Set Proof Request on Verifier Contract (UniversalVerifier.sol)
      </Typography>

      {/* JSON-LD Loader */}
      <Box mb={2}>
        <ReadJsonLD onData={data => {
          setJsonLD(data);
          const ctx = (data['@context'] && data['@context'][0]) || {};
          const names = Object.entries(ctx)
            .filter(([key, val]) => typeof val === 'object')
            .map(([key]) => key);
          setCredentialNames(names);
        }} />
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

      {/* Set Proof Request Button */}
      <Box mt={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            // TODO: implement set proof request logic here
            alert('Set Proof Request clicked!');
          }}
          disabled={!selectedSchema || !selectedAttribute || !selectedOperator || !filterValue || !!error}
        >
          Set Proof Request
        </Button>
      </Box>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Set Proof Request on PM Contract
      </Typography>

      <Stack direction="row" spacing={2} mt={2}>
        <TextField
          label="TokenID"
          value={tokenID_addRequest}
          onChange={e => set_tokenID_addRequest(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Proof Request ID"
          value={requestID}
          onChange={e => set_requestID(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Prover's address"
          value={proverAddress}
          onChange={e => set_proverAddress(e.target.value)}
          size="small"
          fullWidth
        />
      </Stack>

      <Box mt={2}>
        <Button
          variant="contained"
          onClick={addProofRequest}
          disabled={isSubmitting}
          startIcon={isSubmitting && <CircularProgress size={18} />}
        >
          {isSubmitting ? 'Submitting…' : 'Add Proof Request'}
        </Button>
      </Box>

      {txHash && (
        <Paper elevation={1} sx={{ mt: 3, p: 2, bgcolor: '#f9f9f9' }}>
          <Typography variant="body2">
            <strong>Tx Hash:</strong>{' '}
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
            <strong>Status:</strong> {txStatus}
          </Typography>
        </Paper>
      )}
    </Paper>
  );
}