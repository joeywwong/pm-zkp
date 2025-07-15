// SPDX-License-IDentifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155} from '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import {PrimitiveTypeUtils} from '@iden3/contracts/lib/PrimitiveTypeUtils.sol';
import {ICircuitValidator} from '@iden3/contracts/interfaces/ICircuitValidator.sol';
import {EmbeddedZKPVerifier} from '@iden3/contracts/verifiers/EmbeddedZKPVerifier.sol';
import {UniversalVerifier} from '@iden3/contracts/verifiers/UniversalVerifier.sol';
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IZKPVerifier } from '@iden3/contracts/interfaces/IZKPVerifier.sol';

contract PMNoAdmin is ERC1155, Ownable {
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


    // Mapping from tokenID to request setter address to proof_request_id to prover's role (a string 'sender' or 'receiver').
    // tokenID → (setter → (proofRequestID → 'sender' or 'receiver'))
    mapping(uint256 => mapping(address => mapping(uint64 => string))) public tokenID_requestSetter_proofRequest_role;

    // Struct to represent a spending condition
    struct SpendingCondition {
        string attribute;
        string operatorStr;
        string value;
    }

    // Mapping from tokenID to user address to proofRequestID to spending condition
    // tokenID => (moneyOwnerAddress => (proofRequestID => SpendingCondition))
    mapping(uint256 => mapping(address => mapping(uint64 => SpendingCondition))) public spendingConditions;

    // An array to store proof_request_ids only for iteration.
    uint64[] public proofRequestIDs;
    
    /// @notice Get all spending conditions for a given tokenID and user
    function getSpendingConditions(uint256 tokenID, address user) external view returns (uint64[] memory, SpendingCondition[] memory) {
        uint64[] memory ids = proofRequestIDs;
        uint256 count = 0;
        // First, count how many proofRequestIDs are associated with this tokenID for this user
        for (uint256 i = 0; i < ids.length; i++) {
            if (bytes(spendingConditions[tokenID][user][ids[i]].attribute).length > 0) {
                count++;
            }
        }
        // Prepare arrays for output
        uint64[] memory filteredIDs = new uint64[](count);
        SpendingCondition[] memory conditions = new SpendingCondition[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (bytes(spendingConditions[tokenID][user][ids[i]].attribute).length > 0) {
                filteredIDs[idx] = ids[i];
                conditions[idx] = spendingConditions[tokenID][user][ids[i]];
                idx++;
            }
        }
        return (filteredIDs, conditions);
    }

    // Add a new proof request and the corresponding prover's address.
    // The array proofRequestIDs is updated accordingly.
    // Add a new proof request and the corresponding role ('sender' or 'receiver').
    // The array proofRequestIDs is updated accordingly.
    function addProofRequestAndRole(uint256 tokenID, uint64 requestID, string calldata role) private {
        require(_allTokenIDs.contains(tokenID), "token id does not exist");
        require(bytes(tokenID_requestSetter_proofRequest_role[tokenID][msg.sender][requestID]).length == 0, "Proof request already exists");
        require(
            keccak256(bytes(role)) == keccak256(bytes("sender")) ||
            keccak256(bytes(role)) == keccak256(bytes("receiver")),
            "Role must be 'sender' or 'receiver'"
        );
        tokenID_requestSetter_proofRequest_role[tokenID][msg.sender][requestID] = role;
        proofRequestIDs.push(requestID);
    }
    
    function addProofRequest_VerifierAndPM(
        uint64 requestId,
        string calldata metadata,
        ICircuitValidator validator,
        bytes calldata data,
        uint256 tokenID,
        string calldata role,
        SpendingCondition calldata condition
    ) public {
        // Only allow if caller owns the tokenID
        require(balanceOf(msg.sender, tokenID) > 0, "Only money owner can add spending condition.");
        // Build the IZKPVerifier.ZKPRequest struct
        IZKPVerifier.ZKPRequest memory req = IZKPVerifier.ZKPRequest({
            metadata: metadata,
            validator: validator,
            data: data
        });

        verifier.setZKPRequest(requestId, req);
        addProofRequestAndRole(tokenID, requestId, role);
        // Add the spending condition
        spendingConditions[tokenID][msg.sender][requestId] = SpendingCondition({
            attribute: condition.attribute,
            operatorStr: condition.operatorStr,
            value: condition.value
        });
    }
    
    // Delete a proof request and the address by ID.
    // The array proofRequestIDs is updated accordingly.
    function deleteProofRequestAndRole(uint256 tokenID, uint64 requestID) public {
        require(_allTokenIDs.contains(tokenID), "token id does not exist");
        require(bytes(tokenID_requestSetter_proofRequest_role[tokenID][msg.sender][requestID]).length != 0, "Proof request does not exist");
        // Only delete if the spending condition exists for this user
        require(bytes(spendingConditions[tokenID][msg.sender][requestID].attribute).length != 0, "No spending condition to delete");
        delete tokenID_requestSetter_proofRequest_role[tokenID][msg.sender][requestID];
        delete spendingConditions[tokenID][msg.sender][requestID];
        // Remove ID from the array (swap-and-pop technique)
        for (uint256 i = 0; i < proofRequestIDs.length; i++) {
            if (proofRequestIDs[i] == requestID) {
                proofRequestIDs[i] = proofRequestIDs[proofRequestIDs.length - 1];
                proofRequestIDs.pop();
                break;
            }
        }
    }

    UniversalVerifier public verifier;

    constructor(UniversalVerifier verifier_, address initialOwner, string memory uri_)
    ERC1155(uri_)
    Ownable(initialOwner)
    {
        verifier = verifier_;
    }

    // Custom error declaration (check if token id already taken, when minting new token)
    error TokenIDTaken(uint256 tokenID);

    // Reverts with TokenIDNotFound if the ID hasn’t been registered yet.
    error TokenIDNotFound(uint256 tokenID);

    /// @notice Mint a token by name. If the name exists, mint the existing token. 
    /// If the name does not exist, mint a new token with a random unused ID and assign the name.
    /// Anyone can call this function to mint a token, for testing purposes.
    /// In production, this function should be restricted to the owner or a specific role.
    /// @dev The function no longer requires the ID argument. The name must be non-empty.
    function mintToken(address to, uint256 amount, bytes calldata data, string calldata name) external {
        require(bytes(name).length > 0, "Name required");
        uint256 tokenID = 0;
        bool found = false;
        uint256[] memory ids = _allTokenIDs.values();
        for (uint256 i = 0; i < ids.length; i++) {
            if (keccak256(bytes(tokenName[ids[i]])) == keccak256(bytes(name))) {
                tokenID = ids[i];
                found = true;
                break;
            }
        }
        if (found) {
            _mint(to, tokenID, amount, data);
        } else {
            // Generate a random 4-5 digit ID (1000–99999)
            uint256 newID;
            uint256 attempts = 0;
            do {
                newID = 1000 + (uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, to, name, attempts))) % 90000);
                attempts++;
                require(attempts < 100, "Unable to find unique short token ID");
            } while (_allTokenIDs.contains(newID));
            require(_allTokenIDs.add(newID), "TokenIDTaken");
            _mint(to, newID, amount, data);
            tokenName[newID] = name;
        }
    }

    function burn(address account, uint256 ID, uint256 amount) external onlyOwner {
        _burn(account, ID, amount);
    }

    // Custom error declaration
    error ProofNotVerified(uint64 requestID, address proverAddress);

    // @dev Internal helper: revert if any proof for tokenID is still unverified.
    // Use this before token transfer.
    // Checks sender's and receiver's proofs as required by the prover's role.
    function _checkAllProofsVerified(uint256 tokenID, address sender, address receiver) internal view {
        uint64[] memory tempRequestIDs = proofRequestIDs;
        for (uint256 i = 0; i < tempRequestIDs.length; i++) {
            string memory role = tokenID_requestSetter_proofRequest_role[tokenID][sender][tempRequestIDs[i]];
            if (bytes(role).length == 0) continue;
            if (keccak256(bytes(role)) == keccak256(bytes("sender"))) {
                if (!verifier.getProofStatus(sender, tempRequestIDs[i]).isVerified) {
                    revert ProofNotVerified(tempRequestIDs[i], sender);
                }
            } else if (keccak256(bytes(role)) == keccak256(bytes("receiver"))) {
                if (!verifier.getProofStatus(receiver, tempRequestIDs[i]).isVerified) {
                    revert ProofNotVerified(tempRequestIDs[i], receiver);
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
        _checkAllProofsVerified(tokenID, from, to);

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
            _checkAllProofsVerified(tokenIDs[i], from, to);
            safeTransferFrom(from, to, tokenIDs[i], amounts[i], data);
        }
    }
}
