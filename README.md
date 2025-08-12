# PM-ZKP
This repository contains my master’s thesis project: a dApp that manage ERC-1155 token transfer, and verifiable credentials (or anonymous credentials) on an EVM chain. Credentials holders prove predicates over their data (e.g., age ≥ 18) using zkSNARKs (Groth16), and a Verifier smart contract verify the proofs on-chain and only then permits ERC-1155 token transfers—i.e., transfers are proof-constrained. Stack: React + MetaMask for frontend, Express.js for backend, SQLite for gas/runtime logging, Solidity for smart contracts.

Crypto building blocks: anonymous credentials, zero-knowledge proofs, zkSNARK, Groth16, Poseidon hash function
# PM-website
## Getting started
These instructions will get the development environment up and running on your local machine.

### Prerequisites

- **Node.js**
- **npm**
- **Docker** & **Docker Compose**

### (Important) Note for MetaMask transactions on Polygon Amoy and mainnet
The development build uses Polygon Amoy. When sending transactions, set the priority fee slightly above the 12‑hour low (for example, around 30 gwei). Otherwise, most transactions will fail.

### Setup Steps for PM-website
1. **Build and start the dev build of PM-website** 
  ```bash
  cd pm-website
  ./run-dev.sh
  ```

   The `docker-compose` command is in the script `run-dev.sh` for convenience. Running this will:
   - Install dependencies for the **frontend**, **backend**, and **iden3_repo**  
   - Compile your Hardhat contracts in **iden3_repo**  
   - Launch both client (port 3013) and server (port 5000)  

# Tx fee history website
Shows the tx fee of the past 24H, 30H, 1Y, and all time.
Test it on http://localhost:5010/chart.html

# Privado ID Issuer Node UI (the website for credentials issuance)
To build the issuer website, clone :
https://github.com/0xPolygonID/issuer-node

and refer to the official documentation:
https://docs.privado.id/docs/issuer/setup-issuer-ui/

## TODO
### Final report
- [ ] Check if the credentials schemas (or their digests) are stored on blockchain or not
- [ ] Diagrams, flowcharts (e.g. the UML diagrams in the folder 'docs') for the dApp

### PM smart contract
- [x] One function for submitting proof request to both verifier contract and PM contract with one transaction
- [x] One function for minting new token or existing token, instead of two functions
- [x] A variable to store spending conditions for each token, so GUI can show them
- [x] Spending conditions is for money sender or receiver, not for a specific address, so in GUI user can select if sender or receiver is the prover, not inputing the prover's address
- [ ] Remove variables which save sensitive infomation

### GUI fix
- [x] Integrate a React UI library (e.g., Material-UI) and refactor basic HTML elements to styled components
- [x] One button to Submit proof request to verifier contract and PM contract
- [x] Combine 'mint new token' and 'mint existing token'
- [x] Let user choose who must submit proof (sender / receiver) via dropdown, instead of manually entering a prover address
- [x] Update token balances after minting token
- [x] Update spending conditions on list of money after setting it
- [x] Reminder after successful money transfer
- [x] Show spending conditions above transfer button, e.g. birthday before 20250101
- [x] Show token names over ID
- [x] Redesign the layout of the token details card, to show more proof status and for better user experience and usability:
  - [x] make the token details card full screen, to show more details.
  - [x] put a 'x button' for closing the token details card, to replace the previous 'close' button
  - [x] make the row of the token name and 'x' button blue, like a 'window bar', for better user experience
  - [x] put the spending conditions status (the url for proof submission url, etc.) on the right (previously there are below the amount box), so that users don't need to scroll down to see them 
  - [x] each spending condition is shown in a grey box, to separate them from background
  - [x] change the color scheme of the remove button
  - [x] put the remove spending condition button close to each spending condition 
  - [x] if transfer success, show the transfer successful message and make the message box green
  - [x] disable transfer button if the money receiver address and amount are not entered
  - [x] change 'verified' text color to green or red depending on conditions verified or not, to improve user experience
- [x] Make the credential schemas box as a 'combo box (also called autocomplete in React)' like the token name box in the minting section, so users can choose from some predefined credential schemas
- [x] Put the minting and the addition of spending condition function in other pages, and add buttons navigate to them
- [ ] Add 2 to 3 more credentials schemas in the dropdown list, with name, semantics, easy for user to understand, not URL.
- [ ] Add hints on how to enter the value (e.g. for birthday it is entered as yyyymmdd, not the German format dd.mm.yyyy)
- [ ] Guidance for user to submit proof before transaction, e.g. 'please provide proof by the following link, etc.'. Don't use the error message 'transaction failed.'
- [ ] Add a hint like 'after submitting proof, click transfer button again'
- [ ] 'List of programmable tokens', not 'List of programmable money'.
- [ ] Tx history for each spending condition (can be stored locally as a log file)
- [ ] Show spending condition status on LHS
- [ ] Add text 'The following spending conditions apply to this token (name and id)'

### Website functionalities
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
- [x] Submit a spending condition for a token (the proof request and the prover’s address) to the PM contract
- [x] One button to Submit proof request to verifier contract and PM contract with one Metamask transaction
- [x] Remove spending conditions
- [x] Get the estsimated gas fee from Polygon's gas oracle (https://docs.polygon.technology/tools/gas/polygon-gas-station/)
- [x] Programmatically set the transaction fee paid by Metamask to the estimated gas fee

### Database for logging
- [ ] Save sensitve info (e.g. spending condition 'birthday < 19901231) on DB, instead of smart contract/blockchain, and use request id as the key of the spending conditions

### Evaluation
- [x] Record transaction gas fees in the database
- [x] Plot the tx fee statistics, show it in fiat, e.g. Euro (coin price fetched from coingecko's api)
- [ ] Write some conclusions for the tx fee
- [ ] Record proof generation time using Selenium, or record the proof generation time of Privado ID's JS-SDK