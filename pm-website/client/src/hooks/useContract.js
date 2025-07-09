import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, ABI, VERIFIER_CONTRACT_ADDRESS, VERIFIER_ABI } from '../constants/contract';
import { useMetaMask } from './useMetaMask';

/**
 * Custom hook returning:
 * - staticContract: provider-based, for read-only calls
 * - signerContract: signer-based, for transactions
 * - verifierContract: provider-based, for read-only verifier calls
 * - signerVerifierContract: signer-based, for verifier write calls
 */
export function useContract() {
  const { provider, account } = useMetaMask();
  const [staticContract, setStaticContract] = useState(null);
  const [verifierContract, setVerifierContract] = useState(null);
  const [signerContract, setSignerContract] = useState(null);
  const [signerVerifierContract, setSignerVerifierContract] = useState(null);

  useEffect(() => {
    if (!provider) return;

    // Read-only contracts
    setStaticContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, provider));
    setVerifierContract(new ethers.Contract(VERIFIER_CONTRACT_ADDRESS, VERIFIER_ABI, provider));

    // Signer-backed contracts
    async function initSigner() {
      if (!account) {
        setSignerContract(null);
        setSignerVerifierContract(null);
        return;
      }
      const signer = await provider.getSigner();
      setSignerContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, signer));
      setSignerVerifierContract(new ethers.Contract(VERIFIER_CONTRACT_ADDRESS, VERIFIER_ABI, signer));
    }
    initSigner();
  }, [provider, account]);

  return { staticContract, signerContract, verifierContract, signerVerifierContract };
}