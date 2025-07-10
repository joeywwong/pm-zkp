# PM-website

## Getting started

These instructions will get the development environment up and running on your local machine.

### Prerequisites

- **Node.js**
- **npm**
- **Docker** & **Docker Compose**

### Setup Steps
1. **Build and start all services**  
   This single command will:
   - Install dependencies for the **frontend**, **backend**, and **iden3_repo**
   - Compile your Hardhat contracts in iden3_repo
   - Launch both client (port 3000) and server (port 5000)  
   ```bash
   docker-compose -f docker-compose.dev.yml up --build

## TODO

- [x] Connect with MetaMask
- [ ] Login with MetaMask (sign a nonce)
- [x] Show all programmable money owned
- [x] Mint token
- [x] Transfer programmable money
- [x] Display spending conditions before token transfer
- [x] Generate a link for proof verification if ZKP is not verified
- [x] Submit proof request to verifier contract
  - [x] Frontend calls POST (with credentials schema, attribute and value, e.g. birthday > 19900101) to ask backend to compute proof request payload 
  - [x] Compute proof request payload using the script from iden3’s repository and the Go script inside, and host the service on the backend
  - [x] Frontend uses the payload returns from POST to submit a proof request to Privado's verifier contract (via Metamask)
- [x] Submit a spending condition for a token (the proof request and the prover’s address) to the 
PM contract
- [x] One button to Submit proof request to verifier contract and PM contract
- [ ] Remove spending conditions

### GUI fix
- [x] Integrate a React UI library (e.g., Material-UI) and refactor basic HTML elements to styled components
- [x] One button to Submit proof request to verifier contract and PM contract
- [x] Combine 'mint new token' and 'mint existing token'
- [x] Let user choose who must submit proof (sender / receiver) via dropdown, instead of manually entering a prover address
- [ ] Update token balances after minting token
- [ ] Reminder after transaction success
- [x] Show spending conditions above transfer button, e.g. birthday before 20250101
- [x] Show token names over ID

### Evaluation
- [ ] Record transaction gas fees in the database



