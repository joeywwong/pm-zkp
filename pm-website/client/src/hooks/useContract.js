import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, ABI, VERIFIER_CONTRACT_ADDRESS, VERIFIER_ABI } from '../constants/contract';
import { useMetaMask } from './useMetaMask';

/**
 * Custom hook returning:
 * - staticContract: provider-based, for read-only calls
 * - signerContract: signer-based, for transactions
 */
export function useContract() {
  const { provider, account } = useMetaMask();
  const [staticContract, setStaticContract] = useState(null);
  const [verifierContract, setVerifierContract] = useState(null);
  const [signerContract, setSignerContract] = useState(null);

  useEffect(() => {
    if (!provider) return;

    // Initialize read-only contract for view calls
    const readOnlyCtr = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    setStaticContract(readOnlyCtr);

    // Initialize read-only verifier contract for view calls
    const readOnlyVerifierCtr = new ethers.Contract(VERIFIER_CONTRACT_ADDRESS, VERIFIER_ABI, provider);
    setVerifierContract(readOnlyVerifierCtr);


    // Initialize signer-backed contract whenever provider or account changes
    async function initSigner() {
      if (!account) {
        setSignerContract(null);
        return;
      }
      const signer = await provider.getSigner();
      const writeCtr = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setSignerContract(writeCtr);
    }
    initSigner();
  }, [provider, account]);

  return { staticContract, signerContract, verifierContract };
}