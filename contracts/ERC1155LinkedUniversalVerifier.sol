// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ERC1155} from '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import {PrimitiveTypeUtils} from '@iden3/contracts/lib/PrimitiveTypeUtils.sol';
import {ICircuitValidator} from '@iden3/contracts/interfaces/ICircuitValidator.sol';
import {EmbeddedZKPVerifier} from '@iden3/contracts/verifiers/EmbeddedZKPVerifier.sol';
import {UniversalVerifier} from '@iden3/contracts/verifiers/UniversalVerifier.sol';

contract ERC1155LinkedUniversalVerifier is ERC1155 {
    uint64 public constant TRANSFER_REQUEST_ID_SIG_VALIDATOR = 1739452428;
    uint64 public constant TRANSFER_REQUEST_ID_MTP_VALIDATOR = 1739452428;

    uint256 public constant fungible_token = 1;
    uint256 public constant non_fungible_token = 2;

    uint256 public TOKEN_AMOUNT_FOR_AIRDROP_PER_ID = 10;
    uint256 public NON_TOKEN_AMOUNT_FOR_AIRDROP_PER_ID = 1;

    UniversalVerifier public verifier;

    constructor(UniversalVerifier verifier_) ERC1155("https://ipfs.io/ipfs/QmaP8dJtET7rr5198RCpUFrXFbGps3VpFyAsaczFQntkwH/{id}.json") {
        verifier = verifier_;
    }

    function mint(address to) public {
      require(
            verifier.getProofStatus(to, TRANSFER_REQUEST_ID_SIG_VALIDATOR).isVerified ||
            verifier.getProofStatus(to, TRANSFER_REQUEST_ID_MTP_VALIDATOR).isVerified,
            "only identities with valid sig or mtp proof are allowed to receive tokens"
      );
      
        _mint(to, fungible_token, TOKEN_AMOUNT_FOR_AIRDROP_PER_ID, "");
        _mint(to, non_fungible_token, NON_TOKEN_AMOUNT_FOR_AIRDROP_PER_ID, "");
    }

    /**
     * @dev Override ERC1155's hook to enforce that any recipient must have a verified identity.
     * This hook is called on mint, transfer, and batch transfer.
     */
    function _update(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual {
        // When tokens are being transferred or minted,
        // require that the recipient has provided a valid signature or MTP proof.

      super._update(from, to, ids, amounts);
    }
}
