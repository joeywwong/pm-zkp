 // Define the request
 const request = {"id":"7f38a193-0918-4a48-9fac-36adfdb8b543","typ":"application/iden3comm-plain-json","type":"https://iden3-communication.io/proofs/1.0/contract-invoke-request","thid":"7f38a193-0918-4a48-9fac-36adfdb8b543","from":"did:iden3:polygon:amoy:x6x5sor7zpyefHwZu9RE4xiuRWBkq9xAEHxrKbKWb","body":{"reason":"spending condition for the transfer of token 99999","transaction_data":{"contract_address":"0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c","method_id":"ade09fcd","chain_id":80002,"network":"polygon-amoy"},"scope":[{"id":1752040282,"circuitId":"credentialAtomicQuerySigV2OnChain","query":{"allowedIssuers":["*"],"context":"https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v3.json-ld","credentialSubject":{"birthday":{"$lt":20231231}},"type":"KYCAgeCredential"}}]}};


// Define the URLs for redirection
const backUrl = encodeURIComponent("https://my-app.org/back");
const finishUrl = encodeURIComponent("https://my-app.org/finish");

// Base64 encode the verification request
const base64EncodedRequest = btoa(JSON.stringify(request));


// Configure the Wallet URL (universal link)
//walletUrlWithMessage = `https://wallet.privado.id/#i_m=${base64EncodedRequest}&back_url=${backUrl}&finish_url=${finishUrl}`;
walletUrlWithMessage = `https://wallet.privado.id/#i_m=${base64EncodedRequest}`;

console.log(walletUrlWithMessage)
// Open the Wallet URL to start the verification process
//window.open(walletUrlWithMessage);


/*
Note
=================================================

// You can also use the `request_uri` parameter instead of `i_m`. 
// For that, first define the URL containing the request, and URI encode it.

const requestUrl = encodeURIComponent("https://raw.githubusercontent.com/0xpulkit/Examples_Privado-ID/main/KYCV3.json");

// Configure the Wallet URL (universal link) using `request_uri` instead of `i_m`
walletUrlWithRequestUri = `https://wallet.privado.id/#request_uri=${requestUrl}&back_url=${backUrl}&finish_url=${finishUrl}`);

// Open the Wallet URL with the `request_uri`
window.open(walletUrlWithRequestUri);

==================================================
*/
