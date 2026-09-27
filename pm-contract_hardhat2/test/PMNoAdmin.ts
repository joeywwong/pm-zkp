import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("PMNoAdmin prover-role getter", function () {
  async function deployFixture() {
    const [owner, tokenOwner, admin, outsider] = await hre.ethers.getSigners();

    const MockUniversalVerifier = await hre.ethers.getContractFactory(
      "MockUniversalVerifier"
    );
    const verifier = await MockUniversalVerifier.deploy();

    const PMNoAdmin = await hre.ethers.getContractFactory("PMNoAdmin");
    const pm = await PMNoAdmin.deploy(
      await verifier.getAddress(),
      owner.address,
      "https://example.test/token/{id}.json"
    );

    await pm
      .connect(tokenOwner)
      .mintToken(tokenOwner.address, 1, "0x", "Test token");
    const [tokenID] = await pm.allTokenIDs();

    await pm.connect(tokenOwner).addProofRequest_VerifierAndPM(
      101,
      "test request",
      hre.ethers.ZeroAddress,
      "0x",
      tokenID,
      "sender",
      {
        attribute: "birthday",
        operatorStr: "$lt",
        value: "20000101",
      }
    );

    await pm.connect(owner).addAdmin(admin.address);

    return { pm, tokenID, owner, tokenOwner, admin, outsider };
  }

  it("returns the stored role to the condition owner", async function () {
    const { pm, tokenID, tokenOwner } = await loadFixture(deployFixture);

    expect(
      await pm
        .connect(tokenOwner)
        .tokenID_requestSetter_proofRequest_role(
          tokenID,
          tokenOwner.address,
          101
        )
    ).to.equal("sender");
  });

  it("allows the contract owner and admins to inspect the role", async function () {
    const { pm, tokenID, owner, tokenOwner, admin } = await loadFixture(
      deployFixture
    );

    expect(
      await pm
        .connect(owner)
        .tokenID_requestSetter_proofRequest_role(
          tokenID,
          tokenOwner.address,
          101
        )
    ).to.equal("sender");
    expect(
      await pm
        .connect(admin)
        .tokenID_requestSetter_proofRequest_role(
          tokenID,
          tokenOwner.address,
          101
        )
    ).to.equal("sender");
  });

  it("rejects unrelated callers", async function () {
    const { pm, tokenID, tokenOwner, outsider } = await loadFixture(
      deployFixture
    );

    await expect(
      pm
        .connect(outsider)
        .tokenID_requestSetter_proofRequest_role(
          tokenID,
          tokenOwner.address,
          101
        )
    ).to.be.revertedWith("Not authorized");
  });

  it("keeps the configured MetaMask account as owner", async function () {
    const { pm, owner } = await loadFixture(deployFixture);

    expect(await pm.owner()).to.equal(owner.address);
    expect(await pm.pendingOwner()).to.equal(hre.ethers.ZeroAddress);
  });

  it("disables ownership renunciation", async function () {
    const { pm, owner } = await loadFixture(deployFixture);

    await expect(pm.connect(owner).renounceOwnership()).to.be.revertedWithCustomError(
      pm,
      "OwnershipRenunciationDisabled"
    );
    expect(await pm.owner()).to.equal(owner.address);
  });

  it("requires the proposed owner to accept an ownership transfer", async function () {
    const { pm, owner, outsider } = await loadFixture(deployFixture);

    await pm.connect(owner).transferOwnership(outsider.address);
    expect(await pm.owner()).to.equal(owner.address);
    expect(await pm.pendingOwner()).to.equal(outsider.address);

    await pm.connect(outsider).acceptOwnership();
    expect(await pm.owner()).to.equal(outsider.address);
    expect(await pm.pendingOwner()).to.equal(hre.ethers.ZeroAddress);
  });
});
