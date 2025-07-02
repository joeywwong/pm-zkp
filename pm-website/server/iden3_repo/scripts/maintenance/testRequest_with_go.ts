import hre, { ethers } from "hardhat";
import { packV3ValidatorParams, packValidatorParams } from "../../test/utils/validator-pack-utils";
import { calculateQueryHashV2, calculateQueryHashV3 } from "../../test/utils/query-hash-utils";
import { Blockchain, DidMethod, NetworkId, DID } from "@iden3/js-iden3-core";
import { buildVerifierId } from "../deploy/deployCrossChainVerifierWithRequests";
import { byteEncoder, CircuitId, Operators } from "@0xpolygonid/js-sdk";
import { contractsInfo } from "../../helpers/constants";
import { Hex } from "@iden3/js-crypto";
import { getChainId } from "../../helpers/helperUtils";
import { execSync, execFileSync  } from "child_process";
import path from "path";
import fs from "fs";

export function getAuthV2RequestId(): number {
  const circuitHash = ethers.keccak256(byteEncoder.encode(CircuitId.AuthV2));
  const dataView = new DataView(Hex.decodeString(circuitHash.replace("0x", "")).buffer);
  const id = dataView.getUint32(0);
  return id;
}

export async function main(type: string, attribute: string, schemaOrRaw: string) {
  // Log incoming parameters
  console.log('Arg #1 (type):', type);
  console.log('Arg #2 (attribute):', attribute);
  console.log('Arg #3 (schema/raw):', schemaOrRaw.slice(0, 100) + (schemaOrRaw.length > 100 ? '...' : ''));

  // Determine if schemaOrRaw is a file path or JSON string
  const isRawJson = schemaOrRaw.trim().startsWith('{');
  const rawJson = isRawJson
    ? schemaOrRaw
    : fs.readFileSync(schemaOrRaw, 'utf-8');

  console.log('▶️ [TASK] Using schema JSON length:', rawJson.length);

  // Resolve the Go binary path
  const goBinary = path.resolve(
    __dirname,
    '..',
    '..',
    'bin',
    process.platform === 'win32' ? 'schema-tool.exe' : 'schema-tool'
  );

  // Prepare arguments: schema-tool <type> <rawJson> <attribute>
  const args = [type, rawJson, attribute];
  console.log('▶️ [TASK] Invoking schema-tool with args:', [type, '<JSON payload>', attribute]);

  // Invoke the Go binary without shell interpolation
  let goOut: string;
  try {
    goOut = execFileSync(goBinary, args, {
      encoding: 'utf-8',
      maxBuffer: 20_000_000,
    });
    console.log('✅ schema-tool stdout:\n', goOut);
  } catch (err: any) {
    console.log('❌ schema-tool failed:', err.stderr ?? err.message);
    throw err;
  }

  // Parse output lines for BigInt and claim path key
  const lines = goOut.trim().split('\n');
  const schemaBigInt = lines[1];
  const schemaClaimPathKey = lines[3];

  const circuitName: CircuitId = CircuitId.AtomicQuerySigV2OnChain; // TODO put your circuit here;
  let requestId = 2025070102; // TODO put your request here;
  const allowedIssuers = []; // TODO put your allowed issuers here

  const chainId = await getChainId();
  //const network = hre.network.name;
  const network = "polygon-amoy";
  console.log("network: ", network);

  const methodId = "ade09fcd";

  const verifier = await ethers.getContractAt(
    contractsInfo.UNIVERSAL_VERIFIER.name,
    contractsInfo.UNIVERSAL_VERIFIER.unifiedAddress,
  );

  const verifierId = buildVerifierId(await verifier.getAddress(), {
    blockchain: Blockchain.Polygon,
    networkId: NetworkId.Amoy,
    method: DidMethod.Iden3,
  });

  // you can run https://go.dev/play/p/oB_oOW7kBEw to get schema hash and claimPathKey using YOUR schema
  //const schemaBigInt = "74977327600848231385663280181476307657";

  // merklized path to field in the W3C credential according to JSONLD  schema e.g. birthday in the KYCAgeCredential under the url "https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v3.json-ld"
  //const schemaClaimPathKey = "20376033832371109177683048456014525905119173674985843915445634726167450989630";
    //this one is for birthday
    //"20376033832371109177683048456014525905119173674985843915445634726167450989630";
    //this one is for documentType
    //"17040667407194471738958340146498954457187839778402591036538781364266841966";
    
  let query: any = {
    requestId: requestId,
    schema: schemaBigInt,
    claimPathKey: schemaClaimPathKey,
    operator: Operators.LT,
    slotIndex: 0,
    queryHash: "",
    value: [20250101, ...new Array(63).fill(0)], // for operators 1-3 only first value matters
    circuitIds: [circuitName],
    skipClaimRevocationCheck: false,
    claimPathNotExists: 0,
  };

  let validatorAddress: string;
  let data: string;
  switch (circuitName) {
    case CircuitId.AtomicQueryMTPV2OnChain:
      validatorAddress = contractsInfo.VALIDATOR_MTP.unifiedAddress;
      query.queryHash = calculateQueryHashV2(
        query.value,
        query.schema,
        query.slotIndex,
        query.operator,
        query.claimPathKey,
        query.claimPathNotExists,
      ).toString();
      data = packValidatorParams(query);

      break;
    case CircuitId.AtomicQuerySigV2OnChain:
      validatorAddress = contractsInfo.VALIDATOR_SIG.unifiedAddress;
      query.queryHash = calculateQueryHashV2(
        query.value,
        query.schema,
        query.slotIndex,
        query.operator,
        query.claimPathKey,
        query.claimPathNotExists,
      ).toString();
      data = packValidatorParams(query);
      break;
    case CircuitId.AtomicQueryV3OnChain:
      validatorAddress = contractsInfo.VALIDATOR_V3.unifiedAddress;
      query = {
        ...query,
        allowedIssuers: allowedIssuers,
        verifierID: verifierId.bigInt(),
        nullifierSessionID: 11837215,
        groupID: 0,
        proofType: 0,
      };

      query.queryHash = calculateQueryHashV3(
        query.value.map((i) => BigInt(i)),
        query.schema,
        query.slotIndex,
        query.operator,
        query.claimPathKey,
        1, //queryV3KYCAgeCredential.value.length, // for operator NE, LT it should be 1 for value
        1, // merklized
        query.skipClaimRevocationCheck ? 0 : 1,
        query.verifierID.toString(),
        query.nullifierSessionID,
      ).toString();
      data = packV3ValidatorParams(query);

      break;

    case CircuitId.AuthV2:
      validatorAddress = contractsInfo.VALIDATOR_AUTH_V2.unifiedAddress;
      data = "0x";
      requestId = getAuthV2RequestId();
      break;
    default:
      throw new Error(`Unsupported circuit name: ${circuitName}`);
  }
  
  const invokeRequestMetadataKYCAgeCredential = {
    id: "7f38a193-0918-4a48-9fac-36adfdb8b543",
    typ: "application/iden3comm-plain-json",
    type: "https://iden3-communication.io/proofs/1.0/contract-invoke-request",
    thid: "7f38a193-0918-4a48-9fac-36adfdb8b543",
    from: DID.parseFromId(verifierId).string(),
    body: {
      reason: "for receiver",
      transaction_data: {
        contract_address: await verifier.getAddress(),
        method_id: methodId,
        chain_id: chainId,
        network: network,
      },
      scope: [
        {
          id: requestId,
          circuitId: circuitName,
          query: {
            allowedIssuers: !allowedIssuers.length ? ["*"] : allowedIssuers,
            context:
              "https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v3.json-ld",
            credentialSubject: {
              birthday: {
                $lt: 20250101,
              },
            },
            type: "KYCAgeCredential",
          },
        },
      ],
    },
  };

  const requestIdExists = await verifier.requestIdExists(requestId);
  if (requestIdExists) {
    throw new Error(`Request ID: ${requestId} already exists`);
  }

  /*
  const tx = await verifier.setZKPRequest(
    requestId,
    {
      metadata:
        circuitName === CircuitId.AuthV2
          ? "0x"
          : JSON.stringify(invokeRequestMetadataKYCAgeCredential),
      validator: validatorAddress,
      data,
    },
    // {
    //   gasPrice: 50000000000,
    //   initialBaseFeePerGas: 25000000000,
    //   gasLimit: 10000000,
    // },
  );
*/

  console.log("schemaBigInt: ", schemaBigInt);
  console.log("schemaClaimPathKey: ", schemaClaimPathKey);

  if (attribute === "birthday") {
    if (schemaBigInt ==="74977327600848231385663280181476307657") {
      console.log("This is the correct schemaBigInt");
    } 
    else {
      console.log("This is NOT the correct schemaBigInt");
    }
    if (schemaClaimPathKey === "20376033832371109177683048456014525905119173674985843915445634726167450989630") {
      console.log("This is the correct schemaClaimPathKey");
    }
    else {
      console.log("This is NOT the correct schemaClaimPathKey");
    }
  console.log("requestId: ", requestId);
  console.log(JSON.stringify(invokeRequestMetadataKYCAgeCredential, null, "\t"));
  console.log("validator: ", validatorAddress);
  console.log("data: ", data);
  
  const payload = {
    requestId,
    metadata: invokeRequestMetadataKYCAgeCredential,
    validatorAddress,
    data
  };

  console.log(JSON.stringify(payload));
  //console.log(`Request ID: ${requestId} is set in tx: ${tx.hash}`);
}
}

const [, , , , , type, attribute, schema] = process.argv;

if (!type || !attribute || !schema) {
  console.log("Usage: npx hardhat testRequest_with_go <type> <attribute> <schemaJson>");
  process.exit(1);
}

main(type, attribute, schema)
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
