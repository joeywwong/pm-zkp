import React, { useState, useEffect } from 'react';
import { useContract } from '../hooks/useContract';
import { useMetaMask } from '../hooks/useMetaMask';
import ReadJsonLD from '../components/ReadJsonLD';
import { ethers } from 'ethers';
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

export default function SpendingConditionPage({ tokenListRef }) {
  const { staticContract, signerContract } = useContract();
  const { account } = useMetaMask();

  // JSON-LD related states
  const [jsonLD, setJsonLD] = useState(null);
  const [credentialNames, setCredentialNames] = useState([]);
  const [selectedSchema, setSelectedSchema] = useState('');
  const [attributeNames, setAttributeNames] = useState([]);
  const [selectedAttribute, setSelectedAttribute] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [attributeType, setAttributeType] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [jsonLdUrl, setJsonLdUrl] = useState('');
  const [proverRole, setproverRole] = useState('');
  const [error, setError] = useState('');

  // Token selection states
  const [ownedTokens, setOwnedTokens] = useState([]);
  const [selectedTokenId, setSelectedTokenId] = useState('');

  // Transaction states
  const [verifierTxHash, setVerifierTxHash] = useState('');
  const [verifierTxStatus, setVerifierTxStatus] = useState('');
  const [verifierTxError, setVerifierTxError] = useState('');
  const [isSettingSpendingCondition, setIsSettingSpendingCondition] = useState(false);
  const [requestResult, setRequestResult] = useState('');

  // Determine attribute data type
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

  // Fetch owned tokens
  const fetchOwnedTokens = async () => {
    if (!staticContract || !account) {
      setOwnedTokens([]);
      setSelectedTokenId('');
      return;
    }
    try {
      const idsBig = await staticContract.allTokenIDs();
      const ids = Array.isArray(idsBig) ? idsBig.map(id => id.toString()) : [];
      if (ids.length === 0) {
        setOwnedTokens([]);
        setSelectedTokenId('');
        return;
      }
      const accountsArray = ids.map(() => account);
      const balancesBig = await staticContract.balanceOfBatch(accountsArray, ids);
      const balances = Array.isArray(balancesBig) ? balancesBig.map(b => b.toString()) : [];
      const names = {};
      for (const id of ids) {
        try {
          names[id] = await staticContract.tokenName(id);
        } catch {
          names[id] = `Token #${id}`;
        }
      }
      const owned = ids
        .map((id, idx) => ({ id, name: names[id] || `Token #${id}`, balance: balances[idx] }))
        .filter(t => t.balance && t.balance !== '0');
      setOwnedTokens(owned);
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
  }, [staticContract, account]);

  // Validation handler
  const validateValue = value => {
    let err = '';
    if (attributeType === 'integer' && !/^[-]?\d+$/.test(value)) {
      err = 'Please enter a valid integer.';
    } else if (attributeType === 'double' && !/^[-]?\d*(\.\d+)?$/.test(value)) {
      err = 'Please enter a valid number.';
    }
    setError(err);
  };

  // Handle setting proof request
  const handleSetProofRequest = async () => {
    setVerifierTxHash('');
    setVerifierTxStatus('');
    setVerifierTxError('');
    setRequestResult('');
    setIsSettingSpendingCondition(true);

    const valueParam =
      attributeType === 'integer' || attributeType === 'double'
        ? Number(filterValue)
        : filterValue;

    if (!jsonLD || !selectedSchema || !selectedAttribute || !selectedOperator || !filterValue || !jsonLdUrl) {
      alert('Please fill in all required fields.');
      setIsSettingSpendingCondition(false);
      return;
    }
    try {
      const response = await fetch('http://localhost:5010/api/requestPayload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedSchema,
          attribute: selectedAttribute,
          schema: jsonLD,
          operatorStr: selectedOperator,
          valueParam,
          tokenID: selectedTokenId,
          contextParam: jsonLdUrl,
          attributeType
        })
      });
      const data = await response.json();

      if (data.requestId) {
        setRequestResult(`Request ID: ${data.requestId}`);
      } else {
        setRequestResult(`Response: ${JSON.stringify(data)}`);
      }

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
        const requestIdBN = BigInt(data.requestId);
        const metadata = data.metadata;
        const validator = data.validator;
        const bytesData = data.data;
        const tokenId = selectedTokenId;
        const role = proverRole;

        const condition = {
          attribute: selectedAttribute,
          operatorStr: selectedOperator,
          value: filterValue
        };

        let recommendedFee = 30;
        try {
          const gasResponse = await fetch('https://gasstation.polygon.technology/amoy');
          const gasData = await gasResponse.json();
          recommendedFee = gasData.fast.maxPriorityFee + 5;
        } catch (err) {
          console.error('Failed to fetch gas fee:', err);
        }

        try {
          const tx = await signerContract.addProofRequest_VerifierAndPM(
            requestIdBN,
            metadata,
            validator,
            bytesData,
            tokenId,
            role,
            condition,
            {
             maxPriorityFeePerGas: ethers.parseUnits(recommendedFee.toString(), 'gwei'),
             maxFeePerGas: ethers.parseUnits(recommendedFee.toString(), 'gwei'),
            }
          );
          setVerifierTxHash(tx.hash);
          setVerifierTxStatus('Pending...');
          
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
          
          try {
            await fetch('http://localhost:5010/api/logTx', {
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
            if (tokenListRef && tokenListRef.current && typeof tokenListRef.current.refreshTokenSpendingConditions === 'function') {
              tokenListRef.current.refreshTokenSpendingConditions(tokenId);
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

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom align="center">
        Add Spending Condition
      </Typography>

      {/* JSON-LD Loader */}
      <Box mb={2}>
        <ReadJsonLD
          url={jsonLdUrl}
          setUrl={setJsonLdUrl}
          onData={data => {
            setJsonLD(data);
            if (!data) {
              setCredentialNames([]);
              setSelectedSchema('');
              setAttributeNames([]);
              setSelectedAttribute('');
              return;
            }
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

      {/* Value Input */}
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

      {/* Token Selection */}
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

      {/* Submit Button */}
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
          {isSettingSpendingCondition ? 'Setting…' : 'Add Spending Condition'}
        </Button>
      </Stack>

      {/* Transaction Status */}
      {(verifierTxHash || verifierTxStatus || verifierTxError) && (
        <Paper
          elevation={1}
          sx={{
            mt: 3,
            p: 2,
            bgcolor:
              verifierTxStatus === 'Confirmed'
                ? '#e8f5e9'
                : verifierTxStatus === 'Error' || verifierTxStatus === 'Failed'
                  ? '#ffebee'
                  : '#fffde7',
            transition: 'background-color 0.3s',
          }}
        >
          {requestResult && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>{requestResult}</strong>
            </Typography>
          )}
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
    </Paper>
  );
}