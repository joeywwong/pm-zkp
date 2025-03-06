"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultIdentityCreationOptions = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
const js_sdk_1 = require("@0xpolygonid/js-sdk");
const walletSetup_1 = require("./walletSetup");
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const request_1 = require("./request");
dotenv_1.default.config();
const rhsUrl = process.env.RHS_URL;
const walletKey = process.env.WALLET_KEY;
const defaultNetworkConnection = {
    rpcUrl: process.env.RPC_URL,
    contractAddress: process.env.CONTRACT_ADDRESS,
    chainId: parseInt(process.env.CHAIN_ID)
};
exports.defaultIdentityCreationOptions = {
    method: js_sdk_1.core.DidMethod.PolygonId,
    blockchain: js_sdk_1.core.Blockchain.Polygon,
    networkId: js_sdk_1.core.NetworkId.Amoy,
    revocationOpts: {
        type: js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
        id: rhsUrl
    }
};

function createHealthCredential(did) {
    const credentialRequest = {
        credentialSchema: 
        //'https://ipfs.io/ipfs/QmPEb5nAQoKLCHFbBbAsgueew7UYKuA9YAw1gVVrVMi6Q3',
        'https://api.jsonbin.io/v3/b/67aec6adacd3cb34a8e18335?meta=false',
        type: 'healthData',
        credentialSubject: {
            id: did.string(),
            BMI: 23,
            smoker: false,
            restingHeartRate: 70
        },
        expiration: 12345678888,
        revocationOpts: {
            type: js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
            id: rhsUrl
        }
    };
    return credentialRequest;
}

function createHealthCredentialRequest(circuitId, credentialRequest) {
    const proofReqSig = {
        id: 1739452428,
        //on-chain
        //circuitId: js_sdk_1.CircuitId.AtomicQuerySigV2OnChain,
        //off-chain
        circuitId: js_sdk_1.CircuitId.AtomicQuerySigV2,
        optional: false,
        query: {
            allowedIssuers: ['*'],
            type: credentialRequest.type,
            context: 'https://api.jsonbin.io/v3/b/67aec79cad19ca34f8030693?meta=false',
            credentialSubject: {
                restingHeartRate: {
                    $lt: 90
                }
            }
        }
    };
    const proofReqMtp = {
        id: 1739452428,
        circuitId: js_sdk_1.CircuitId.AtomicQueryMTPV2,
        optional: false,
        query: {
            allowedIssuers: ['*'],
            type: credentialRequest.type,
            context: 'https://api.jsonbin.io/v3/b/67aec79cad19ca34f8030693?meta=false',
            credentialSubject: {
                restingHeartRate: {
                    $lt: 90
                }
            }
        }
    };
    switch (circuitId) {
        case js_sdk_1.CircuitId.AtomicQuerySigV2OnChain:
            return proofReqSig;
        case js_sdk_1.CircuitId.AtomicQueryMTPV2:
            return proofReqMtp;
        default:
            return proofReqSig;
    }
}
async function identityCreation() {
    console.log('=============== key creation ===============');
    const { identityWallet } = await (0, walletSetup_1.initInMemoryDataStorageAndWallets)(defaultNetworkConnection);
    const { did, credential } = await identityWallet.createIdentity({
        ...exports.defaultIdentityCreationOptions
    });
    console.log('=============== did ===============');
    console.log(did.string());
    console.log('=============== Auth BJJ credential ===============');
    console.log(JSON.stringify(credential));
}
async function issueCredential() {
    console.log('=============== issue credential ===============');
    const { dataStorage, identityWallet } = await (0, walletSetup_1.initInMemoryDataStorageAndWallets)(defaultNetworkConnection);
    const { did: userDID, credential: authBJJCredentialUser } = await identityWallet.createIdentity({
        ...exports.defaultIdentityCreationOptions
    });
    console.log('=============== user did ===============');
    console.log(userDID.string());
    const { did: issuerDID, credential: issuerAuthBJJCredential } = await identityWallet.createIdentity({ ...exports.defaultIdentityCreationOptions });
    console.log('=============== issuer did ===============');
    console.log(issuerDID.string());
    const credentialRequest = createHealthCredential(userDID);
    const credential = await identityWallet.issueCredential(issuerDID, credentialRequest);
    console.log('===============  credential ===============');
    console.log(JSON.stringify(credential));
    await dataStorage.credential.saveCredential(credential);
}
async function transitState() {
    console.log('=============== transit state ===============');
    const { dataStorage, credentialWallet, identityWallet } = await (0, walletSetup_1.initInMemoryDataStorageAndWallets)(defaultNetworkConnection);
    const circuitStorage = await (0, walletSetup_1.initCircuitStorage)();
    const proofService = await (0, walletSetup_1.initProofService)(identityWallet, credentialWallet, dataStorage.states, circuitStorage);
    const { did: userDID, credential: authBJJCredentialUser } = await identityWallet.createIdentity({
        ...exports.defaultIdentityCreationOptions
    });
    console.log('=============== user did ===============');
    console.log(userDID.string());
    const { did: issuerDID, credential: issuerAuthBJJCredential } = await identityWallet.createIdentity({ ...exports.defaultIdentityCreationOptions });
    console.log('=============== issuerDID did ===============');
    console.log(issuerDID.string());
    const credentialRequest = createKYCAgeCredential(userDID);
    const credential = await identityWallet.issueCredential(issuerDID, credentialRequest);
    await dataStorage.credential.saveCredential(credential);
    console.log('================= generate Iden3SparseMerkleTreeProof =======================');
    const res = await identityWallet.addCredentialsToMerkleTree([credential], issuerDID);
    console.log('================= push states to rhs ===================');
    await identityWallet.publishRevocationInfoByCredentialStatusType(issuerDID, js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof, { rhsUrl });
    console.log('================= publish to blockchain ===================');
    const ethSigner = new ethers_1.ethers.Wallet(walletKey, dataStorage.states.getRpcProvider());
    const txId = await proofService.transitState(issuerDID, res.oldTreeState, true, dataStorage.states, ethSigner);
    console.log(txId);
}
async function transitStateThirdPartyDID() {
    console.log('=============== THIRD PARTY DID: transit state  ===============');
    js_sdk_1.core.registerDidMethodNetwork({
        method: 'thirdparty',
        methodByte: 129,
        blockchain: 'linea',
        network: 'test',
        networkFlag: 0b01000001 | 0b00000001,
        chainId: 11155112
    });
    js_sdk_1.core.registerDidMethodNetwork({
        method: 'iden3',
        blockchain: 'linea',
        network: 'test',
        networkFlag: 0b11000001 | 0b00000011
    });
    const { dataStorage, credentialWallet, identityWallet } = await (0, walletSetup_1.initInMemoryDataStorageAndWallets)({
        rpcUrl: process.env.THIRD_PARTY_RPC_URL,
        contractAddress: process.env.THIRD_PARTY_CONTRACT_ADDRESS,
        chainId: parseInt(process.env.THIRD_PARTY_CHAIN_ID)
    });
    const circuitStorage = await (0, walletSetup_1.initCircuitStorage)();
    const proofService = await (0, walletSetup_1.initProofService)(identityWallet, credentialWallet, dataStorage.states, circuitStorage);
    const method = js_sdk_1.core.DidMethod.thirdparty;
    const blockchain = js_sdk_1.core.Blockchain.linea;
    const networkId = js_sdk_1.core.NetworkId.test;
    const { did: userDID } = await identityWallet.createIdentity({
        method,
        blockchain,
        networkId,
        revocationOpts: {
            type: js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
            id: rhsUrl
        }
    });
    console.log('=============== third party: user did ===============');
    console.log(userDID.string());
    const { did: issuerDID } = await identityWallet.createIdentity({
        method: js_sdk_1.core.DidMethod.Iden3,
        blockchain: js_sdk_1.core.Blockchain.linea,
        networkId: js_sdk_1.core.NetworkId.test,
        revocationOpts: {
            type: js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
            id: rhsUrl
        }
    });
    console.log('=============== third party: issuer did ===============');
    console.log(issuerDID.string());
    const credentialRequest = createKYCAgeCredential(userDID);
    const credential = await identityWallet.issueCredential(issuerDID, credentialRequest);
    await dataStorage.credential.saveCredential(credential);
    console.log('================= third party: generate Iden3SparseMerkleTreeProof =======================');
    const res = await identityWallet.addCredentialsToMerkleTree([credential], issuerDID);
    console.log('================= third party: push states to rhs ===================');
    await identityWallet.publishRevocationInfoByCredentialStatusType(issuerDID, js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof, { rhsUrl });
    console.log('================= publish to blockchain ===================');
    const ethSigner = new ethers_1.ethers.Wallet(process.env.THIRD_PARTY_WALLET_KEY, dataStorage.states.getRpcProvider());
    const txId = await proofService.transitState(issuerDID, res.oldTreeState, true, dataStorage.states, ethSigner);
    console.log(txId);
}

async function generateProofs(useMongoStore = false)  {
    console.log('=============== generate health proofs ===============');
    let dataStorage, credentialWallet, identityWallet;
    if (useMongoStore) {
        ({ dataStorage, credentialWallet, identityWallet } = await (0, walletSetup_1.initMongoDataStorageAndWallets)(defaultNetworkConnection));
    }
    else {
        ({ dataStorage, credentialWallet, identityWallet } = await (0, walletSetup_1.initInMemoryDataStorageAndWallets)(defaultNetworkConnection));
    }
    const circuitStorage = await (0, walletSetup_1.initCircuitStorage)();
    const proofService = await (0, walletSetup_1.initProofService)(identityWallet, credentialWallet, dataStorage.states, circuitStorage);
    const { did: userDID, credential: authBJJCredentialUser } = await identityWallet.createIdentity({
        ...exports.defaultIdentityCreationOptions
    });
    console.log('=============== user did ===============');
    console.log(userDID.string());
    const { did: issuerDID, credential: issuerAuthBJJCredential } = await identityWallet.createIdentity({ ...exports.defaultIdentityCreationOptions });
    //const credentialRequest = createKYCAgeCredential(userDID);
    const credentialRequest = createHealthCredential(userDID);
    const credential = await identityWallet.issueCredential(issuerDID, credentialRequest);
    await dataStorage.credential.saveCredential(credential);
    console.log('================= generate Iden3SparseMerkleTreeProof =======================');
    const res = await identityWallet.addCredentialsToMerkleTree([credential], issuerDID);
    console.log('================= push states to rhs ===================');
    await identityWallet.publishRevocationInfoByCredentialStatusType(issuerDID, js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof, { rhsUrl });
    console.log('================= publish to blockchain ===================');
    const ethSigner = new ethers_1.ethers.Wallet(walletKey, dataStorage.states.getRpcProvider());
    const txId = await proofService.transitState(issuerDID, res.oldTreeState, true, dataStorage.states, ethSigner);
    console.log(txId);
    /*/////////////these lines are for on-chain verification//////////////
    console.log('================= generate credentialAtomicQuerySigV2OnChain ===================');
    const proofReqSig = createHealthCredentialRequest(js_sdk_1.CircuitId.AtomicQuerySigV2OnChain, credentialRequest);
    const opts = {
        skipRevocation: false, // required boolean
        challenge: 67549932986331345334700458784033530495n,
    };
    //const { proof, pub_signals } = await proofService.generateProof(proofReqSig, userDID, opts);
    const { proof, pub_signals } = await proofService.generateProof(proofReqSig, userDID);
    const sigProofOk = await proofService.verifyProof({ proof, pub_signals }, js_sdk_1.CircuitId.AtomicQuerySigV2OnChain);
    console.log('valid: ', sigProofOk);
    console.log(JSON.stringify(proof));
    console.log("pub_signals:");
    console.log(pub_signals);
    //////////////these lines are for on-chain verification/////////////*/
    console.log('================= generate credentialAtomicSigV2 ===================');
    const proofReqSig = createHealthCredentialRequest(js_sdk_1.CircuitId.AtomicQuerySigV2, credentialRequest);
    const { proof, pub_signals } = await proofService.generateProof(proofReqSig, userDID);
    const sigProofOk = await proofService.verifyProof({ proof, pub_signals }, js_sdk_1.CircuitId.AtomicQuerySigV2);
    console.log('valid: ', sigProofOk);
    console.log('================= generate credentialAtomicMTPV2 ===================');
    const credsWithIden3MTPProof = await identityWallet.generateIden3SparseMerkleTreeProof(issuerDID, res.credentials, txId);
    console.log(credsWithIden3MTPProof);
    await credentialWallet.saveAll(credsWithIden3MTPProof);
    const proofReqMtp = createHealthCredentialRequest(js_sdk_1.CircuitId.AtomicQueryMTPV2, credentialRequest);
    const { proof: proofMTP, pub_signals: pub_signalsMTP } = await proofService.generateProof(proofReqMtp, userDID);
    console.log(JSON.stringify(proofMTP));
    const mtpProofOk = await proofService.verifyProof({ proof: proofMTP, pub_signals: pub_signalsMTP }, js_sdk_1.CircuitId.AtomicQueryMTPV2);
    console.log('valid: ', mtpProofOk);
    const { proof: proof2, pub_signals: pub_signals2 } = await proofService.generateProof(proofReqSig, userDID);
    const sigProof2Ok = await proofService.verifyProof({ proof: proof2, pub_signals: pub_signals2 }, js_sdk_1.CircuitId.AtomicQuerySigV2);
    console.log('valid: ', sigProof2Ok);

}
async function handleAuthRequest(useMongoStore = false) {
    console.log('=============== handle auth request ===============');
    let dataStorage, credentialWallet, identityWallet;
    if (useMongoStore) {
        ({ dataStorage, credentialWallet, identityWallet } = await (0, walletSetup_1.initMongoDataStorageAndWallets)(defaultNetworkConnection));
    }
    else {
        ({ dataStorage, credentialWallet, identityWallet } = await (0, walletSetup_1.initInMemoryDataStorageAndWallets)(defaultNetworkConnection));
    }
    const circuitStorage = await (0, walletSetup_1.initCircuitStorage)();
    const proofService = await (0, walletSetup_1.initProofService)(identityWallet, credentialWallet, dataStorage.states, circuitStorage);
    const { did: userDID, credential: authBJJCredentialUser } = await identityWallet.createIdentity({
        ...exports.defaultIdentityCreationOptions
    });
    console.log('=============== user did ===============');
    console.log(userDID.string());
    const { did: issuerDID, credential: issuerAuthBJJCredential } = await identityWallet.createIdentity({ ...exports.defaultIdentityCreationOptions });
    const credentialRequest = createKYCAgeCredential(userDID);
    const credential = await identityWallet.issueCredential(issuerDID, credentialRequest);
    await dataStorage.credential.saveCredential(credential);
    console.log('================= generate Iden3SparseMerkleTreeProof =======================');
    const res = await identityWallet.addCredentialsToMerkleTree([credential], issuerDID);
    console.log('================= push states to rhs ===================');
    await identityWallet.publishRevocationInfoByCredentialStatusType(issuerDID, js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof, { rhsUrl });
    console.log('================= publish to blockchain ===================');
    const ethSigner = new ethers_1.ethers.Wallet(walletKey, dataStorage.states.getRpcProvider());
    const txId = await proofService.transitState(issuerDID, res.oldTreeState, true, dataStorage.states, ethSigner);
    console.log(txId);
    console.log('================= generate credentialAtomicSigV2 ===================');
    const proofReqSig = createKYCAgeCredentialRequest(js_sdk_1.CircuitId.AtomicQuerySigV2, credentialRequest);
    console.log('=================  credential auth request ===================');
    const authRequest = {
        id: 'fe6354fe-3db2-48c2-a779-e39c2dda8d90',
        thid: 'fe6354fe-3db2-48c2-a779-e39c2dda8d90',
        typ: js_sdk_1.PROTOCOL_CONSTANTS.MediaType.PlainMessage,
        from: issuerDID.string(),
        type: js_sdk_1.PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE,
        body: {
            callbackUrl: 'http://testcallback.com',
            message: 'message to sign',
            scope: [proofReqSig],
            reason: 'verify age'
        }
    };
    console.log(JSON.stringify(authRequest));
    const credsWithIden3MTPProof = await identityWallet.generateIden3SparseMerkleTreeProof(issuerDID, res.credentials, txId);
    console.log(credsWithIden3MTPProof);
    await credentialWallet.saveAll(credsWithIden3MTPProof);
    const authRawRequest = new TextEncoder().encode(JSON.stringify(authRequest));
    // * on the user side */
    console.log('============== handle auth request ==============');
    const authV2Data = await circuitStorage.loadCircuitData(js_sdk_1.CircuitId.AuthV2);
    const pm = await (0, walletSetup_1.initPackageManager)(authV2Data, proofService.generateAuthV2Inputs.bind(proofService), proofService.verifyState.bind(proofService));
    const authHandler = new js_sdk_1.AuthHandler(pm, proofService);
    const authHandlerRequest = await authHandler.handleAuthorizationRequest(userDID, authRawRequest);
    console.log(JSON.stringify(authHandlerRequest, null, 2));
}
async function handleAuthRequestWithProfiles() {
    console.log('=============== handle auth request with profiles ===============');
    const { dataStorage, credentialWallet, identityWallet } = await (0, walletSetup_1.initInMemoryDataStorageAndWallets)(defaultNetworkConnection);
    const circuitStorage = await (0, walletSetup_1.initCircuitStorage)();
    const proofService = await (0, walletSetup_1.initProofService)(identityWallet, credentialWallet, dataStorage.states, circuitStorage);
    const { did: userDID, credential: authBJJCredentialUser } = await identityWallet.createIdentity({
        ...exports.defaultIdentityCreationOptions
    });
    console.log('=============== user did ===============');
    console.log(userDID.string());
    const { did: issuerDID, credential: issuerAuthBJJCredential } = await identityWallet.createIdentity({ ...exports.defaultIdentityCreationOptions });
    // credential is issued on the profile!
    const profileDID = await identityWallet.createProfile(userDID, 50, issuerDID.string());
    const credentialRequest = createKYCAgeCredential(profileDID);
    const credential = await identityWallet.issueCredential(issuerDID, credentialRequest);
    await dataStorage.credential.saveCredential(credential);
    console.log('================= generate credentialAtomicSigV2 ===================');
    const proofReqSig = createKYCAgeCredentialRequest(js_sdk_1.CircuitId.AtomicQuerySigV2, credentialRequest);
    console.log('=================  credential auth request ===================');
    const verifierDID = 'did:example:123#JUvpllMEYUZ2joO59UNui_XYDqxVqiFLLAJ8klWuPBw';
    const authRequest = {
        id: 'fe6354fe-3db2-48c2-a779-e39c2dda8d90',
        thid: 'fe6354fe-3db2-48c2-a779-e39c2dda8d90',
        typ: js_sdk_1.PROTOCOL_CONSTANTS.MediaType.PlainMessage,
        from: verifierDID,
        type: js_sdk_1.PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE,
        body: {
            callbackUrl: 'http://testcallback.com',
            message: 'message to sign',
            scope: [proofReqSig],
            reason: 'verify age'
        }
    };
    console.log(JSON.stringify(authRequest));
    const authRawRequest = new TextEncoder().encode(JSON.stringify(authRequest));
    // * on the user side */
    console.log('============== handle auth request ==============');
    const authV2Data = await circuitStorage.loadCircuitData(js_sdk_1.CircuitId.AuthV2);
    const pm = await (0, walletSetup_1.initPackageManager)(authV2Data, proofService.generateAuthV2Inputs.bind(proofService), proofService.verifyState.bind(proofService));
    const authHandler = new js_sdk_1.AuthHandler(pm, proofService);
    const authProfile = await identityWallet.getProfileByVerifier(authRequest.from);
    // let's check that we didn't create profile for verifier
    const authProfileDID = authProfile
        ? js_sdk_1.core.DID.parse(authProfile.id)
        : await identityWallet.createProfile(userDID, 100, authRequest.from);
    const resp = await authHandler.handleAuthorizationRequest(authProfileDID, authRawRequest);
    console.log(resp);
}
async function handleAuthRequestWithProfilesV3CircuitBeta() {
    console.log('=============== handle auth request with profiles v3 circuits beta ===============');
    const { dataStorage, credentialWallet, identityWallet } = await (0, walletSetup_1.initInMemoryDataStorageAndWallets)(defaultNetworkConnection);
    const circuitStorage = await (0, walletSetup_1.initCircuitStorage)();
    const proofService = await (0, walletSetup_1.initProofService)(identityWallet, credentialWallet, dataStorage.states, circuitStorage);
    const { did: userDID, credential: authBJJCredentialUser } = await identityWallet.createIdentity({
        ...exports.defaultIdentityCreationOptions
    });
    console.log('=============== user did ===============');
    console.log(userDID.string());
    const { did: issuerDID, credential: issuerAuthBJJCredential } = await identityWallet.createIdentity({ ...exports.defaultIdentityCreationOptions });
    // credential is issued on the profile!
    const profileDID = await identityWallet.createProfile(userDID, 50, issuerDID.string());
    const credentialRequest = createKYCAgeCredential(profileDID);
    const credential = await identityWallet.issueCredential(issuerDID, credentialRequest);
    await dataStorage.credential.saveCredential(credential);
    console.log('================= generate credentialAtomicV3 ===================');
    const proofReq = {
        id: 19,
        circuitId: js_sdk_1.CircuitId.AtomicQueryV3,
        params: {
            nullifierSessionId: '123443290439234342342423423423423'
        },
        query: {
            groupId: 1,
            allowedIssuers: ['*'],
            proofType: js_sdk_1.ProofType.BJJSignature,
            type: credentialRequest.type,
            context: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v3.json-ld',
            credentialSubject: {
                documentType: {}
            }
        }
    };
    const linkedProof = {
        id: 20,
        circuitId: js_sdk_1.CircuitId.LinkedMultiQuery10,
        optional: false,
        query: {
            groupId: 1,
            proofType: js_sdk_1.ProofType.BJJSignature,
            allowedIssuers: ['*'],
            type: credentialRequest.type,
            context: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v3.json-ld',
            credentialSubject: {
                birthday: {
                    $lt: 20010101
                }
            }
        }
    };
    console.log('=================  credential auth request ===================');
    const verifierDID = 'did:polygonid:polygon:mumbai:2qLWqgjWa1cGnmPwCreXuPQrfLrRrzDL1evD6AG7p7';
    const authRequest = {
        id: 'fe6354fe-3db2-48c2-a779-e39c2dda8d90',
        thid: 'fe6354fe-3db2-48c2-a779-e39c2dda8d90',
        typ: js_sdk_1.PROTOCOL_CONSTANTS.MediaType.PlainMessage,
        from: verifierDID,
        type: js_sdk_1.PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE,
        body: {
            callbackUrl: 'http://testcallback.com',
            message: 'v3 beta',
            scope: [proofReq, linkedProof],
            reason: 'selective disclosure of document type,'
        }
    };
    console.log(JSON.stringify(authRequest));
    const authRawRequest = new TextEncoder().encode(JSON.stringify(authRequest));
    // * on the user side */
    console.log('============== handle auth request ==============');
    const authV2Data = await circuitStorage.loadCircuitData(js_sdk_1.CircuitId.AuthV2);
    const pm = await (0, walletSetup_1.initPackageManager)(authV2Data, proofService.generateAuthV2Inputs.bind(proofService), proofService.verifyState.bind(proofService));
    const authHandler = new js_sdk_1.AuthHandler(pm, proofService);
    const authProfile = await identityWallet.getProfileByVerifier(authRequest.from);
    // let's check that we didn't create profile for verifier
    const authProfileDID = authProfile
        ? js_sdk_1.core.DID.parse(authProfile.id)
        : await identityWallet.createProfile(userDID, 100, authRequest.from);
    const resp = await authHandler.handleAuthorizationRequest(authProfileDID, authRawRequest);
    console.log(resp);
}
async function handleAuthRequestNoIssuerStateTransition() {
    console.log('=============== handle auth request no issuer state transition ===============');
    const { dataStorage, credentialWallet, identityWallet } = await (0, walletSetup_1.initInMemoryDataStorageAndWallets)(defaultNetworkConnection);
    const circuitStorage = await (0, walletSetup_1.initCircuitStorage)();
    const proofService = await (0, walletSetup_1.initProofService)(identityWallet, credentialWallet, dataStorage.states, circuitStorage);
    const { did: userDID, credential: authBJJCredentialUser } = await identityWallet.createIdentity({
        ...exports.defaultIdentityCreationOptions
    });
    console.log('=============== user did ===============');
    console.log(userDID.string());
    const { did: issuerDID, credential: issuerAuthBJJCredential } = await identityWallet.createIdentity({ ...exports.defaultIdentityCreationOptions });
    const credentialRequest = createKYCAgeCredential(userDID);
    const credential = await identityWallet.issueCredential(issuerDID, credentialRequest);
    await dataStorage.credential.saveCredential(credential);
    console.log('================= generate credentialAtomicSigV2 ===================');
    const proofReqSig = createKYCAgeCredentialRequest(js_sdk_1.CircuitId.AtomicQuerySigV2, credentialRequest);
    const authRequest = {
        id: 'fe6354fe-3db2-48c2-a779-e39c2dda8d90',
        thid: 'fe6354fe-3db2-48c2-a779-e39c2dda8d90',
        typ: js_sdk_1.PROTOCOL_CONSTANTS.MediaType.PlainMessage,
        from: issuerDID.string(),
        type: js_sdk_1.PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE,
        body: {
            callbackUrl: 'http://testcallback.com',
            message: 'message to sign',
            scope: [proofReqSig],
            reason: 'verify age'
        }
    };
    const authRawRequest = new TextEncoder().encode(JSON.stringify(authRequest));
    // * on the user side */
    console.log('============== handle auth request ==============');
    const authV2Data = await circuitStorage.loadCircuitData(js_sdk_1.CircuitId.AuthV2);
    const pm = await (0, walletSetup_1.initPackageManager)(authV2Data, proofService.generateAuthV2Inputs.bind(proofService), proofService.verifyState.bind(proofService));
    const authHandler = new js_sdk_1.AuthHandler(pm, proofService);
    const authHandlerRequest = await authHandler.handleAuthorizationRequest(userDID, authRawRequest);
    console.log(JSON.stringify(authHandlerRequest, null, 2));
}
async function handleAuthRequestV3CircuitsBetaStateTransition() {
    console.log('=============== handle auth request no issuer state transition V3 ===============');
    const { dataStorage, credentialWallet, identityWallet } = await (0, walletSetup_1.initInMemoryDataStorageAndWallets)(defaultNetworkConnection);
    const circuitStorage = await (0, walletSetup_1.initCircuitStorage)();
    const proofService = await (0, walletSetup_1.initProofService)(identityWallet, credentialWallet, dataStorage.states, circuitStorage);
    const authV2Data = await circuitStorage.loadCircuitData(js_sdk_1.CircuitId.AuthV2);
    const pm = await (0, walletSetup_1.initPackageManager)(authV2Data, proofService.generateAuthV2Inputs.bind(proofService), proofService.verifyState.bind(proofService));
    const authHandler = new js_sdk_1.AuthHandler(pm, proofService);
    const { did: issuerDID, credential: issuerAuthBJJCredential } = await identityWallet.createIdentity({ ...exports.defaultIdentityCreationOptions });
    console.log('=============== user did ===============', issuerDID.string());
    const { did: userDID, credential: authBJJCredentialUser } = await identityWallet.createIdentity({
        ...exports.defaultIdentityCreationOptions
    });
    console.log('=============== user did ===============', userDID.string());
    const profileDID = await identityWallet.createProfile(userDID, 777, issuerDID.string());
    const claimReq = {
        credentialSchema: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/kyc-nonmerklized.json',
        type: 'KYCAgeCredential',
        credentialSubject: {
            id: userDID.string(),
            birthday: 19960424,
            documentType: 99
        },
        expiration: 2793526400,
        revocationOpts: {
            type: js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
            id: rhsUrl
        }
    };
    const issuedCred = await identityWallet.issueCredential(issuerDID, claimReq);
    await credentialWallet.save(issuedCred);
    console.log('=============== issued birthday credential ===============');
    const res = await identityWallet.addCredentialsToMerkleTree([issuedCred], issuerDID);
    console.log('=============== added to merkle tree ===============');
    await identityWallet.publishRevocationInfoByCredentialStatusType(issuerDID, js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof, { rhsUrl });
    console.log('=============== published to rhs ===============');
    const ethSigner = new ethers_1.ethers.Wallet(walletKey, dataStorage.states.getRpcProvider());
    const txId = await proofService.transitState(issuerDID, res.oldTreeState, true, dataStorage.states, ethSigner);
    console.log('=============== state transition ===============', txId);
    const credsWithIden3MTPProof = await identityWallet.generateIden3SparseMerkleTreeProof(issuerDID, res.credentials, txId);
    await credentialWallet.saveAll(credsWithIden3MTPProof);
    console.log('=============== saved credentials with mtp proof ===============');
    const employeeCredRequest = {
        credentialSchema: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/KYCEmployee-v101.json',
        type: 'KYCEmployee',
        credentialSubject: {
            id: profileDID.string(),
            ZKPexperiance: true,
            hireDate: '2023-12-11',
            position: 'boss',
            salary: 200,
            documentType: 1
        },
        revocationOpts: {
            type: js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
            id: rhsUrl
        }
    };
    const employeeCred = await identityWallet.issueCredential(issuerDID, employeeCredRequest);
    await credentialWallet.save(employeeCred);
    console.log('=============== issued employee credential ===============');
    console.log('=============== generate ZeroKnowledgeProofRequest MTP + SIG + with Linked proof ===================');
    const proofReqs = [
        {
            id: 1,
            circuitId: js_sdk_1.CircuitId.AtomicQueryV3,
            optional: false,
            query: {
                allowedIssuers: ['*'],
                type: claimReq.type,
                proofType: js_sdk_1.ProofType.Iden3SparseMerkleTreeProof,
                context: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-nonmerklized.jsonld',
                credentialSubject: {
                    documentType: {
                        $eq: 99
                    }
                }
            }
        },
        {
            id: 2,
            circuitId: js_sdk_1.CircuitId.AtomicQueryV3,
            optional: false,
            params: {
                nullifierSessionId: 12345
            },
            query: {
                groupId: 1,
                proofType: js_sdk_1.ProofType.BJJSignature,
                allowedIssuers: ['*'],
                type: 'KYCEmployee',
                context: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v101.json-ld',
                skipClaimRevocationCheck: true,
                credentialSubject: {
                    salary: {
                        $eq: 200
                    }
                }
            }
        },
        {
            id: 3,
            circuitId: js_sdk_1.CircuitId.LinkedMultiQuery10,
            optional: false,
            query: {
                groupId: 1,
                proofType: js_sdk_1.ProofType.Iden3SparseMerkleTreeProof,
                allowedIssuers: ['*'],
                type: 'KYCEmployee',
                skipClaimRevocationCheck: true,
                context: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v101.json-ld',
                credentialSubject: {
                    salary: {
                        $ne: 300
                    }
                }
            }
        }
    ];
    const authReqBody = {
        callbackUrl: 'http://localhost:8080/callback?id=1234442-123123-123123',
        reason: 'reason',
        message: 'mesage',
        scope: proofReqs
    };
    const id = globalThis.crypto.randomUUID();
    const authReq = {
        id,
        typ: js_sdk_1.PROTOCOL_CONSTANTS.MediaType.PlainMessage,
        type: js_sdk_1.PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE,
        thid: id,
        body: authReqBody,
        from: issuerDID.string()
    };
    const msgBytes = js_sdk_1.byteEncoder.encode(JSON.stringify(authReq));
    console.log('=============== auth request ===============');
    const authHandlerRequest = await authHandler.handleAuthorizationRequest(userDID, msgBytes);
    console.log(JSON.stringify(authHandlerRequest, null, 2));
}
module.exports = {
    identityCreation,
    issueCredential,
    generateProofs,
    
  };

//# sourceMappingURL=index.js.map