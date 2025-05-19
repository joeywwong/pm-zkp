// SPDX-License-IDentifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155} from '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import {PrimitiveTypeUtils} from '@iden3/contracts/lib/PrimitiveTypeUtils.sol';
import {ICircuitValidator} from '@iden3/contracts/interfaces/ICircuitValidator.sol';
import {EmbeddedZKPVerifier} from '@iden3/contracts/verifiers/EmbeddedZKPVerifier.sol';
import {UniversalVerifier} from '@iden3/contracts/verifiers/UniversalVerifier.sol';
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

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

    using EnumerableSet for EnumerableSet.UintSet;

    // A set of all token IDs that have ever been minted
    EnumerableSet.UintSet private _allTokenIDs;

    /// @notice Returns the full list of token IDs ever minted
    function allTokenIDs() external view returns (uint256[] memory) {
        return _allTokenIDs.values();
    }

    // Mapping from token ID to its name. But the token name and other attributes can be stored as uri 
    mapping(uint256 => string) public tokenName;

    // Mapping from tokenID to proof_request_id to a wallet address (the prover's address).
    // tokenID → (proofRequestID → prover address)
    // The address owner can be a token sender, a token receiver or any third-party prover.
    mapping(uint256 => mapping(uint64 => address)) public tokenID_proofRequest_address;

    // An array to store proof_request_ids only for iteration.
    uint64[] public proofRequestIDs;

    // Add a new proof request and the corresponding prover's address.
    // The array proofRequestIDs is updated accordingly.
    function addProofRequestAndAddress(uint256 tokenID, uint64 requestID, address prover) public onlyAdmin {
        require(_allTokenIDs.contains(tokenID), "token id does not exist");
        require(tokenID_proofRequest_address[tokenID][requestID] == address(0), "Proof request already exists");
        tokenID_proofRequest_address[tokenID][requestID] = prover;
        proofRequestIDs.push(requestID);
    }
    
    // Delete a proof request and the address by ID.
    // The array proofRequestIDs is updated accordingly.
    function deleteProofRequestAndAddress(uint256 tokenID, uint64 requestID) public onlyAdmin {
        require(_allTokenIDs.contains(tokenID), "token id does not exist");
        require(tokenID_proofRequest_address[tokenID][requestID] != address(0), "Proof request does not exist");
        delete tokenID_proofRequest_address[tokenID][requestID];
        // Remove ID from the array (swap-and-pop technique)
        for (uint256 i = 0; i < proofRequestIDs.length; i++) {
            if (proofRequestIDs[i] == requestID) {
                proofRequestIDs[i] = proofRequestIDs[proofRequestIDs.length - 1];
                proofRequestIDs.pop();
                break;
            }
        }
    }

    uint256 public constant fungible_token = 1;
    uint256 public constant non_fungible_token = 2;

    UniversalVerifier public verifier;

    constructor(UniversalVerifier verifier_, address initialOwner, string memory uri_)
    ERC1155(uri_)
    Ownable(initialOwner)
    {
        verifier = verifier_;
    }

    // Custom error declaration (check if token id already taken, when minting new token)
    error TokenIDTaken(uint256 tokenID);

    // Call this function when creating new token for new spending conditions
    function mintNewToken(address to, uint256 ID, uint256 amount, bytes calldata data, string calldata name) external onlyOwner {
        // Add the token id to _allTokenIDs. If it returns false, the token id has been taken before.
        if (!_allTokenIDs.add(ID)) {
            revert TokenIDTaken(ID);
        }

        _mint(to, ID, amount, data);
        // assign a name to the new token
        tokenName[ID] = name;
    }
    
    // Reverts with TokenIDNotFound if the ID hasn’t been registered yet.
    error TokenIDNotFound(uint256 tokenID);

    function mintExistingToken(address to, uint256 ID, uint256 amount, bytes calldata data) external onlyOwner {
        if (!_allTokenIDs.contains(ID)) {
        revert TokenIDNotFound(ID);
    }
        _mint(to, ID, amount, data);
    }

    function burn(address account, uint256 ID, uint256 amount) external onlyOwner {
        _burn(account, ID, amount);
    }

    // Custom error declaration
    error ProofNotVerified(uint64 requestID, address proverAddress);
    
    // @dev Internal helper: revert if any proof for tokenID is still unverified.
    // Use this before token transfer.
    function _checkAllProofsVerified(uint256 tokenID) internal view {
      // iterate memory array (tempRequestIDs) to save gas fee
      uint64[] memory tempRequestIDs = proofRequestIDs;
      for (uint256 i = 0; i < tempRequestIDs.length; i++) {
          // Retrieve the corresponding wallet address for this proof request ID
          if (tokenID_proofRequest_address[tokenID][tempRequestIDs[i]] != address(0)){
            address prover = tokenID_proofRequest_address[tokenID][tempRequestIDs[i]];
            if (!verifier.getProofStatus(prover, tempRequestIDs[i]).isVerified) {
            revert ProofNotVerified(tempRequestIDs[i], prover);
          }
        }
      }
    }

    // Override safeTransferFrom and include the onlyValidProofs modifier
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenID,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        // Enforce per-token proof checks
        _checkAllProofsVerified(tokenID);

        // Optionally add any additional custom logic here
        super.safeTransferFrom(from, to, tokenID, amount, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory tokenIDs,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override {
        require(tokenIDs.length == amounts.length, "ERC1155: Mismatched array lengths");
        require(to != address(0), "ERC1155: transfer to the zero address");
        for (uint256 i = 0; i < tokenIDs.length; ++i) {
            // Enforce per-token proof checks
            _checkAllProofsVerified(tokenIDs[i]);
            safeTransferFrom(from, to, tokenIDs[i], amounts[i], data);
        }
    }
}
