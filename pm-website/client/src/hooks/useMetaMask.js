import { useState, useEffect } from 'react';
import { ethers } from "ethers";

export function useMetaMask() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);

  useEffect(() => {
    if (window.ethereum) {
      const ethProvider = new ethers.BrowserProvider(window.ethereum)
      setProvider(ethProvider);

      ethProvider.listAccounts().then(accounts => {
        if (accounts.length) setAccount(accounts[0]);
      });

      window.ethereum.on('accountsChanged', accounts => {
        setAccount(accounts[0] || null);
      });
    }
  }, []);

  const connect = async () => {
    if (!provider) return;
    const accounts = await provider.send('eth_requestAccounts', []);
    setAccount(accounts[0]);
  };

  return { provider, account, connect };
}