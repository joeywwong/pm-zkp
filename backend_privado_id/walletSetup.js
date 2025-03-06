"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initInMemoryDataStorage = initInMemoryDataStorage;
exports.initMongoDataStorage = initMongoDataStorage;
exports.initIdentityWallet = initIdentityWallet;
exports.initInMemoryDataStorageAndWallets = initInMemoryDataStorageAndWallets;
exports.initMongoDataStorageAndWallets = initMongoDataStorageAndWallets;
exports.initCredentialWallet = initCredentialWallet;
exports.initCircuitStorage = initCircuitStorage;
exports.initProofService = initProofService;
exports.initPackageManager = initPackageManager;
/* eslint-disable @typescript-eslint/no-non-null-assertion */
const js_jwz_1 = require("@iden3/js-jwz");
const js_sdk_1 = require("@0xpolygonid/js-sdk");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongo_storage_1 = require("@0xpolygonid/mongo-storage");
const mongodb_memory_server_1 = require("mongodb-memory-server");
const mongodb_1 = require("mongodb");
const circuitsFolder = process.env.CIRCUITS_PATH;
const mongoDbConnection = process.env.MONGO_DB_CONNECTION;
function initInMemoryDataStorage({ contractAddress, rpcUrl, chainId }) {
    const conf = {
        ...js_sdk_1.defaultEthConnectionConfig,
        contractAddress,
        url: rpcUrl,
        chainId
    };
    // change here priority fees in case transaction is stuck or processing too long
    // conf.maxPriorityFeePerGas = '250000000000' - 250 gwei
    // conf.maxFeePerGas = '250000000000' - 250 gwei
    const dataStorage = {
        credential: new js_sdk_1.CredentialStorage(new js_sdk_1.InMemoryDataSource()),
        identity: new js_sdk_1.IdentityStorage(new js_sdk_1.InMemoryDataSource(), new js_sdk_1.InMemoryDataSource()),
        mt: new js_sdk_1.InMemoryMerkleTreeStorage(40),
        states: new js_sdk_1.EthStateStorage(conf)
    };
    return dataStorage;
}
async function initMongoDataStorage({ rpcUrl, contractAddress, chainId }) {
    let url = mongoDbConnection;
    if (!url) {
        const mongodb = await mongodb_memory_server_1.MongoMemoryServer.create();
        url = mongodb.getUri();
    }
    const client = new mongodb_1.MongoClient(url);
    await client.connect();
    const db = client.db('mongodb-sdk-example');
    const conf = {
        ...js_sdk_1.defaultEthConnectionConfig,
        chainId,
        contractAddress,
        url: rpcUrl
    };
    const dataStorage = {
        credential: new js_sdk_1.CredentialStorage(await (0, mongo_storage_1.MongoDataSourceFactory)(db, 'credentials')),
        identity: new js_sdk_1.IdentityStorage(await (0, mongo_storage_1.MongoDataSourceFactory)(db, 'identity'), await (0, mongo_storage_1.MongoDataSourceFactory)(db, 'profile')),
        mt: await mongo_storage_1.MerkleTreeMongodDBStorage.setup(db, 40),
        states: new js_sdk_1.EthStateStorage(conf)
    };
    return dataStorage;
}
async function initIdentityWallet(dataStorage, credentialWallet, keyStore) {
    const bjjProvider = new js_sdk_1.BjjProvider(js_sdk_1.KmsKeyType.BabyJubJub, keyStore);
    const kms = new js_sdk_1.KMS();
    kms.registerKeyProvider(js_sdk_1.KmsKeyType.BabyJubJub, bjjProvider);
    const credentialStatusPublisherRegistry = new js_sdk_1.CredentialStatusPublisherRegistry();
    credentialStatusPublisherRegistry.register(js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof, new js_sdk_1.Iden3SmtRhsCredentialStatusPublisher());
    return new js_sdk_1.IdentityWallet(kms, dataStorage, credentialWallet, {
        credentialStatusPublisherRegistry
    });
}
async function initInMemoryDataStorageAndWallets(config) {
    const dataStorage = initInMemoryDataStorage(config);
    const credentialWallet = await initCredentialWallet(dataStorage);
    const memoryKeyStore = new js_sdk_1.InMemoryPrivateKeyStore();
    const identityWallet = await initIdentityWallet(dataStorage, credentialWallet, memoryKeyStore);
    return {
        dataStorage,
        credentialWallet,
        identityWallet
    };
}
async function initMongoDataStorageAndWallets(config) {
    const dataStorage = await initMongoDataStorage(config);
    const credentialWallet = await initCredentialWallet(dataStorage);
    const memoryKeyStore = new js_sdk_1.InMemoryPrivateKeyStore();
    const identityWallet = await initIdentityWallet(dataStorage, credentialWallet, memoryKeyStore);
    return {
        dataStorage,
        credentialWallet,
        identityWallet
    };
}
async function initCredentialWallet(dataStorage) {
    const resolvers = new js_sdk_1.CredentialStatusResolverRegistry();
    resolvers.register(js_sdk_1.CredentialStatusType.SparseMerkleTreeProof, new js_sdk_1.IssuerResolver());
    resolvers.register(js_sdk_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof, new js_sdk_1.RHSResolver(dataStorage.states));
    resolvers.register(js_sdk_1.CredentialStatusType.Iden3OnchainSparseMerkleTreeProof2023, new js_sdk_1.OnChainResolver([js_sdk_1.defaultEthConnectionConfig]));
    resolvers.register(js_sdk_1.CredentialStatusType.Iden3commRevocationStatusV1, new js_sdk_1.AgentResolver());
    return new js_sdk_1.CredentialWallet(dataStorage, resolvers);
}
async function initCircuitStorage() {
    console.log("circuit folder path is: ");
    console.log(path_1.default.join(__dirname, circuitsFolder));
    return new js_sdk_1.FSCircuitStorage({
        dirname: path_1.default.join(__dirname, circuitsFolder)
    });
}
async function initProofService(identityWallet, credentialWallet, stateStorage, circuitStorage) {
    return new js_sdk_1.ProofService(identityWallet, credentialWallet, circuitStorage, stateStorage, {
        ipfsGatewayURL: 'https://ipfs.io'
    });
}
async function initPackageManager(circuitData, prepareFn, stateVerificationFn) {
    const authInputsHandler = new js_sdk_1.DataPrepareHandlerFunc(prepareFn);
    const verificationFn = new js_sdk_1.VerificationHandlerFunc(stateVerificationFn);
    const mapKey = js_jwz_1.proving.provingMethodGroth16AuthV2Instance.methodAlg.toString();
    const verificationParamMap = new Map([
        [
            mapKey,
            {
                key: circuitData.verificationKey,
                verificationFn
            }
        ]
    ]);
    const provingParamMap = new Map();
    provingParamMap.set(mapKey, {
        dataPreparer: authInputsHandler,
        provingKey: circuitData.provingKey,
        wasm: circuitData.wasm
    });
    const mgr = new js_sdk_1.PackageManager();
    const packer = new js_sdk_1.ZKPPacker(provingParamMap, verificationParamMap);
    const plainPacker = new js_sdk_1.PlainPacker();
    mgr.registerPackers([packer, plainPacker]);
    return mgr;
}
//# sourceMappingURL=walletSetup.js.map