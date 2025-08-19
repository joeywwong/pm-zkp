# PM-ZKP
This repository contains my master’s thesis project: a dApp that manage ERC-1155 token transfer, and verifiable credentials on an EVM chain. Credentials holders prove predicates over their data (e.g., age ≥ 18) using zkSNARKs (Groth16), and a Verifier smart contract verify the proofs on-chain and only then permits ERC-1155 token transfers—i.e., transfers are proof-constrained. Tech stack: React.js + MetaMask for frontend, Express.js for backend, SQLite for database of gas/runtime logging, Solidity for smart contracts, Privado ID for verifiable credentials, decentralized identity (DID), self-sovereign identity (SSI), Docker for containerization.

Keywords: verifiable credentials, anonymous credentials, zero-knowledge proofs, zkSNARK, Groth16

## Project Status
This project is under active development.  
See [TODO.md](./TODO.md) for the current development roadmap and pending tasks.

# PM-website
## Getting started
These instructions will get the development environment up and running on your local machine.

### Prerequisites

- **Node.js**
- **npm**
- **Docker** & **Docker Compose**

### Important Note for MetaMask transactions on Polygon Amoy and mainnet
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