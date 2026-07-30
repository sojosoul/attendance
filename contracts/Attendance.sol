// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IAttendanceNFT {
    function hasAccess(address _wallet) external view returns (bool);
    function getUserData(address _wallet) external view returns (
        string memory nama, string memory id, bool aktif
    );
}

contract Attendance {

    // ===================== STRUCT =====================

    struct AttendanceRecord {
        uint256 timestamp_checkin;
        uint256 timestamp_checkout;
        string  cid_foto_checkin;
        string  cid_foto_checkout;
        string  lat_checkin;
        string  long_checkin;
        bool    sudah_checkin;
        bool    sudah_checkout;
    }

    // ===================== STATE VARIABLES =====================

    address public nftContract;
    address public owner;

    // wallet => tanggal (YYYYMMDD) => record
    mapping(address => mapping(uint256 => AttendanceRecord)) public records;

    // wallet => array tanggal (untuk riwayat)
    mapping(address => uint256[]) public attendanceDates;

    // ===================== EVENTS =====================

    event CheckIn(address indexed wallet, uint256 tanggal, string cidFoto, uint256 timestamp);
    event CheckOut(address indexed wallet, uint256 tanggal, string cidFoto, uint256 timestamp);

    // ===================== MODIFIERS =====================

    modifier onlyOwner() {
        require(msg.sender == owner, "Bukan owner");
        _;
    }

    modifier onlyNFTHolder() {
        require(
            IAttendanceNFT(nftContract).hasAccess(msg.sender),
            "Kamu tidak memiliki NFT akses presensi"
        );
        _;
    }

    // ===================== CONSTRUCTOR =====================

    constructor(address _nftContract) {
        nftContract = _nftContract;
        owner = msg.sender;
    }

    // ===================== HELPER =====================

    // Konversi timestamp ke format tanggal YYYYMMDD
    function getTanggal(uint256 _timestamp) public pure returns (uint256) {
        uint256 unixDay = _timestamp / 86400;
        uint256 z = unixDay + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe/1460 + doe/36524 - doe/146096) / 365;
        uint256 y = yoe + era * 400;
        uint256 doy = doe - (365*yoe + yoe/4 - yoe/100);
        uint256 mp = (5*doy + 2) / 153;
        uint256 d = doy - (153*mp + 2)/5 + 1;
        uint256 m = mp < 10 ? mp + 3 : mp - 9;
        y = m <= 2 ? y + 1 : y;
        return y * 10000 + m * 100 + d;
    }

    function getTanggalHariIni() public view returns (uint256) {
        return getTanggal(block.timestamp);
    }

    // ===================== MAIN FUNCTIONS =====================

    function checkIn(
        string memory _cidFoto,
        string memory _lat,
        string memory _long
    ) public onlyNFTHolder {
        uint256 tanggal = getTanggalHariIni();
        AttendanceRecord storage rec = records[msg.sender][tanggal];

        require(!rec.sudah_checkin, "Sudah check-in hari ini");
        require(bytes(_cidFoto).length > 0, "CID foto tidak boleh kosong");

        rec.timestamp_checkin = block.timestamp;
        rec.cid_foto_checkin  = _cidFoto;
        rec.lat_checkin       = _lat;
        rec.long_checkin      = _long;
        rec.sudah_checkin     = true;

        attendanceDates[msg.sender].push(tanggal);

        emit CheckIn(msg.sender, tanggal, _cidFoto, block.timestamp);
    }

    function checkOut(
        string memory _cidFoto
    ) public onlyNFTHolder {
        uint256 tanggal = getTanggalHariIni();
        AttendanceRecord storage rec = records[msg.sender][tanggal];

        require(rec.sudah_checkin,   "Belum check-in hari ini");
        require(!rec.sudah_checkout, "Sudah check-out hari ini");
        require(bytes(_cidFoto).length > 0, "CID foto tidak boleh kosong");

        rec.timestamp_checkout = block.timestamp;
        rec.cid_foto_checkout  = _cidFoto;
        rec.sudah_checkout     = true;

        emit CheckOut(msg.sender, tanggal, _cidFoto, block.timestamp);
    }

    // ===================== VIEW FUNCTIONS =====================

    function getRecord(address _wallet, uint256 _tanggal)
        public view returns (AttendanceRecord memory) {
        return records[_wallet][_tanggal];
    }

    function getRecordHariIni(address _wallet)
        public view returns (AttendanceRecord memory) {
        return records[_wallet][getTanggalHariIni()];
    }

    function getHistory(address _wallet)
        public view returns (uint256[] memory) {
        return attendanceDates[_wallet];
    }

    function getStatusHariIni(address _wallet)
        public view returns (bool sudahCheckin, bool sudahCheckout) {
        uint256 tanggal = getTanggalHariIni();
        AttendanceRecord memory rec = records[_wallet][tanggal];
        return (rec.sudah_checkin, rec.sudah_checkout);
    }

    function getTotalHadir(address _wallet)
        public view returns (uint256) {
        return attendanceDates[_wallet].length;
    }
}
