// ============================================================
// WEB3-INIT.JS
// Setup koneksi MetaMask dan instance contract
// ============================================================

let web3;
let nftContract;
let attendanceContract;
let currentWallet;

// ---- Connect MetaMask ----
async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        showAlert("MetaMask tidak ditemukan. Silakan install MetaMask terlebih dahulu.", "error");
        return null;
    }

    try {
        // Minta akses wallet
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });
        currentWallet = accounts[0];

        // Cek network — harus Polygon Amoy
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (chainId !== CONFIG.CHAIN_ID) {
            await switchToSepolia();
        }

        // Inisialisasi Web3 dan contract
        web3 = new Web3(window.ethereum);
        nftContract = new web3.eth.Contract(NFT_ABI, CONFIG.NFT_ADDRESS);
        attendanceContract = new web3.eth.Contract(ATTENDANCE_ABI, CONFIG.ATTENDANCE_ADDRESS);

        // Listen perubahan account
        window.ethereum.on("accountsChanged", (accounts) => {
            currentWallet = accounts[0];
            location.reload();
        });

        return currentWallet;

    } catch (err) {
        showAlert("Gagal connect wallet: " + err.message, "error");
        return null;
    }
}

// ---- Switch ke Polygon Amoy ----
async function switchToSepolia() {
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CONFIG.CHAIN_ID }],
        });
    } catch (err) {
        // Kalau network belum ada, tambahkan
        if (err.code === 4902) {
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: CONFIG.CHAIN_ID,
                    chainName: "Polygon Amoy Testnet",
                    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
                    rpcUrls: ["https://rpc-amoy.polygon.technology/"],
                    blockExplorerUrls: ["https://amoy.polygonscan.com/"],
                }],
            });
        }
    }
}

// ---- Format wallet address ----
function formatAddress(addr) {
    if (!addr) return "";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// ---- Format timestamp ke tanggal & jam ----
function formatTimestamp(ts) {
    if (!ts || ts == 0) return "-";
    const d = new Date(ts * 1000);
    return d.toLocaleDateString("id-ID") + " " + d.toLocaleTimeString("id-ID");
}

// ---- Format YYYYMMDD ke tanggal readable ----
function formatTanggal(yyyymmdd) {
    const s = yyyymmdd.toString();
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    const bulan = ["","Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
    return `${d} ${bulan[parseInt(m)]} ${y}`;
}

// ---- Upload foto ke IPFS via Pinata ----
async function uploadFotoIPFS(blob) {
    const formData = new FormData();
    formData.append("file", blob, "presensi.jpg");

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${CONFIG.PINATA_JWT}` },
        body: formData,
    });

    if (!res.ok) throw new Error("Gagal upload foto ke IPFS");
    const data = await res.json();
    return data.IpfsHash; // CID
}

// ---- Upload metadata JSON ke IPFS via Pinata ----
async function uploadMetadataIPFS(nama, id) {
    const metadata = {
        name: `Presensi Access - ${nama}`,
        description: "NFT akses sistem presensi terdesentralisasi",
        attributes: [
            { trait_type: "Nama", value: nama },
            { trait_type: "ID",   value: id   },
            { trait_type: "Status", value: "Active" },
            { trait_type: "Tanggal Daftar", value: new Date().toISOString().split("T")[0] }
        ]
    };

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${CONFIG.PINATA_JWT}`
        },
        body: JSON.stringify(metadata),
    });

    if (!res.ok) throw new Error("Gagal upload metadata ke IPFS");
    const data = await res.json();
    return data.IpfsHash; // CID metadata
}

// ---- Tampilkan alert / notifikasi ----
function showAlert(pesan, tipe = "info") {
    const existing = document.getElementById("alert-box");
    if (existing) existing.remove();

    const div = document.createElement("div");
    div.id = "alert-box";
    div.className = `alert alert-${tipe}`;
    div.innerText = pesan;

    document.body.prepend(div);
    setTimeout(() => div.remove(), 5000);
}

// ---- Loading state ----
function setLoading(btnId, loading, teks = "") {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.dataset.original = btn.innerText;
        btn.innerText = teks || "Memproses...";
    } else {
        btn.innerText = btn.dataset.original || btn.innerText;
    }
}

// BigInt to Num
function toNum(val) {
    if (val == null || val == undefined || val == BigInt) return 0;
    return Number(val)
}

// BigInt to String
function toStr(val) {
    if (val == null || val == undefined || val == BigInt) return "";
    return val.toString()
}

