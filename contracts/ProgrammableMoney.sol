// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {PrimitiveTypeUtils} from '@iden3/contracts/lib/PrimitiveTypeUtils.sol';
import {ICircuitValidator} from '@iden3/contracts/interfaces/ICircuitValidator.sol';
import {EmbeddedZKPVerifier} from '@iden3/contracts/verifiers/EmbeddedZKPVerifier.sol';

contract ProgrammableMoney is ERC1155, Ownable, ERC1155Burnable {
    // Change the request id after creating the proof request
    uint64 public constant TRANSFER_REQUEST_ID_SIG_VALIDATOR = 1;
    uint64 public constant TRANSFER_REQUEST_ID_MTP_VALIDATOR = 2;

    modifier beforeTransfer(address to) {
      require(
         isProofVerified(to, TRANSFER_REQUEST_ID_SIG_VALIDATOR) ||
         isProofVerified(to, TRANSFER_REQUEST_ID_MTP_VALIDATOR),
         'only identities who provided sig or mtp proof for transfer requests are allowed to receive tokens'
      );
      _;
   }

    uint256 public constant fungible = 0;
    uint256 public constant nonFungible = 1;

    //The Owner is supposed to be the 'controller', i.e. only owner can add or delete conditinos
    constructor(address initialOwner) ERC1155("https://ipfs.io/ipfs/QmaP8dJtET7rr5198RCpUFrXFbGps3VpFyAsaczFQntkwH/{id}.json") Ownable(initialOwner) {
        super.__EmbeddedZKPVerifier_init(_msgSender());
    }

    // Specify the 
    struct txInfo {
        address from;
        address to;
        uint256 tokenID;
        uint256 amount;
        bytes data;
    }

    // Create a mapping where the key (proof request id) maps to a transaction_info.
    // After prover submitted a valid proofs for a request id, money transfer according to the txInfo.
    mapping(uint256 => txInfo) private requestID_txInfo;

    /**
     * @notice Sets the txInfo for a proof request id.
     * @notice Function caller must have the token.
     * @param requestID The requestID used for the mapping.
     * @param from The address which send the token.
     * @param to The address which receive the token.
     * @param tokenID The token which is sent.
     * @param amount How much money is sent.
     * @param data Extra info, can be "".
     */
    function setTxInfo(
        uint256 requestID, 
        address from,
        address to,
        uint256 tokenID,
        uint256 amount,
        bytes data) external {
        require(balanceOf(msg.sender, tokenId) > 0, "Caller does not own the token");
        requestID_txInfo[key] = txInfo(from, to, tokenID, amount, data);
    }


    function _beforeProofSubmit(
        uint64 /* requestId */,
        uint256[] memory inputs,
        ICircuitValidator validator
        ) internal view override {
        // check that challenge input is address of sender
        address addr = PrimitiveTypeUtils.uint256LEToAddress(
            inputs[validator.inputIndexOf('challenge')]
        );
        // this is linking between msg.sender and
        require(_msgSender() == addr, 'address in proof is not a sender address');
        }
    function _afterProofSubmit(
        uint64 requestId,
        uint256[] memory inputs,
        ICircuitValidator validator
        ) internal override {
        if (
            // Check if a transaction info is set for the request id
            // Transaction only happens if the tx_info is set.
            requestId_txInfo[requestId].from != address(0)
        ) {
            // if proof is given for transfer request id ( mtp or sig ) we send tokens according to the tx_info of the request id.
            info = requestId_txInfo[requestId];
            address from = _txinfo.from;
            address to = _txinfo.to;
            uint256 tokenID = _txinfo.tokenID;
            uint256 amount = _txinfo.amount;
            bytes data = _txinfo.data;
            safeTransferFrom(from, to, tokenID, amount, data, _msgSender(), requestId);
        }
        else{
            revert("Error: transaction info is not set for the request id of the proof.");
        }
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data, address prover_address, uint256 requestID)
    public virtual override{
        require(
         isProofVerified(prover_address, requestID),
         'only identities who provided sig or mtp proof for transfer requests are allowed to receive tokens'
      );
        require(to != address(0), "ERC1155: transfer to the zero address");
        // Call the original function for its intended behavior
        super.safeTransferFrom(from, to, id, value, data);
    }
        function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }

    function mint(address account, uint256 id, uint256 amount, bytes memory data)
        public
        onlyOwner
    {
        _mint(account, id, amount, data);
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        public
        onlyOwner
    {
        _mintBatch(to, ids, amounts, data);
    }
    
// ====================================================
// The functions below are intended for off-chain verification.
// Keep them as a backup and maybe useful later.
// ====================================================

    // Define operators of the conditions, as an enum for clarity.
    enum Operator { GreaterThan, LessThan, Equal, NotEqual, OneOfValues, NoneOfValues}

    // Structure to represent a spending condition.
    struct Condition {
        string parameter;  // e.g., "age"
        Operator op;       // e.g., GreaterThan
        uint256[] values; // e.g., 18
    }

    // Map a token id to an array of conditions.
    mapping(uint256 => Condition[]) public tokenConditions;

    // Add a condition to a token.
    // Function caller must have the token.
    function addCondition(
        uint256 tokenId,
        string memory parameter,
        Operator op,
        uint256[] memory values
    ) external  {
        require(balanceOf(msg.sender, tokenId) > 0, "Caller does not own the token");
        tokenConditions[tokenId].push(Condition(parameter, op, values));
    }

    // Delete a condition by index from a token's conditions array.
    // Function caller must have the token.
    // This function swaps the condition with the last element and then removes it.
    function deleteCondition(uint256 tokenId, uint256 index) external {
        require(balanceOf(msg.sender, tokenId) > 0, "Caller does not own the token");
        require(index < tokenConditions[tokenId].length, "Invalid index");
        tokenConditions[tokenId][index] = tokenConditions[tokenId][tokenConditions[tokenId].length - 1];
        tokenConditions[tokenId].pop();
    }

    // Public function returns the spending conditions of a token.
    // Depending on the use cases, this function may not be public
    function getConditions(uint256 tokenId) public view returns (Condition[] memory) {
    return tokenConditions[tokenId];
}
    // Mapping to record if a credentials holder has met the conditions for a given token.
    // conditionsMet[tokenId][credentials holder's address] == true means the credentials holder has met all conditions for that token.
    mapping(uint256 => mapping(address => bool)) private _conditionsMet;

    // Takes a token ID and an address, then return whether the address satisfy the spending conditions:
    // Depending on the use cases, this function may not be public
    function getConditionsMet(uint256 tokenId, address holder) public view returns (bool) {
        return _conditionsMet[tokenId][holder];
    }

    // spending conditions met: only allow transfers when all spending conditions are met.
    // the condiions check (verificaiton of ZKP) can be done on-chain or off-chain via Privado ID's JS-SDK.
    mapping(uint256 => bool) public transfersAllowed;

    // Function to toggle transfer permission of a token, after ZKP is verified successfully.
    // Function caller must have that token.
    function setTransfersAllowed(uint256 tokenId, bool allowed) external {
    require(balanceOf(msg.sender, tokenId) > 0, "Caller does not own the token");
       transfersAllowed[tokenId] = allowed;
    }

}
