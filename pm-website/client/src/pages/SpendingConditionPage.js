import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useContract } from '../hooks/useContract';
import { useMetaMask } from '../hooks/useMetaMask';
import ReadJsonLD from '../components/ReadJsonLD';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import SchemaRoundedIcon from '@mui/icons-material/SchemaRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import TokenRoundedIcon from '@mui/icons-material/TokenRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';

const operators = [
  { value: '$eq', label: 'Equal to' },
  { value: '$ne', label: 'Not equal to' },
  { value: '$gt', label: 'Greater than' },
  { value: '$lt', label: 'Less than' },
  { value: '$gte', label: 'Greater than or equal to' },
  { value: '$lte', label: 'Less than or equal to' },
];

function SectionHeading({ icon: Icon, step, title, description }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" mb={2.5}>
      <Box sx={theme => ({ width: 42, height: 42, flexShrink: 0, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.09), color: 'primary.main' })}><Icon fontSize="small" /></Box>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center"><Typography variant="h4">{title}</Typography><Chip size="small" label={`Step ${step}`} variant="outlined" /></Stack>
        <Typography variant="body2" color="text.secondary" mt={.4}>{description}</Typography>
      </Box>
    </Stack>
  );
}

export default function SpendingConditionPage({ tokenListRef }) {
  const { staticContract, signerContract } = useContract();
  const { account } = useMetaMask();
  const [jsonLD, setJsonLD] = useState(null);
  const [credentialNames, setCredentialNames] = useState([]);
  const [selectedSchema, setSelectedSchema] = useState('');
  const [attributeNames, setAttributeNames] = useState([]);
  const [selectedAttribute, setSelectedAttribute] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [attributeType, setAttributeType] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [jsonLdUrl, setJsonLdUrl] = useState('');
  const [proverRole, setProverRole] = useState('');
  const [error, setError] = useState('');
  const [ownedTokens, setOwnedTokens] = useState([]);
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [verifierTxHash, setVerifierTxHash] = useState('');
  const [verifierTxStatus, setVerifierTxStatus] = useState('');
  const [verifierTxError, setVerifierTxError] = useState('');
  const [isSettingSpendingCondition, setIsSettingSpendingCondition] = useState(false);
  const [requestResult, setRequestResult] = useState('');

  useEffect(() => {
    if (!jsonLD || !selectedSchema || !selectedAttribute) {
      setAttributeType('');
      return;
    }
    const ctx = (jsonLD['@context'] && jsonLD['@context'][0]) || {};
    const schemaCtx = ctx[selectedSchema]?.['@context'] || {};
    const typeUri = schemaCtx[selectedAttribute]?.['@type'] || '';
    const parts = typeUri.split(new RegExp('[#/:]'));
    setAttributeType((parts[parts.length - 1] || '').toLowerCase());
  }, [jsonLD, selectedSchema, selectedAttribute]);

  useEffect(() => {
    if (!jsonLD || !selectedSchema) {
      setAttributeNames([]);
      setSelectedAttribute('');
      return;
    }
    const ctx = (jsonLD['@context'] && jsonLD['@context'][0]) || {};
    const schemaCtx = ctx[selectedSchema]?.['@context'] || {};
    setAttributeNames(Object.entries(schemaCtx).filter(([, value]) => typeof value === 'object').map(([key]) => key));
    setSelectedAttribute('');
  }, [jsonLD, selectedSchema]);

  const fetchOwnedTokens = async () => {
    if (!staticContract || !account) {
      setOwnedTokens([]);
      setSelectedTokenId('');
      return;
    }
    try {
      const idsBig = await staticContract.allTokenIDs();
      const ids = Array.isArray(idsBig) ? idsBig.map(id => id.toString()) : [];
      if (!ids.length) {
        setOwnedTokens([]);
        setSelectedTokenId('');
        return;
      }
      const balancesBig = await staticContract.balanceOfBatch(ids.map(() => account), ids);
      const balances = Array.isArray(balancesBig) ? balancesBig.map(balance => balance.toString()) : [];
      const names = {};
      for (const id of ids) {
        try { names[id] = await staticContract.tokenName(id); }
        catch { names[id] = `Token #${id}`; }
      }
      const owned = ids.map((id, index) => ({ id, name: names[id] || `Token #${id}`, balance: balances[index] })).filter(token => token.balance && token.balance !== '0');
      setOwnedTokens(owned);
      if (!owned.some(token => token.id === selectedTokenId)) setSelectedTokenId(owned[0]?.id || '');
    } catch {
      setOwnedTokens([]);
      setSelectedTokenId('');
    }
  };

  useEffect(() => {
    fetchOwnedTokens();
    // Ownership is scoped to the active read contract and wallet account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticContract, account]);

  const validateValue = value => {
    let nextError = '';
    if (attributeType === 'integer' && !/^[-]?\d+$/.test(value)) nextError = 'Enter a valid integer.';
    else if (attributeType === 'double' && !/^[-]?\d*(\.\d+)?$/.test(value)) nextError = 'Enter a valid number.';
    setError(nextError);
  };

  const handleSetProofRequest = async () => {
    setVerifierTxHash('');
    setVerifierTxStatus('');
    setVerifierTxError('');
    setRequestResult('');
    setIsSettingSpendingCondition(true);
    const valueParam = attributeType === 'integer' || attributeType === 'double' ? Number(filterValue) : filterValue;

    if (!jsonLD || !selectedSchema || !selectedAttribute || !selectedOperator || !filterValue || !jsonLdUrl) {
      setVerifierTxError('Complete every required credential field before continuing.');
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
      setRequestResult(data.requestId ? `Request ID: ${data.requestId}` : `Response: ${JSON.stringify(data)}`);

      if (signerContract && data.requestId && data.metadata && data.validator && data.data && selectedTokenId && proverRole) {
        setVerifierTxStatus('Submitting');
        const condition = { attribute: selectedAttribute, operatorStr: selectedOperator, value: filterValue };
        let recommendedFee = 30;
        try {
          const gasResponse = await fetch('https://gasstation.polygon.technology/amoy');
          const gasData = await gasResponse.json();
          recommendedFee = gasData.fast.maxPriorityFee + 5;
        } catch (err) { console.error('Failed to fetch gas fee:', err); }

        try {
          const tx = await signerContract.addProofRequest_VerifierAndPM(
            BigInt(data.requestId), data.metadata, data.validator, data.data, selectedTokenId, proverRole, condition,
            { maxPriorityFeePerGas: ethers.parseUnits(recommendedFee.toString(), 'gwei'), maxFeePerGas: ethers.parseUnits(recommendedFee.toString(), 'gwei') }
          );
          setVerifierTxHash(tx.hash);
          setVerifierTxStatus('Pending');
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
          if (receipt?.gasUsed && receipt?.gasPrice) gas_fee = ethers.formatEther(BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice));
          try {
            await fetch('http://localhost:5010/api/logTx', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ operation_name: 'add_spending_condition', tx_hash: tx.hash, runtime, gas_fee })
            });
          } catch (err) { console.error('Failed to log tx:', err); }
          if (receipt.status === 1) {
            setVerifierTxStatus('Confirmed');
            if (typeof tokenListRef?.current?.refreshTokenSpendingConditions === 'function') tokenListRef.current.refreshTokenSpendingConditions(selectedTokenId);
          } else setVerifierTxStatus('Failed');
        } catch (err) {
          setVerifierTxError(err.reason || err.message);
          setVerifierTxStatus('Error');
        }
      }
    } catch (err) {
      setRequestResult('');
      setVerifierTxError(`Failed to send proof request: ${err.message}`);
    } finally { setIsSettingSpendingCondition(false); }
  };

  const isComplete = Boolean(account && selectedSchema && selectedAttribute && selectedOperator && filterValue && !error && selectedTokenId && proverRole);
  const activeStep = !selectedSchema || !selectedAttribute ? 0 : !selectedOperator || !filterValue ? 1 : !selectedTokenId || !proverRole ? 2 : 3;
  const selectedToken = ownedTokens.find(token => token.id === selectedTokenId);
  const selectedOperatorLabel = operators.find(operator => operator.value === selectedOperator)?.label;
  const statusSeverity = verifierTxStatus === 'Confirmed' ? 'success' : verifierTxStatus === 'Error' || verifierTxStatus === 'Failed' || verifierTxError ? 'error' : 'info';

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Paper sx={{ px: { xs: 2, sm: 3 }, py: 2, mb: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 4, overflowX: 'auto' }}>
        <Stepper activeStep={activeStep} sx={{ minWidth: 560 }}>
          {['Credential', 'Condition', 'Token & prover', 'Submit'].map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>
      </Paper>

      {!account && <Alert severity="warning" sx={{ mb: 2.5 }}>Connect MetaMask to load owned tokens and submit the condition on-chain.</Alert>}
      {(requestResult || verifierTxStatus || verifierTxError) && (
        <Alert severity={statusSeverity} sx={{ mb: 2.5 }}>
          <Typography fontWeight={750}>{verifierTxStatus === 'Confirmed' ? 'Condition added successfully' : verifierTxStatus ? `Transaction ${verifierTxStatus.toLowerCase()}` : 'Proof request update'}</Typography>
          {requestResult && <Typography variant="body2">{requestResult}</Typography>}
          {verifierTxError && <Typography variant="body2">{verifierTxError}</Typography>}
          {verifierTxHash && <Link href={`https://amoy.polygonscan.com/tx/${verifierTxHash}`} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: .5, mt: .5, fontWeight: 700 }}>View transaction <OpenInNewRoundedIcon sx={{ fontSize: 16 }} /></Link>}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(280px, .65fr)' }, gap: 2.5, alignItems: 'start' }}>
        <Stack spacing={2.5}>
          <Paper sx={{ p: { xs: 2.5, sm: 3.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
            <SectionHeading icon={SchemaRoundedIcon} step="1" title="Choose a credential" description="Load a JSON-LD context, then select the credential schema and field to evaluate." />
            <ReadJsonLD
              url={jsonLdUrl}
              setUrl={setJsonLdUrl}
              onData={data => {
                setJsonLD(data);
                setSelectedSchema('');
                setSelectedAttribute('');
                if (!data) { setCredentialNames([]); setAttributeNames([]); return; }
                const ctx = (data['@context'] && data['@context'][0]) || {};
                setCredentialNames(Object.entries(ctx).filter(([, value]) => typeof value === 'object' && value?.['@context']).map(([key]) => key));
              }}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2 }}>
              <FormControl fullWidth disabled={!credentialNames.length}>
                <InputLabel id="schemaType-label">Schema type</InputLabel>
                <Select labelId="schemaType-label" id="schemaType" value={selectedSchema} label="Schema type" onChange={event => setSelectedSchema(event.target.value)}>
                  <MenuItem value="" disabled>Select a schema</MenuItem>
                  {credentialNames.map(schema => <MenuItem key={schema} value={schema}>{schema}</MenuItem>)}
                </Select>
                <FormHelperText>{credentialNames.length ? `${credentialNames.length} schema option${credentialNames.length === 1 ? '' : 's'} found` : 'Load a valid context first'}</FormHelperText>
              </FormControl>
              <FormControl fullWidth disabled={!selectedSchema || !attributeNames.length}>
                <InputLabel id="attributeType-label">Attribute</InputLabel>
                <Select labelId="attributeType-label" id="attributeType" value={selectedAttribute} label="Attribute" onChange={event => setSelectedAttribute(event.target.value)}>
                  <MenuItem value="" disabled>Select an attribute</MenuItem>
                  {attributeNames.map(attribute => <MenuItem key={attribute} value={attribute}>{attribute}</MenuItem>)}
                </Select>
                <FormHelperText>{attributeType ? `Detected type: ${attributeType}` : 'Select the field used in the rule'}</FormHelperText>
              </FormControl>
            </Box>
          </Paper>

          <Paper sx={{ p: { xs: 2.5, sm: 3.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
            <SectionHeading icon={TuneRoundedIcon} step="2" title="Build the condition" description="Choose how the credential attribute should be evaluated during a transfer." />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl fullWidth disabled={!selectedAttribute}>
                <InputLabel id="operator-label">Operator</InputLabel>
                <Select labelId="operator-label" id="operator" value={selectedOperator} label="Operator" onChange={event => setSelectedOperator(event.target.value)}>
                  <MenuItem value="" disabled>Select an operator</MenuItem>
                  {operators.map(operator => <MenuItem key={operator.value} value={operator.value}>{operator.label} <Typography component="span" variant="caption" color="text.secondary" ml={1}>{operator.value}</Typography></MenuItem>)}
                </Select>
                <FormHelperText>The comparison applied to the credential value</FormHelperText>
              </FormControl>
              {attributeType === 'boolean' ? (
                <FormControl fullWidth disabled={!selectedOperator} error={Boolean(error)}>
                  <InputLabel id="boolean-value-label">Value</InputLabel>
                  <Select labelId="boolean-value-label" value={filterValue} label="Value" onChange={event => setFilterValue(event.target.value)}>
                    <MenuItem value="true">True</MenuItem><MenuItem value="false">False</MenuItem>
                  </Select>
                  <FormHelperText>{error || 'Required credential value'}</FormHelperText>
                </FormControl>
              ) : (
                <TextField
                  label={attributeType ? `Value (${attributeType})` : 'Value'}
                  type={attributeType === 'string' ? 'text' : 'number'}
                  value={filterValue}
                  onChange={event => { setFilterValue(event.target.value); if (error) validateValue(event.target.value); }}
                  onBlur={event => validateValue(event.target.value)}
                  error={Boolean(error)}
                  helperText={error || 'Required credential value'}
                  disabled={!selectedOperator}
                  inputProps={{ step: attributeType === 'double' ? 'any' : '1' }}
                />
              )}
            </Box>
          </Paper>

          <Paper sx={{ p: { xs: 2.5, sm: 3.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
            <SectionHeading icon={TokenRoundedIcon} step="3" title="Attach to a token" description="Select an owned token and decide whose credential must satisfy this rule." />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl fullWidth disabled={!account || !ownedTokens.length}>
                <InputLabel id="owned-token-label">Token</InputLabel>
                <Select labelId="owned-token-label" id="owned-token-select" value={selectedTokenId} label="Token" onChange={event => setSelectedTokenId(event.target.value)}>
                  {!ownedTokens.length && <MenuItem value="" disabled>No tokens with a balance</MenuItem>}
                  {ownedTokens.map(token => <MenuItem key={token.id} value={token.id}>{token.name} · #{token.id} · {token.balance} units</MenuItem>)}
                </Select>
                <FormHelperText>Only tokens held by the connected wallet are shown</FormHelperText>
              </FormControl>
              <FormControl fullWidth disabled={!selectedTokenId}>
                <InputLabel id="proof-role-label">Required prover</InputLabel>
                <Select labelId="proof-role-label" id="proof-role" value={proverRole} label="Required prover" onChange={event => setProverRole(event.target.value)}>
                  <MenuItem value="sender">Money sender</MenuItem><MenuItem value="receiver">Money receiver</MenuItem>
                </Select>
                <FormHelperText>The transfer participant who submits the proof</FormHelperText>
              </FormControl>
            </Box>
          </Paper>
        </Stack>

        <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 4, position: { lg: 'sticky' }, top: { lg: 100 } }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={2}><RuleRoundedIcon color="primary" /><Typography variant="h3">Rule summary</Typography></Stack>
          <Typography variant="body2" color="text.secondary" lineHeight={1.6}>This condition is enforced by the programmable-money contract before a transfer succeeds.</Typography>
          <Divider sx={{ my: 2.5 }} />
          <Stack spacing={2.2}>
            <Box><Typography variant="caption" color="text.secondary">Credential</Typography><Typography fontWeight={750}>{selectedSchema || 'Not selected'}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Condition</Typography><Typography fontWeight={750}>{selectedAttribute && selectedOperatorLabel && filterValue ? `${selectedAttribute} ${selectedOperatorLabel.toLowerCase()} ${filterValue}` : 'Not defined'}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Token</Typography><Typography fontWeight={750}>{selectedToken ? `${selectedToken.name} (#${selectedToken.id})` : 'Not selected'}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Required prover</Typography><Typography fontWeight={750}>{proverRole === 'sender' ? 'Money sender' : proverRole === 'receiver' ? 'Money receiver' : 'Not selected'}</Typography></Box>
          </Stack>
          <Divider sx={{ my: 2.5 }} />
          <Button
            variant="contained"
            fullWidth
            onClick={handleSetProofRequest}
            disabled={isSettingSpendingCondition || !isComplete}
            startIcon={isSettingSpendingCondition ? <CircularProgress size={18} color="inherit" /> : <VerifiedUserRoundedIcon />}
            sx={{ minHeight: 50 }}
          >
            {isSettingSpendingCondition ? 'Creating condition…' : 'Add spending condition'}
          </Button>
          {!isComplete && <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={1.2}>Complete all three steps to continue.</Typography>}
        </Paper>
      </Box>
    </Box>
  );
}
