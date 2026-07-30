// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AttendanceNFT is ERC721, Ownable {

    // ===================== STATE VARIABLES =====================

    uint256 private _nextTokenId;

    // Simpan tokenURI per tokenId
    mapping(uint256 => string) private _tokenURIs;

    // Simpan data pengguna per wallet address
    mapping(address => string) public userNames;
    mapping(address => string) public userIDs;

    // Simpan tokenId milik wallet (untuk lookup)
    mapping(address => uint256) public walletToTokenId;
    mapping(address => bool) public isRegistered;

    // Daftar semua wallet yang terdaftar (untuk rekap admin)
    address[] public registeredWallets;

    // ===================== EVENTS =====================

    event AccessGranted(address indexed to, uint256 tokenId, string nama, string id);
    event AccessRevoked(address indexed from, uint256 tokenId);

    // ===================== CONSTRUCTOR =====================

    constructor() ERC721("AttendanceNFT", "ANFT") Ownable(msg.sender) {}

    // ===================== ADMIN FUNCTIONS =====================

    // Mint NFT akses ke wallet pengguna
    function mintAccess(
        address _to,
        string memory _tokenURI,
        string memory _nama,
        string memory _id
    ) public onlyOwner {
        require(!isRegistered[_to], "Wallet sudah terdaftar");
        require(bytes(_nama).length > 0, "Nama tidak boleh kosong");
        require(bytes(_id).length > 0, "ID tidak boleh kosong");

        uint256 tokenId = _nextTokenId++;
        _safeMint(_to, tokenId);

        // Simpan tokenURI (CID metadata IPFS)
        _tokenURIs[tokenId] = _tokenURI;

        // Simpan data pengguna on-chain
        userNames[_to] = _nama;
        userIDs[_to] = _id;
        walletToTokenId[_to] = tokenId;
        isRegistered[_to] = true;

        // Tambah ke daftar
        registeredWallets.push(_to);

        emit AccessGranted(_to, tokenId, _nama, _id);
    }

    // Cabut akses dengan burn token
    function revokeAccess(address _wallet) public onlyOwner {
        require(isRegistered[_wallet], "Wallet tidak terdaftar");

        uint256 tokenId = walletToTokenId[_wallet];
        _burn(tokenId);

        // Reset data pengguna
        isRegistered[_wallet] = false;
        delete userNames[_wallet];
        delete userIDs[_wallet];
        delete walletToTokenId[_wallet];

        emit AccessRevoked(_wallet, tokenId);
    }

    // ===================== VIEW FUNCTIONS =====================

    // Cek apakah wallet punya akses
    function hasAccess(address _wallet) public view returns (bool) {
        return isRegistered[_wallet] && balanceOf(_wallet) > 0;
    }

    // Ambil data pengguna berdasarkan wallet
    function getUserData(address _wallet) public view returns (
        string memory nama,
        string memory id,
        bool aktif
    ) {
        return (userNames[_wallet], userIDs[_wallet], isRegistered[_wallet]);
    }

    // Ambil semua wallet terdaftar (untuk admin rekap)
    function getAllRegisteredWallets() public view returns (address[] memory) {
        return registeredWallets;
    }

    // Jumlah total pengguna terdaftar
    function totalRegistered() public view returns (uint256) {
        return registeredWallets.length;
    }

    // ===================== OVERRIDES =====================

    // Override tokenURI untuk baca dari mapping kita
    function tokenURI(uint256 _tokenId)
        public view override returns (string memory) {
        return _tokenURIs[_tokenId];
    }

    // Soulbound: tidak bisa transfer antar wallet
    function _update(address to, uint256 tokenId, address auth)
        internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(
            from == address(0) || to == address(0),
            "Soulbound: token tidak dapat ditransfer"
        );
        return super._update(to, tokenId, auth);
    }
}
