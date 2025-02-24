// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;

import "../interfaces/IFeeHandler.sol";
import "../utils/AccessControl.sol";

/**
    @title Handles FeeHandler routing for resources.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with the Bridge contract.
 */
contract FeeHandlerRouter is IFeeHandler, AccessControl {
    address public immutable _bridgeAddress;

    // destination domainID => resourceID => feeHandlerAddress
    mapping (uint8 => mapping(bytes32 => IFeeHandler)) public _domainResourceIDToFeeHandlerAddress;
    // whitelisted address => is whitelisted
    mapping(address => bool) public _whitelist;

    event WhitelistChanged(
        address whitelistAddress,
        bool isWhitelisted
    );

    error IncorrectFeeSupplied(uint256);

    modifier onlyBridge() {
        _onlyBridge();
        _;
    }

    function _onlyBridge() private view {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
    }

    modifier onlyAdmin() {
        _onlyAdmin();
        _;
    }

    function _onlyAdmin() private view {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "sender doesn't have admin role");
    }

    /**
        @notice Getter function for fee handler type
     */
    function feeHandlerType() public override pure returns (string memory) {
        return "router";
    }

    /**
        @param bridgeAddress Contract address of previously deployed Bridge.
     */
    constructor(address bridgeAddress) {
        _bridgeAddress = bridgeAddress;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    /**
        @notice Maps the {handlerAddress} to {resourceID} to {destinationDomainID} in {_domainResourceIDToFeeHandlerAddress}.
        @param destinationDomainID ID of chain FeeHandler contracts will be called.
        @param resourceID ResourceID for which the corresponding FeeHandler will collect/calcualte fee.
        @param handlerAddress Address of FeeHandler which will be called for specified resourceID.
     */
    function adminSetResourceHandler(uint8 destinationDomainID, bytes32 resourceID, IFeeHandler handlerAddress) external onlyAdmin {
        _domainResourceIDToFeeHandlerAddress[destinationDomainID][resourceID] = handlerAddress;
    }

    /**
        @notice Sets or revokes fee whitelist from an address.
        @param whitelistAddress Address to be whitelisted.
        @param isWhitelisted Set to true to exempt an address from paying fees.
     */
    function adminSetWhitelist(address whitelistAddress, bool isWhitelisted) external onlyAdmin {
        _whitelist[whitelistAddress] = isWhitelisted;

        emit WhitelistChanged(whitelistAddress, isWhitelisted);
    }


    /**
        @notice Initiates collecting fee with corresponding fee handler contract using IFeeHandler interface.
        @param sender Sender of the deposit.
        @param fromDomainID ID of the source chain.
        @param destinationDomainID ID of chain deposit will be bridged to.
        @param resourceID ResourceID to be used when making deposits.
        @param depositData Additional data to be passed to specified handler.
        @param feeData Additional data to be passed to the fee handler.
     */
    function collectFee(address sender, uint8 fromDomainID, uint8 destinationDomainID, bytes32 resourceID, bytes calldata depositData, bytes calldata feeData) payable external onlyBridge {
        if (_whitelist[sender]) {
            if (msg.value != 0) revert IncorrectFeeSupplied(msg.value);
            return;
        }

        IFeeHandler feeHandler = _domainResourceIDToFeeHandlerAddress[destinationDomainID][resourceID];
        feeHandler.collectFee{value: msg.value}(sender, fromDomainID, destinationDomainID, resourceID, depositData, feeData);
    }

    /**
        @notice Initiates calculating fee with corresponding fee handler contract using IFeeHandler interface.
        @param sender Sender of the deposit.
        @param fromDomainID ID of the source chain.
        @param destinationDomainID ID of chain deposit will be bridged to.
        @param resourceID ResourceID to be used when making deposits.
        @param depositData Additional data to be passed to specified handler.
        @param feeData Additional data to be passed to the fee handler.
        @return fee Returns the fee amount.
        @return tokenAddress Returns the address of the token to be used for fee.
     */
    function calculateFee(address sender, uint8 fromDomainID, uint8 destinationDomainID, bytes32 resourceID, bytes calldata depositData, bytes calldata feeData) external view returns(uint256 fee, address tokenAddress) {
        if (_whitelist[sender]) {
            return (0, address(0));
        }

        IFeeHandler feeHandler = _domainResourceIDToFeeHandlerAddress[destinationDomainID][resourceID];
        return feeHandler.calculateFee(sender, fromDomainID, destinationDomainID, resourceID, depositData, feeData);
    }
}