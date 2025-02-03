### Programmable Money Transaction Conditioned on Verifiable Credentials via Zero-Knowledge Proofs

#### 1. Overview
This repository demostrates the workflow of a programmable money transaction that is conditioned on verifiable credentials via zero-knowledge proofs (ZKP). Initially, an entity (e.g., the issuer or credentials schema manager) defines the credentials format (e.g. data type, default value). The user then requests these credentials. After the issuer attests to the validity of the user's identity and personal information, the credentials are issued. When a programmable money transaction is initiated, the credentials holder generates a zero-knowledge proof based on the credentials. The credentials verifier checks the validity of the credentials and verifies the proof, approving the transaction only if the credentials are valid and the attributes in the proof satisfy the predefined condition (e.g., age over 18). This approach ensures that transactions are initiated only with valid and verified credentials that satisfy the predefined spending conditions, while the verifier learns nothing beyond the fact that the credentials holder meets the spending condition, thereby maintaining both security and privacy.
For a simple illustration of the workflow, see the activity diagram.

**Actors Involved:**

- **Credentials Issuer:**  
  The trusted authority responsible for verifying user identity and personal infos, and issuing verifiable credentials. Depending on the use cases, the issuer can also define the credential formats. 
  
- **User (Credentials Holder):**  
  The individual who requests credentials, receives attestation, and later generates zero-knowledge proofs from the credentials for a programmable money transaction.
  
- **Credentials Verifier:**  
  A component (integrated into a smart contract or implemented off-chain) that validates the generated ZKP without revealing underlying sensitive data.
  
- **(Optional) Regulatory Authority:**  
  An external body that may audit processes for compliance, ensuring that privacy and security standards are maintained.

- **(Optional) Credentials Schema Manager:**  
  An actor responsible for creating and defining the credentials format (e.g., designing the structure, data types, and default values) and publishing these definitions (e.g., via IPFS) for reference during credential issuance and proof verification. Although optional, when present, the Credentials Schema Manager helps ensure that credential formats remain consistent and interoperable across the system.

---

#### 2. Preconditions

- **Credential Definition:**  
  The issuer must pre-define the formats for credentials (e.g., integer for age, float for health data like blood glucose or BMI, boolean for binary attributes like smoker/non-smoker, the default values of the attributes) to ensure consistency and proper interpretation across the system.

- **Possession of Valid Credentials:**  
  The user must have valid credentials issued by a trusted authority before any money transaction or proof generation can occur.

- **System Setup:**  
  The digital wallet must be compatible with the credentials, and all system components (smart contracts, front-end, back-end, etc.) must be operational.
---

#### 3. Main Workflow (Happy Path)

1. **Credential Definition and Creation (e.g. by issuer):**  
   - **Step:** The issuer creates and defines the variables in the credentials with appropriate data types.  
   - **Details:**  
     - Define credential attributes (e.g., `age` as an integer, `blood_glucose` as a float, `is_smoker` as a boolean).  
     - Store these definitions securely (publish to IPFS) for reference during credential issuance and (proof verification?).
   - **Rule:**  
     - Credential formats must adhere to system standards to ensure consistent interpretation during subsequent proof generation and verification.

2. **Credential Request:**  
   - **Step:** The user requests the issuance of credentials.
   - **Details:**  
     - The user sends a request to the issuer indicating which credentials are required.
   - **Rule:**  
     - The request must include necessary identification details, ensuring that the issuer can accurately verify the user’s identity.

3. **Issuer Attestation and Credential Issuance:**  
   - **Step:** The issuer attest the user's identity and personal information.
   - **Details:**  
     - Perform identity attestation using available data or supporting documents.
     - Upon successful verification, issue the verifiable credentials to the user in the predefined format.
   - **Rule:**  
     - Credentials are issued only if the attestation confirms the user’s identity and meets any additional regulatory or system requirements.

4. **Transaction Initiation:**  
   - **Step:** With valid credentials in hand, a programmable money transaction is initiated (by credentials holder or verifier).
   - **Details:**  
     - The transaction request specifies the spending conditions, where the credentials holder must meet certain spending criteria (e.g., age over 18).
   - **Rule:**  
     - The spending conditions must align with the credentials format.

5. **Proof Submission and Verification:**  
   - **Step:** The holder generates zero-knowledge proof and submits it to the verifier.
   - **Details:**  
     - The verifier checks the proof against the predefined conditions required for the transaction.
   - **Rule:**  
     - The transaction proceeds only if the proof is valid and meets all the specified conditions.

6. **Transaction Execution:**  
   - **Step:** Upon successful proof verification, the programmable money transaction is executed on the distributed ledger.
   - **Details:**  
     - The smart contract handles the transfer of funds and updates the ledger immutably.
   - **Rule:**  
     - The smart contract enforces all transaction conditions, ensuring that only authorized transactions are executed.

---

#### 4. Exception Handling

- **Credential Request Failure:**  
  - **Trigger:** If the user’s credential request does not contain the required documents for attestation.
  - **Response:** The issuer rejects the request, and the user is notified to correct or resubmit the necessary information.

- **Attestation Failure:**  
  - **Trigger:** If the issuer cannot verify the user's identity, e.g. invalid supporting documents.
  - **Response:** The credential issuance is halted, and the user is advised to provide additional documentation or clarification.

- **Proof Verification Failure:**  
  - **Trigger:** If the proof verification fails due to absence of the required credentials or spending conditions not satisified.
  - **Response:** The transaction is aborted, and the user is informed about the failure, prompting a re-generation of the proof after verifying the credentials.
---

#### 5. Rules and Constraints

- **Credential Consistency:**  
  All credential definitions must follow a standardized format to ensure interoperability across the system.
  
- **Privacy and Security:**  
  At no point should sensitive user data be exposed. The zero-knowledge proof mechanism must guarantee that only the statement being proved (e.g., age over 18) is revealed without disclosing actual values.
