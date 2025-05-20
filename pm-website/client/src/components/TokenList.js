import React, { useState, useEffect } from 'react';
import { useContract } from '../hooks/useContract';
import { useMetaMask } from '../hooks/useMetaMask';
import { ethers } from 'ethers'; // using ethers.ZeroAddress
import getUrlFromZkpRequest from '../utils/configUniversalLink';

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
          console.log("zkp is: ", zkpRequest)
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
    }
  };

  if (loading) return <p>Loading tokens...</p>;

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {tokenIds.map(id => (
        <div
          key={id}
          className="bg-white p-4 rounded shadow hover:shadow-md transition"
        >
          <p className="font-bold mb-2">Token #{id}</p>
          <p className="mb-2">Balance: {balances[tokenIds.indexOf(id)] || '0'}</p>

          <input
            type="text"
            placeholder="Recipient Address"
            value={recipients[id] || ''}
            onChange={e => handleRecipientChange(id, e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="number"
            min="0"
            placeholder="Amount"
            value={amounts[id] || ''}
            onChange={e => handleAmountChange(id, e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <button
            onClick={() => handleTransfer(id)}
            className="w-full py-2 bg-blue-600 text-white rounded"
          >
            Transfer
          </button>
          {errors[id] && <p className="text-red-500 mt-2">{errors[id]}</p>}

          {/* Display proof statuses */}
          {proofStatuses[id] && (
            <div className="mt-2">
              <p className="font-medium">Proof Statuses:</p>
              {proofStatuses[id].map(ps => (
                <div key={`${ps.prover}-${ps.requestId}`} className="text-sm mb-1">
                  <p>Address: {ps.prover}</p>
                  <p>Request ID: {ps.requestId}</p>
                  <p>Verified: {ps.isVerified.toString()}</p>
                  {!ps.isVerified && ps.url && (
                    <p>
                      URL: <a href={ps.url} target="_blank" rel="noopener noreferrer">{ps.url}</a>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
