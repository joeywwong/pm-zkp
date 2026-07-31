# PM-ZKP
This repository contains the prototype developed for my master’s thesis: a dApp for managing ERC-1155 token transfers using verifiable credentials on an EVM-compatible blockchain. Credential holders prove predicates over their data, such as age ≥ 18, using Groth16 zkSNARKs. A verifier smart contract verifies the proofs on-chain and permits ERC-1155 token transfers only after the required proofs have been successfully verified; in other words, transfers are proof-constrained. 

## Tech Stack
- **Frontend:** React.js
- **Backend:** Node.js, Express.js
- **Smart contracts:** Solidity, OpenZeppelin
- **Blockchain technology:** Polygon
- **Development developmemt:** Hardhat
- **Browser wallet:** MetaMask
- **Digital identity:** Privado ID, Verifiable Credentials, Decentralized Identifiers (DIDs), Self-Sovereign Identity (SSI)
- **Database and evaluation:** SQLite for gas-fee and runtime logging
- **Infrastructure:** Docker

Keywords: verifiable credentials, anonymous credentials, zero-knowledge proofs, zkSNARK, Groth16

# PM-contract
## Getting started
The PMNoAdmin.sol is the ERC1155 smart contract contains the logics of the programmable money.
Use the Hardhat 2 project (in folder pm-contract_hardhat2) for contract deployment.
  ```bash
  cd PM-contract_hardhat2
  npx hardhat compile
  npx hardhat run scripts/deploy.ts --network polygon-amoy 
  ```

# PM-website
## Getting started
These instructions will get the development environment up and running on your local machine.

### Prerequisites

- **Node.js**
- **npm**
- **Docker** & **Docker Compose**

### Important Note for MetaMask transactions on Polygon Amoy and mainnet
When sending transactions, set the priority fee slightly above the 12‑hour low (for example, if the recommended fee is 25 gwei, you can pay 30 gwei). Otherwise, most transactions will fail.
See recommended priority fee here: https://docs.polygon.technology/tools/gas/polygon-gas-station/

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
