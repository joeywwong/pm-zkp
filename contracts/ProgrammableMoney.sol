// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

//import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
//import "@openzeppelin/contracts/access/AccessControl.sol";
//import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
//import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
//@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
//import "@openzeppelin/contracts/access/Ownable.sol";
//import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {PrimitiveTypeUtils} from '@iden3/contracts/lib/PrimitiveTypeUtils.sol';
import {ICircuitValidator} from '@iden3/contracts/interfaces/ICircuitValidator.sol';
import {EmbeddedZKPVerifier} from '@iden3/contracts/verifiers/EmbeddedZKPVerifier.sol';

contract ProgrammableMoney is /*Initializable, UUPSUpgradeable, OwnableUpgradeable, */ ERC1155Upgradeable, EmbeddedZKPVerifier {
    // Mapping to track approved minters.
    mapping(address => bool) public approvedMinters;
    address public admin;

    modifier onlyApprovedMinter() {
        require(approvedMinters[msg.sender], "Not an approved minter");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not the admin");
        _;
    }

    /**
     * @notice Add a new approved minter.
     * @dev Only the admin can add new minters.
     */
    function addMinter(address minter) external onlyAdmin {
        approvedMinters[minter] = true;
    }

    /**
     * @notice Remove an approved minter.
     * @dev Only the admin can remove minters.
     */
    function removeMinter(address minter) external onlyAdmin {
        approvedMinters[minter] = false;
    }

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

/*
    function customSetZKPRequest(uint64 requestID, string metadata, ICircuitValidator validator, bytes data){
        IZKPVerifier.ZKPRequest request = IZKPVerifier.ZKPRequest(metadata, validator, data);
    }
*/
    //The Owner is supposed to be the 'controller', i.e. only owner can add or delete conditinos
    //constructor() ERC1155("https://ipfs.io/ipfs/QmaP8dJtET7rr5198RCpUFrXFbGps3VpFyAsaczFQntkwH/{id}.json"){
    //    super.__EmbeddedZKPVerifier_init(_msgSender());
    //}

   // function initialize() initializer public{
   //__ERC1155_init("https://ipfs.io/ipfs/QmaP8dJtET7rr5198RCpUFrXFbGps3VpFyAsaczFQntkwH/{id}.json");
   //super.__EmbeddedZKPVerifier_init(_msgSender());
   //__Ownable_init();
   //__UUPSUpgradeable_init();
//}


    function initialize(string memory uri) public initializer {
      //super.__EmbeddedZKPVerifier_init(_msgSender());
      super.__ERC1155_init(uri);
      super.__EmbeddedZKPVerifier_init(_msgSender());
      admin = msg.sender;
      approvedMinters[msg.sender] = true;
   }

    //constructor(address initialOwner) Ownable(initialOwner) {
    //    //super.__EmbeddedZKPVerifier_init(_msgSender());
    //}

    // Specify the tx info
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
        uint64 requestID, 
        address from,
        address to,
        uint256 tokenID,
        uint256 amount,
        bytes memory data) external {
        require(balanceOf(msg.sender, tokenID) > 0, "Caller does not own the token");
        requestID_txInfo[requestID] = txInfo(from, to, tokenID, amount, data);
    }

    bool public is_verified;
    event FunctionCalled(string message, bool value);
    event FunctionCalledBeforeProofSubmit(string message, address value);

    function _beforeProofSubmit(
        uint64 /* requestId */,
        uint256[] memory inputs,
        ICircuitValidator validator
        ) internal override{
        // check that challenge input is address of sender
        address addr = PrimitiveTypeUtils.uint256LEToAddress(
            inputs[validator.inputIndexOf('challenge')]
        );
        emit FunctionCalledBeforeProofSubmit("prover's address = ", addr);
        // this is linking between msg.sender and
        //require(_msgSender() == addr, 'address in proof is not a sender address');
        }
    function _afterProofSubmit(
        uint64 requestId,
        uint256[] memory inputs,
        ICircuitValidator validator
        ) internal override{
        if (
            // Check if a transaction info is set for the request id
            // Transaction only happens if the tx_info is set.
            //requestID_txInfo[requestId].from != address(0)
            true
        ) {
            // if proof is given for transfer request id ( mtp or sig ) we send tokens according to the tx_info of the request id.
            /*
            txInfo memory info = requestID_txInfo[requestId];
            address from = info.from;
            address to = info.to;
            uint256 tokenID = info.tokenID;
            uint256 amount = info.amount;
            bytes memory data = info.data;
            */
            is_verified = isProofVerified(_msgSender(), requestId);
            emit FunctionCalled("is_verified = ", is_verified);

            //customTransferFrom(from, to, tokenID, amount, data, _msgSender(), requestId);
        }
        else{
            revert("Error: transaction info is not set for the request id of the proof.");
        }
    }

    function customTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data, address prover_address, uint64 requestID)
    public {
        require(
         isProofVerified(prover_address, requestID),
         'only identities who provided sig or mtp proof for transfer requests are allowed to receive tokens'
      );
        require(to != address(0), "ERC1155: transfer to the zero address");
        // Call the original function for its intended behavior
        super.safeTransferFrom(from, to, id, value, data);
    }
    
    /**
     * @notice Mint new tokens.
     * @dev Only approved minters can mint tokens.
     */
    function mint(address account, uint256 id, uint256 amount, bytes memory data)
        external onlyApprovedMinter
    {
        _mint(account, id, amount, data);
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        external onlyApprovedMinter
    {
        _mintBatch(to, ids, amounts, data);
    }
    


}
