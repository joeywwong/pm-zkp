import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const {
    UNIVERSAL_VERIFIER,
    INITIAL_OWNER,
    BASE_URI
  } = process.env;

  if (!UNIVERSAL_VERIFIER) throw new Error("UNIVERSAL_VERIFIER missing");
  if (!INITIAL_OWNER) throw new Error("INITIAL_OWNER missing");
  if (!BASE_URI) throw new Error("BASE_URI missing");

  const PMNoAdmin = await ethers.getContractFactory("PMNoAdmin");
  console.log("Deploying PMNoAdmin...");
  const contract = await PMNoAdmin.deploy(
    UNIVERSAL_VERIFIER,
    INITIAL_OWNER,
    BASE_URI
  );
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("PMNoAdmin deployed at:", address);
  console.log("Constructor args (for verification):");
  console.log([
    UNIVERSAL_VERIFIER,
    INITIAL_OWNER,
    BASE_URI
  ]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});