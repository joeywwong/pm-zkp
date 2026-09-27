// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

contract MockUniversalVerifier {
    struct ZKPRequest {
        string metadata;
        address validator;
        bytes data;
    }

    function setZKPRequest(uint64, ZKPRequest calldata) external {}
}
