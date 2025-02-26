// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";

contract ProgrammableMoney is ERC1155, Ownable, ERC1155Burnable {

    uint256 public constant fungible = 0;
    uint256 public constant nonFungible = 1;

    //The Owner is supposed to be the 'controller', i.e. only owner can add or delete conditinos
    constructor(address initialOwner) ERC1155("https://ipfs.io/ipfs/QmaP8dJtET7rr5198RCpUFrXFbGps3VpFyAsaczFQntkwH/{id}.json") Ownable(initialOwner) {
    
    }

    // The spending conditions can be recorded in the contract or URI
    // but the token contract itself can't verify the conditions.
    // Verificaiton of ZKP is done off-chain via Privado ID's JS-SDK.

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

    // Owner can add a condition to a token.
    function addCondition(
        uint256 tokenId,
        string memory parameter,
        Operator op,
        uint256[] memory values
    ) public onlyOwner {
        tokenConditions[tokenId].push(Condition(parameter, op, values));
    }

    // Delete a condition by index from a token's conditions array.
    // This function swaps the condition with the last element and then removes it.
    function deleteCondition(uint256 tokenId, uint256 index) public onlyOwner {
        require(index < tokenConditions[tokenId].length, "Invalid index");
        tokenConditions[tokenId][index] = tokenConditions[tokenId][tokenConditions[tokenId].length - 1];
        tokenConditions[tokenId].pop();
    }

    function getConditions(uint256 tokenId) public view returns (Condition[] memory) {
    return tokenConditions[tokenId];
}
    // Mapping to record if a holder has met the conditions for a given token.
    // conditionsMet[tokenId][holder] == true means the holder has met all conditions for that token.
    mapping(uint256 => mapping(address => bool)) private _conditionsMet;

    // Takes a token ID and an address, then return the boolean value:
    function getConditionsMet(uint256 tokenId, address holder) public view returns (bool) {
        return _conditionsMet[tokenId][holder];
    }

    // spending conditions met: only allow transfers when all spending conditions are met.
    // the condiions check (verificaiton of ZKP) is done off-chain via Privado ID's JS-SDK.
    bool public transfersAllowed = false;

    // Function to toggle transfer permission, when ZKP is verified
    function setTransfersAllowed(bool allowed) external onlyOwner {
        transfersAllowed = allowed;
    }
    
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data)
    public virtual override{
        require(msg.sender == from, "Caller must be token owner");
        require(to != address(0), "ERC1155: transfer to the zero address");
        require(transfersAllowed, "Spending conditions not met. Transfer aborted.");
        
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
}
