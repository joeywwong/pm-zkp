// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155} from '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import {PrimitiveTypeUtils} from '@iden3/contracts/lib/PrimitiveTypeUtils.sol';
import {ICircuitValidator} from '@iden3/contracts/interfaces/ICircuitValidator.sol';
import {EmbeddedZKPVerifier} from '@iden3/contracts/verifiers/EmbeddedZKPVerifier.sol';
import {UniversalVerifier} from '@iden3/contracts/verifiers/UniversalVerifier.sol';

contract PMUniversalVerifier is ERC1155, Ownable {
    address[] private admins;

    // Getter function for the admins array, only callable by the owner.
    function getAdmins() public view onlyOwner returns (address[] memory) {
        return admins;
    }

    // Internal helper function to check if an address is an admin.
    function _isAdmin(address _admin) internal view returns (bool) {
        for (uint i = 0; i < admins.length; i++) {
            if (admins[i] == _admin) {
                return true;
            }
        }
        return false;
    }

    // Function to add an admin address. Only the owner can add.
    function addAdmin(address _admin) public onlyOwner {
        require(_admin != address(0), "Invalid address");
        require(!_isAdmin(_admin), "Address is already an admin");
        admins.push(_admin);
    }

    // Function to remove an admin address. Only the owner can remove.
    function removeAdmin(address _admin) public onlyOwner {
        uint len = admins.length;
        for (uint i = 0; i < len; i++) {
            if (admins[i] == _admin) {
                admins[i] = admins[len - 1];
                admins.pop();
                return;
            }
        }
        revert("Admin not found");
    }

    // Modifier to restrict functions to only addresses in the admin list.
    modifier onlyAdmin() {
        require(_isAdmin(msg.sender), "Caller is not an admin");
        _;
    }

   // Mapping from proof_request_id to a wallet address, which is the prover's address.
   // Backend can send the proof request to sender, receiver or a third-party prover according to the address.
    mapping(uint64 => address) public proofRequestsAndAddress;

    // An array to store proof_request_ids only for iteration.
    uint64[] public proofRequestIds;

    // Add a new proof request and the corresponding prover's address.
    // The array proofRequestIds is updated accordingly.
    function addProofRequestAndAddress(uint64 id, address prover) public onlyAdmin {
        require(proofRequestsAndAddress[id] == address(0), "Proof request already exists");
        proofRequestsAndAddress[id] = prover;
        proofRequestIds.push(id);
    }
    
    // Delete a proof request and the address by id.
    // The array proofRequestIds is updated accordingly.
    function deleteProofRequestAndAddress(uint64 id) public onlyAdmin {
        require(proofRequestsAndAddress[id] != address(0), "Proof request does not exist");
        delete proofRequestsAndAddress[id];
        // Remove id from the array (swap-and-pop technique)
        for (uint256 i = 0; i < proofRequestIds.length; i++) {
            if (proofRequestIds[i] == id) {
                proofRequestIds[i] = proofRequestIds[proofRequestIds.length - 1];
                proofRequestIds.pop();
                break;
            }
        }
    }

    uint256 public constant fungible_token = 1;
    uint256 public constant non_fungible_token = 2;

    UniversalVerifier public verifier;

    constructor(UniversalVerifier verifier_, address initialOwner)
    ERC1155("https://ipfs.io/ipfs/QmaP8dJtET7rr5198RCpUFrXFbGps3VpFyAsaczFQntkwH/{id}.json")
    Ownable(initialOwner)
    {
        verifier = verifier_;
    }

    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external onlyOwner {
        _mint(to, id, amount, data);
    }

    function burn(address account, uint256 id, uint256 amount) external onlyOwner {
        _burn(account, id, amount);
    }


    error ProofNotVerified(uint64 requestId, address proverAddress);

    modifier onlyAllProofsVerified() {
      // iterate memory array(tempProofIds) to save gas fee
      uint64[] memory tempProofIds = proofRequestIds;
      for (uint256 i = 0; i < tempProofIds.length; i++) {
          // Retrieve the corresponding wallet address for this proof request id
          address prover = proofRequestsAndAddress[tempProofIds[i]];
          if (!verifier.getProofStatus(prover, tempProofIds[i]).isVerified) {
            revert ProofNotVerified(tempProofIds[i], prover);
        }
      }
      _;
   }

    // Override safeTransferFrom and include the onlyValidProofs modifier
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override onlyAllProofsVerified {
        // Optionally add any additional custom logic here
        super.safeTransferFrom(from, to, id, amount, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override onlyAllProofsVerified {
        require(ids.length == amounts.length, "ERC1155: Mismatched array lengths");
        require(to != address(0), "ERC1155: transfer to the zero address");

        for (uint256 i = 0; i < ids.length; ++i) {
            safeTransferFrom(from, to, ids[i], amounts[i], data);
        }
    }
}
