import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';

const MetaMaskContext = createContext(null);

function findLegacyMetaMaskProvider() {
  const injectedProvider = window.ethereum;
  const providers = injectedProvider?.providers;

  if (Array.isArray(providers)) {
    return providers.find((candidate) => candidate.isMetaMask && !candidate.isBraveWallet) || null;
  }

  return injectedProvider?.isMetaMask && !injectedProvider.isBraveWallet ? injectedProvider : null;
}

async function isMetaMaskUnlocked(metaMaskProvider) {
  const checkUnlocked = metaMaskProvider?._metamask?.isUnlocked;
  return typeof checkUnlocked === 'function' ? checkUnlocked.call(metaMaskProvider._metamask) : null;
}

async function requestMetaMaskAccount(metaMaskProvider) {
  try {
    await metaMaskProvider.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });

    return metaMaskProvider.request({ method: 'eth_accounts' });
  } catch (error) {
    // Older MetaMask clients may not support the permissions method. Only
    // fall back for an unsupported-method error; user rejection must remain a
    // rejection instead of silently reconnecting an already-approved account.
    if (error?.code !== 4200 && error?.code !== -32601) throw error;
    return metaMaskProvider.request({ method: 'eth_requestAccounts' });
  }
}

export function MetaMaskProvider({ children }) {
  const [metaMaskProvider, setMetaMaskProvider] = useState(null);
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    const handleProviderAnnouncement = (event) => {
      const { info, provider: announcedProvider } = event.detail || {};

      if (info?.rdns === 'io.metamask') {
        setMetaMaskProvider(announcedProvider);
      }
    };

    window.addEventListener('eip6963:announceProvider', handleProviderAnnouncement);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    setMetaMaskProvider((currentProvider) => currentProvider || findLegacyMetaMaskProvider());

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleProviderAnnouncement);
    };
  }, []);

  useEffect(() => {
    if (!metaMaskProvider) return undefined;

    connectedRef.current = false;
    setAccount(null);
    setProvider(new ethers.BrowserProvider(metaMaskProvider));

    const disconnect = () => {
      connectedRef.current = false;
      setAccount(null);
    };

    const handleAccountsChanged = (accounts) => {
      // MetaMask remembers site permissions between visits. Do not turn that
      // remembered permission into an in-app connection until the user clicks
      // "Connect wallet" during this page session.
      if (!connectedRef.current) return;

      const nextAccount = accounts?.[0] || null;
      setAccount(nextAccount);

      if (!nextAccount) disconnect();
    };

    const syncAccount = async () => {
      if (!connectedRef.current) return;

      try {
        const unlocked = await isMetaMaskUnlocked(metaMaskProvider);
        if (unlocked === false) {
          disconnect();
          return;
        }

        const accounts = await metaMaskProvider.request({ method: 'eth_accounts' });
        handleAccountsChanged(accounts);
      } catch {
        // A transient provider error should not replace a known-good account.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncAccount();
    };

    metaMaskProvider.on?.('accountsChanged', handleAccountsChanged);
    metaMaskProvider.on?.('disconnect', disconnect);
    window.addEventListener('focus', syncAccount);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      metaMaskProvider.removeListener?.('accountsChanged', handleAccountsChanged);
      metaMaskProvider.removeListener?.('disconnect', disconnect);
      window.removeEventListener('focus', syncAccount);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [metaMaskProvider]);

  const connect = useCallback(async () => {
    if (!metaMaskProvider) {
      throw new Error('MetaMask is not installed');
    }

    const accounts = await requestMetaMaskAccount(metaMaskProvider);
    const unlocked = await isMetaMaskUnlocked(metaMaskProvider);
    const nextAccount = accounts?.[0] || null;

    if (unlocked === false || !nextAccount) {
      connectedRef.current = false;
      setAccount(null);
      throw new Error(unlocked === false ? 'Unlock MetaMask before connecting' : 'MetaMask did not return an account');
    }

    connectedRef.current = true;
    setAccount(nextAccount);
    return nextAccount;
  }, [metaMaskProvider]);

  const value = useMemo(() => ({ provider, account, connect }), [provider, account, connect]);

  return <MetaMaskContext.Provider value={value}>{children}</MetaMaskContext.Provider>;
}

export function useMetaMask() {
  const context = useContext(MetaMaskContext);

  if (!context) {
    throw new Error('useMetaMask must be used within a MetaMaskProvider');
  }

  return context;
}
