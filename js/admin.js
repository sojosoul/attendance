// ============================================================
// ADMIN.JS
// Logika halaman admin: mint NFT, cabut akses, rekap presensi
// ============================================================

let walletAdmin;
// let rekapData = []; // untuk export CSV

// ---- Init saat halaman load ----
window.addEventListener("load", async () => {
    walletAdmin = await connectWallet();
    if (!walletAdmin) {
        window.location.href = "index.html";
        return;
    }

    // Cek apakah wallet ini owner contract
    const owner = await nftContract.methods.owner().call();
    if (owner.toLowerCase() !== walletAdmin.toLowerCase()) {
        showAlert("Kamu bukan admin sistem ini!", "error");
        setTimeout(() => window.location.href = "index.html", 2000);
        return;
    }

    document.getElementById("walletInfo").innerText = "Admin: " + formatAddress(walletAdmin);
    await loadStats();
});

// ---- Switch tab ----
function switchTab(tabId, btn) {
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
    btn.classList.add("active");

    if (tabId === "tab-rekap") loadRekap();
}

// ---- Load statistik ----
async function loadStats() {
    try {
        const total = await nftContract.methods.totalRegistered().call();
        document.getElementById("statTotal").innerText = total;

        const wallets = await nftContract.methods.getAllRegisteredWallets().call();
        let hadir = 0, checkout = 0;

        for (const wallet of wallets) {
            try {
                const status = await attendanceContract.methods.getStatusHariIni(wallet).call();
                if (status.sudahCheckin)  hadir++;
                if (status.sudahCheckout) checkout++;
            } catch(e) {}
        }

        document.getElementById("statHadir").innerText   = hadir;
        document.getElementById("statCheckout").innerText = checkout;

    } catch(e) {
        console.error("Gagal load stats:", e);
    }
}

// ---- MINT NFT ----
async function prosesMintt() {
    const nama   = document.getElementById("inputNama").value.trim();
    const id     = document.getElementById("inputID").value.trim();
    const wallet = document.getElementById("inputWallet").value.trim();

    if (!nama || !id || !wallet) {
        showAlert("Semua field harus diisi!", "error");
        return;
    }

    if (!web3.utils.isAddress(wallet)) {
        showAlert("Format wallet address tidak valid!", "error");
        return;
    }

    // Cek apakah sudah terdaftar
    const sudahDaftar = await nftContract.methods.isRegistered(wallet).call();
    if (sudahDaftar) {
        showAlert("Wallet ini sudah terdaftar!", "error");
        return;
    }

    setLoading("btnMint", true, "⏳ Upload metadata ke IPFS...");

    try {
        // Step 2: Mint NFT
        showAlert("Minting NFT ke blockchain...", "info");
        const tx = await nftContract.methods
            .mintAccess(wallet, nama, id)
            .send({ from: walletAdmin });

        // Step 3: Tampilkan hasil
        document.getElementById("mintCID").innerText = cidMetadata;
        document.getElementById("mintTX").innerText  = tx.transactionHash;
        document.getElementById("mintTX").href =
            `https://sepolia.etherscan.io/tx/${tx.transactionHash}`;
            
        document.getElementById("mintResult").classList.remove("hidden");

        // Reset form
        document.getElementById("inputNama").value   = "";
        document.getElementById("inputID").value     = "";
        document.getElementById("inputWallet").value = "";

        showAlert(`✅ NFT berhasil diterbitkan untuk ${nama}!`, "success");
        await loadStats();

    } catch(e) {
        showAlert("Gagal mint NFT: " + (e.message || e), "error");
    } finally {
        setLoading("btnMint", false);
    }
}

// ---- CEK USER (sebelum revoke) ----
async function cekUserRevoke() {
    const wallet = document.getElementById("inputRevokeWallet").value.trim();
    if (!wallet || !web3.utils.isAddress(wallet)) {
        showAlert("Masukkan wallet address yang valid!", "error");
        return;
    }

    try {
        const data = await nftContract.methods.getUserData(wallet).call();
        const infoEl = document.getElementById("revokeUserInfo");

        if (!data.aktif) {
            showAlert("Wallet ini tidak terdaftar dalam sistem.", "error");
            infoEl.classList.add("hidden");
            document.getElementById("btnRevoke").disabled = true;
            return;
        }

        document.getElementById("revokeNama").innerText   = data.nama;
        document.getElementById("revokeID").innerText     = data.id;
        document.getElementById("revokeStatus").innerHTML = '<span class="badge badge-success">Aktif</span>';
        infoEl.classList.remove("hidden");
        document.getElementById("btnRevoke").disabled = false;

    } catch(e) {
        showAlert("Gagal cek user: " + e.message, "error");
    }
}

// ---- REVOKE AKSES ----
async function prosesRevoke() {
    const wallet = document.getElementById("inputRevokeWallet").value.trim();
    const nama   = document.getElementById("revokeNama").innerText;

    if (!confirm(`Yakin ingin mencabut akses ${nama}?`)) return;

    setLoading("btnRevoke", true, "⏳ Mencabut akses...");

    try {
        const tx = await nftContract.methods
            .revokeAccess(wallet)
            .send({ from: walletAdmin });

        document.getElementById("revokeTX").innerText = tx.transactionHash;
        document.getElementById("revokeTX").href =
            `https://amoy.polygonscan.com/tx/${tx.transactionHash}`;
        document.getElementById("revokeResult").classList.remove("hidden");
        document.getElementById("revokeUserInfo").classList.add("hidden");
        document.getElementById("inputRevokeWallet").value = "";
        document.getElementById("btnRevoke").disabled = true;

        showAlert(`✅ Akses ${nama} berhasil dicabut!`, "success");
        await loadStats();

    } catch(e) {
        showAlert("Gagal cabut akses: " + (e.message || e), "error");
    } finally {
        setLoading("btnRevoke", false);
    }
}

// ---- LOAD REKAP HARI INI ----
async function loadRekap() {
    const tbody = document.getElementById("rekapBody");
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-soft" style="padding:20px">Memuat data...</td></tr>`;
    rekapData = [];

    try {
        const wallets = await nftContract.methods.getAllRegisteredWallets().call();
        if (wallets.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-soft" style="padding:20px">
            Belum ada pengguna terdaftar</td></tr>`;
            return;
        }

        let html = "";
        for (let i = 0; i < wallets.length; i++) {
            const wallet = wallets[i];
            const userData = await nftContract.methods.getUserData(wallet).call();
            if (!userData.aktif) continue;

            const record = await attendanceContract.methods.
            getRecordHariIni(wallet).call();

            const tsCI = toNum(record.timestamp_checkin)
            const tsCO = toStr(record.timestamp_checkout)

            const waktuCI = record.sudah_checkin  ? formatTimestamp(tsCI)  : "-";
            const waktuCO = record.sudah_checkout ? formatTimestamp(tsCO) : "-";

            let statusBadge = '<span class="badge badge-gray">Belum Hadir</span>';
            if (record.sudah_checkout) statusBadge = '<span class="badge badge-success">Selesai</span>';
            else if (record.sudah_checkin) statusBadge = '<span class="badge badge-warning">Check-In</span>';

            html += `
                <tr>
                    <td>${i + 1}</td>
                    <td><b>${userData.nama}</b></td>
                    <td>${userData.id}</td>
                    <td style="font-size:11px">${formatAddress(wallet)}</td>
                    <td>${waktuCI}</td>
                    <td>${waktuCO}</td>
                </tr>`;

            rekapData.push({
                nama: userData.nama,
                id: userData.id,
                wallet,
                checkin: waktuCI,
                checkout: waktuCO,
            });
        }

        tbody.innerHTML = html || `<tr><td colspan="8" class="text-center text-soft" style="padding:20px">Tidak ada data</td></tr>`;

    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-soft" style="padding:20px">Gagal memuat: ${e.message}</td></tr>`;
    }
}

// ---- LOAD RIWAYAT PER PENGGUNA ----
async function loadRiwayat() {
    const wallet = document.getElementById("inputRiwayatWallet").value.trim();
    const tbody  = document.getElementById("riwayatBody");

    if (!wallet || !web3.utils.isAddress(wallet)) {
        showAlert("Masukkan wallet address yang valid!", "error");
        return;
    }

    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-soft" style="padding:20px">Memuat...</td></tr>`;

    try {
        const dates = await attendanceContract.methods.getHistory(wallet).call();

        if (dates.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-soft" style="padding:20px">Belum ada riwayat presensi</td></tr>`;
            return;
        }

        const datesNum = [...dates].map(d => toNum(d)).reverse();

        let html = "";
        for (const tanggal of datesNum) {
            const rec = await attendanceContract.methods.
            getRecord(wallet, tanggal).call();

            const tsCI = toNum(rec.timestamp_checkin);
            const tsCO = toStr(rec.timestamp_checkout);            

            let statusBadge = '<span class="badge badge-warning">Hanya Check-In</span>';
            if (rec.sudah_checkout) statusBadge = '<span class="badge badge-success">Lengkap</span>';

            html += `
                <tr>
                    <td>${formatTanggal(tanggal)}</td>
                    <td>${formatTimestamp(tsCI)}</td>
                    <td>${rec.sudah_checkout ? formatTimestamp(tsCO) : "-"}</td>
                    <td>${statusBadge}</td>
                </tr>`;
        }

        tbody.innerHTML = html;

    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:20px;color:red">Gagal: ${e.message}</td></tr>`;
    }
}

// ---- EXPORT CSV ----
// function exportCSV() {
//     if (rekapData.length === 0) {
//         showAlert("Tidak ada data untuk diexport. Klik Refresh dulu.", "error");
//         return;
//     }

//     const header = ["Nama","ID","Wallet","Check-In","Check-Out","CID Foto CI","CID Foto CO"];
//     const rows   = rekapData.map(d =>
//         [d.nama, d.id, d.wallet, d.checkin, d.checkout, d.cid_ci, d.cid_co]
//     );

//     const csv     = [header, ...rows].map(r => r.join(",")).join("\n");
//     const blob    = new Blob([csv], { type: "text/csv" });
//     const url     = URL.createObjectURL(blob);
//     const a       = document.createElement("a");
//     const tanggal = new Date().toISOString().split("T")[0];

//     a.href     = url;
//     a.download = `rekap-presensi-${tanggal}.csv`;
//     a.click();
//     URL.revokeObjectURL(url);
// }
