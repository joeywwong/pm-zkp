import contractJson from './PMNoAdmin_compData.json';
import verifierContract from './UniversalVerifier_compData';

// This address is the deployed PM contract where only contract owner can mint token, 
// and only admin can add and remove conditions
//export const CONTRACT_ADDRESS = '0x8e4DDB96AEFa33dB6b6FA6c5d62479B3E24E5278';

// This address is the deployed PM contract where anyone can mint token,
// but only admin can add and remove conditions
//export const CONTRACT_ADDRESS = '0x4347D5CcB5ddc275Bd396F98d5eDC009AAe82eD5';

// This is the deployed PM contract where anyone can add or remove spending conditions on their owned token, 
// and anyone can mint token,
export const CONTRACT_ADDRESS = '0xe09104EAaD696Bf8a4b9534A30C78DF15E42403c';

export const ABI = contractJson.abi;
export const VERIFIER_CONTRACT_ADDRESS = '0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c';
export const VERIFIER_ABI = verifierContract.abi;
