# PM-website

## Getting started

These instructions will get the development environment up and running on your local machine.

### Prerequisites

- **Node.js**
- **npm**
- **Docker** & **Docker Compose**

### (Important) Note for MetaMask transactions on Polygon Amoy

The development build uses Polygon Amoy. When sending transactions, set the priority fee slightly above the 12‑hour low (for example, around 27 gwei). Otherwise, most transactions will fail.

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
- [x] Remove spending conditions

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
  -[x] make the token details card full screen, to show more details.
  -[x] put a 'x button' for closing the token details card, to replace the previous 'close' button
  -[x] make the row of the token name and 'x' button blue, like a 'window bar', for better user experience
  -[x] put the spending conditions status (the url for proof submission url, etc.) on the right (previously there are below the amount box), so that users don't need to scroll down to see them 
  -[x] each spending condition is shown in a grey box, to separate them from background
  -[x] change the color scheme of the remove button
  -[x] put the remove spending condition button close to each spending condition 
  -[x] if transfer success, show the transfer successful message and make the message box green
  -[x] disable transfer button if the money receiver address and amount are not entered
  -[x] change 'verified' text color to green or red depending on conditions verified or not, to improve user experience
### Evaluation
- [x] Record transaction gas fees in the database



