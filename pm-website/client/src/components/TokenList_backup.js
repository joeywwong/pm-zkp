import React, { useState, useEffect } from 'react';
import { useContract } from '../hooks/useContract';
import { useMetaMask } from '../hooks/useMetaMask';

export default function TokenList() {
  const { staticContract } = useContract();
  const { account } = useMetaMask();
  const [tokenIds, setTokenIds] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!staticContract || !account) return;

    async function loadTokens() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch all token IDs
        const idsBig = await staticContract.allTokenIDs();
        // idsBig is a readonly array; copy to a mutable JS array
        const idsBigArray = [...idsBig];
        const ids = idsBigArray.map(id => id.toString());
        setTokenIds(ids);

        // 2. Prepare arrays for balanceOfBatch
        const accountsArray = idsBigArray.map(() => account);
        const balancesBig = await staticContract.balanceOfBatch(accountsArray, idsBigArray);
        const balancesStr = balancesBig.map(b => b.toString());
        setBalances(balancesStr);
            } catch (err) {
                console.error('TokenList load error:', err);
                setError(err.reason || err.message);
            } finally {
                setLoading(false);
            }
    }

    loadTokens();
  }, [staticContract, account]);

  if (loading) return <p>Loading tokens...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div>
      <h3>Your Tokens & Balances</h3>
      <ul>
        {tokenIds.map((id, index) => (
          <li key={id}>
            Token #{id}: {balances[index] || '0'}
          </li>
        ))}
      </ul>
    </div>
  );
}