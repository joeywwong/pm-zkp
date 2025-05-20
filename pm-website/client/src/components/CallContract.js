import React, { useState, useEffect } from 'react';
import { useContract } from '../hooks/useContract';
import { useMetaMask } from '../hooks/useMetaMask';
import ReadJsonLD from './ReadJsonLD';
import { ethers } from 'ethers';

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
      //const result = await staticContract.allTokenIDs();
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

  return (
    <div>
      <h3>Check ERC-1155 Balance</h3>
      <input
        type="text"
        placeholder="Wallet Address"
        value={balanceAddress}
        onChange={e => setBalanceAddress(e.target.value)}
      />
      <input
        type="text"
        placeholder="Token ID"
        value={balanceTokenId}
        onChange={e => setBalanceTokenId(e.target.value)}
      />
      <button onClick={fetchBalance}>Get Balance</button>
      {balance !== null && <p>Balance: {balance}</p>}

      {/*
      <h3>Transfer ERC-1155 Token</h3>
      <input
        type="text"
        placeholder="Recipient Address"
        value={recipient}
        onChange={e => setRecipient(e.target.value)}
      />
      <input
        type="text"
        placeholder="Token ID"
        value={transferTokenId}
        onChange={e => setTransferTokenId(e.target.value)}
      />
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <button onClick={transferToken}>Transfer Token</button>
      {error && <p className="text-red-500">{error}</p>}
      */}

      <h3>Set Proof Request</h3>

      {/* JSON-LD Loader */}
      <ReadJsonLD onData={data => {
        setJsonLD(data);
        const ctx = (data['@context'] && data['@context'][0]) || {};
        const names = Object.entries(ctx)
          .filter(([key, val]) => typeof val === 'object')
          .map(([key]) => key);
        setCredentialNames(names);
      }} />

      {/* Display extracted schema types as a dropdown */}
      <div className="mb-4">
        <label htmlFor="schemaType" className="block font-medium mb-1">Schema Type</label>
        <select
          id="schemaType"
          value={selectedSchema}
          onChange={e => setSelectedSchema(e.target.value)}
          className="w-full p-2 border rounded"
          disabled={credentialNames.length === 0}
        >
          <option value="" hidden>Select a schema</option>
          {credentialNames.map(schema => (
            <option key={schema} value={schema}>{schema}</option>
          ))}
        </select>
      </div>
      
      {/* Attribute dropdown, populated based on selected schema */}
      <div className="mb-4">
        <label htmlFor="attributeType" className="block font-medium mb-1">Attribute</label>
        <select
          id="attributeType"
          value={selectedAttribute}
          onChange={e => setSelectedAttribute(e.target.value)}
          className="w-full p-2 border rounded"
          disabled={!selectedSchema || attributeNames.length === 0}
        >
          <option value="" hidden>Select an attribute</option>
          {attributeNames.map(attr => (
            <option key={attr} value={attr}>{attr}</option>
          ))}
        </select>
      </div>
      
      {/* Operator dropdown, enabled after attribute selected and adjusted by type */}
      <div className="mb-4">
        <label htmlFor="operator" className="block font-medium mb-1">Operator</label>
      <select
        id="operator"
        value={selectedOperator}
        onChange={e => setSelectedOperator(e.target.value)}
        className="w-full p-2 border rounded mb-4"
        disabled={!selectedAttribute}
      >
        <option value="" disabled>Select an operator</option>
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
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ));
        })()}
      </select>
      </div>
      
      {/* Value Input with onBlur validation and inline error */}
      {selectedOperator && (
        <div className="mb-4">
          <label className="block font-medium mb-1">Value</label>
          <div className="flex items-center space-x-3">
            {attributeType === 'boolean' ? (
              <select
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                onBlur={e => validateValue(e.target.value)}
                className="p-2 border rounded"
              >
                <option value="" hidden>Select true or false</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input
                type={attributeType === 'string' ? 'text' : 'number'}
                step={attributeType === 'double' ? 'any' : '1'}
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                onBlur={e => validateValue(e.target.value)}
                className="p-2 border rounded"
                placeholder={`Enter a ${attributeType} value`}
              />
            )}
            {error && <span className="text-red-600 whitespace-nowrap">{error}</span>}
          </div>
        </div>
      )}

      <input
        type="text"
        placeholder="TokenID"
        value={tokenID_addRequest}
        onChange={e => set_tokenID_addRequest(e.target.value)}
      />
      <input
        type="text"
        placeholder="Proof Request ID"
        value={requestID}
        onChange={e => set_requestID(e.target.value)}
      />
      <input
        type="text"
        placeholder="Prover's address"
        value={proverAddress}
        onChange={e => set_proverAddress(e.target.value)}
      />

      <button
        onClick={addProofRequest}
        disabled={isSubmitting}
        className={`mt-2 px-4 py-2 rounded ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'bg-blue-600 text-white'}`}
      >
        {isSubmitting ? 'Submitting…' : 'Add Proof Request'}
      </button>

      {txHash && (
        <div className="mt-3 p-2 border rounded bg-gray-50">
          <p>
            <strong>Tx Hash:</strong>{' '}
            <a
              href={`https://amoy.polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {txHash}
            </a>
          </p>
          <p><strong>Status:</strong> {txStatus}</p>
        </div>
      )}

    </div>
  );
}