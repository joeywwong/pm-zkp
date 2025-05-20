/**
 * Generates a universal wallet link for a given ZKP request object.
 *
 * @param {object} requestObj - The ZKP request object to encode (must match the on-chain tuple structure).
 * @param {string} [backUrl] - URL to return to if the user navigates back.
 * @param {string} [finishUrl] - URL to navigate to when the process finishes.
 * @returns {string} The fully constructed universal wallet URL.
 */
export default function getUrlFromZkpRequest(
  requestObj,
  backUrl = "http://localhost:3000",
  finishUrl = "http://localhost:3000"
) {

  // Validate and normalize input
  if (requestObj === null || requestObj === undefined) {
    throw new Error('getUrlFromZkpRequest: requestObj is null or undefined');
  }

  let req;
  if (typeof requestObj === 'string') {
    console.log('getUrlFromZkpRequest: parsing requestObj string');
    try {
      req = JSON.parse(requestObj);
    } catch (err) {
      console.error('getUrlFromZkpRequest: invalid JSON string', err);
      throw new Error('getUrlFromZkpRequest: requestObj string is not valid JSON');
    }
  } else if (typeof requestObj === 'object') {
    req = requestObj;
  } else {
    console.log('getUrlFromZkpRequest: requestObj type:', typeof requestObj);
    throw new Error('getUrlFromZkpRequest: requestObj must be an object or JSON string');
  }

  // Base64 encode the JSON representation of the object
  const encodedRequest = btoa(JSON.stringify(req));
  const encodedBack = encodeURIComponent(backUrl);
  const encodedFinish = encodeURIComponent(finishUrl);

  // Construct and return the universal wallet link
  return `https://wallet.privado.id/#i_m=${encodedRequest}`;
}


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
