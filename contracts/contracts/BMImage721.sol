// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title BMImage721 — mint AI images on Base via EIP-712 vouchers (off-chain images)
contract BMImage721 is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    struct Claim {
        address to;        // receiver (must equal msg.sender)
        string tokenURI;   // full metadata URI (e.g., ipfs://.../metadata.json)
        bytes32 imageHash; // keccak256 of final image bytes (pin integrity)
        uint256 deadline;  // unix timestamp
        uint256 nonce;     // per-user sequential nonce
    }

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(address to,string tokenURI,bytes32 imageHash,uint256 deadline,uint256 nonce)");

    address public signer;      // backend signer for vouchers
    address public treasury;    // fee receiver
    uint256 public mintFeeWei;  // fixed fee (wei)
    uint256 public nextId = 1;

    mapping(address => uint256) public nonces;        // user => next expected nonce
    mapping(uint256 => bytes32) public imageHashOf;   // tokenId => image hash

    event Claimed(address indexed to, uint256 indexed tokenId, bytes32 imageHash, string tokenURI);
    event SignerUpdated(address indexed newSigner);
    event TreasuryUpdated(address indexed newTreasury);
    event MintFeeUpdated(uint256 feeWei);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address signer_,
        address treasury_
    )
        ERC721(name_, symbol_)
        Ownable(initialOwner)
        EIP712("BMImage721", "1")
    {
        signer = signer_;
        treasury = treasury_;
        emit SignerUpdated(signer_);
        emit TreasuryUpdated(treasury_);
    }

    // -------- Admin --------
    function setSigner(address newSigner) external onlyOwner { signer = newSigner; emit SignerUpdated(newSigner); }
    function setTreasury(address t) external onlyOwner { treasury = t; emit TreasuryUpdated(t); }
    function setMintFeeWei(uint256 v) external onlyOwner { mintFeeWei = v; emit MintFeeUpdated(v); }

    // -------- Claim (payable) --------
    function claim(Claim calldata c, bytes calldata signature)
        external
        payable
        nonReentrant
        returns (uint256 tokenId)
    {
        require(c.to == msg.sender, "WRONG_TO");
        require(block.timestamp <= c.deadline, "EXPIRED");
        require(c.nonce == nonces[c.to], "BAD_NONCE");

        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, c.to, keccak256(bytes(c.tokenURI)), c.imageHash, c.deadline, c.nonce)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        require(recovered == signer, "BAD_SIG");

        if (mintFeeWei > 0) {
            require(msg.value == mintFeeWei, "FEE");
            (bool ok,) = treasury.call{value: msg.value}("");
            require(ok, "PAY");
        }

        nonces[c.to] = c.nonce + 1;

        tokenId = nextId++;
        _safeMint(c.to, tokenId);
        _setTokenURI(tokenId, c.tokenURI);
        imageHashOf[tokenId] = c.imageHash;

        emit Claimed(c.to, tokenId, c.imageHash, c.tokenURI);
    }

    // -------- Overrides for OZ v5 --------

    // NOTE: In your OZ v5, _update is defined in ERC721. ERC721URIStorage might not override it.
    // To be maximally compatible with v5.x releases, override only ERC721 here.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    // tokenURI exists in both parents; list both.
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // supportsInterface exists in both; list both.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
