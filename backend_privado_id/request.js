"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRequestData = generateRequestData;
const js_sdk_1 = require("@0xpolygonid/js-sdk");
const js_jsonld_merklization_1 = require("@iden3/js-jsonld-merklization");
const pathToCredentialSubject = 'https://www.w3.org/2018/credentials#credentialSubject';
async function generateRequestData() {
    const url = `https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v101.json-ld`;
    const type = 'KYCAgeCredential';
    const fieldName = 'birthday'; // in form of field.field2.field3 field must be present in the credential subject
    const opts = { ipfsGatewayURL: 'https://ipfs.io' }; // can be your IFPS gateway if your work with ipfs schemas or empty object
    const ldCtx = (await (0, js_jsonld_merklization_1.getDocumentLoader)(opts)(url)).document;
    const ldJSONStr = JSON.stringify(ldCtx);
    // const ldBytes = byteEncoder.encode(ldJSONStr);
    const typeId = await js_jsonld_merklization_1.Path.getTypeIDFromContext(ldJSONStr, type);
    const schemaHash = (0, js_sdk_1.createSchemaHash)(js_sdk_1.byteEncoder.encode(typeId));
    console.log('schemaId', schemaHash.bigInt().toString());
    // you can use custom IPFS
    const path = await js_jsonld_merklization_1.Path.getContextPathKey(ldJSONStr, type, fieldName, opts);
    path.prepend([pathToCredentialSubject]);
    const pathBigInt = await path.mtEntry();
    console.log('path', pathBigInt.toString());
    // you can hash the value according to the datatype (that's how it is stored in core claim structure)
    const fieldInfo = {
        pathToField: 'KYCEmployee.position',
        value: 'developer'
    };
    const datatype = await js_jsonld_merklization_1.Path.newTypeFromContext(ldJSONStr, fieldInfo.pathToField);
    console.log(datatype); // make sure it is http://www.w3.org/2001/XMLSchema#string
    const hashedValue = await js_jsonld_merklization_1.Merklizer.hashValue(datatype, fieldInfo.value);
    console.log(hashedValue);
}
//# sourceMappingURL=request.js.map