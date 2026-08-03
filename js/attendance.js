// ============================================================
// ATTENDANCE.JS
// Logika halaman user: check-in, check-out, kamera, riwayat
// ============================================================

let walletUser;
let aksiPresensi = null; // "checkin" atau "checkout"

// ---- Init saat halaman load ----
window.addEventListener("load", async () => {
    walletUser = await connectWallet();
    if (!walletUser) {
        window.location.href = "index.html";
        return;
    }

    // Cek akses NFT
    const punyaAkses = await nftContract.methods.hasAccess(walletUser).call();
    if (!punyaAkses) {
        showAlert("Wallet ini tidak memiliki akses presensi!", "error");
        setTimeout(() => window.location.href = "index.html", 2500);
        return;
    }

    // Tampilkan info pengguna
    const userData = await nftContract.methods.getUserData(walletUser).call();
    document.getElementById("walletInfo").innerText  = formatAddress(walletUser);
    document.getElementById("userNama").innerText    = userData.nama  || "Pengguna";
    document.getElementById("userID").innerText      = "ID: " + (userData.id || "-");
    document.getElementById("userWallet").innerText  = walletUser;

    // Tanggal hari ini
    const now = new Date();
    document.getElementById("tanggalHariIni").innerText =
        now.toLocaleDateString("id-ID", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

    await loadStatusHariIni();
    await loadRiwayat();
});

// ---- Load status check-in/out hari ini ----
async function loadStatusHariIni() {
    try {
        const status = await attendanceContract.methods.getStatusHariIni(walletUser).call();
        const rec    = await attendanceContract.methods.getRecordHariIni(walletUser).call();

        const tsCI = toNum(rec.timestamp_checkin);
        const tsCO = toStr(rec.timestamp_checkout);

        // Update icon dan waktu check-in
        if (status.sudahCheckin) {
            document.getElementById("iconCI").innerText   = "✅";
            document.getElementById("waktuCI").innerText  = formatTimestamp(tsCI);
        }

        // Update icon dan waktu check-out
        if (status.sudahCheckout) {
            document.getElementById("iconCO").innerText   = "✅";
            document.getElementById("waktuCO").innerText  = formatTimestamp(tsCO);
        }

        // Atur tombol presensi
        const btnCI = document.getElementById("btnCI");
        const btnCO = document.getElementById("btnCO");

        if (status.sudahCheckin && status.sudahCheckout) {
            // Sudah lengkap hari ini
            btnCI.disabled = true;
            btnCO.disabled = true;
            btnCI.innerText = "✅ Sudah Check-In";
            btnCO.innerText = "✅ Sudah Check-Out";
            document.getElementById("judulPresensi").innerText = "Presensi hari ini sudah lengkap 🎉";

        } else if (status.sudahCheckin && !status.sudahCheckout) {
            // Sudah check-in, belum check-out
            btnCI.disabled  = true;
            btnCI.innerText = "✅ Sudah Check-In";
            btnCO.disabled  = false;

        } else {
            // Belum check-in sama sekali
            btnCI.disabled = false;
            btnCO.disabled = true; // Tidak bisa checkout sebelum checkin
        }

    } catch(e) {
        console.error("Gagal load status:", e);
    }
}

// ---- Load riwayat presensi ----
async function loadRiwayat() {
    const tbody = document.getElementById("riwayatBody");
    try {
        const dates = await attendanceContract.methods.getHistory(walletUser).call();

        if (dates.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-soft" style="padding:20px">Belum ada riwayat presensi</td></tr>`;
            return;
        }

        const datesNum = [...dates].map(d => toNum(d)).slice().reverse().slice(0, 10);

        let html = "";
        for (const tanggal of datesNum) {
            const rec = await attendanceContract.methods.getRecord(walletUser, tanggal).call();

            const tsCI = toNum(rec.timestamp_checkin)
            const tsCO = toStr(rec.timestamp_checkout)

            const fotoCILink = rec.cid_foto_checkin
                ? `<a href="${CONFIG.IPFS_GATEWAY}${rec.cid_foto_checkin}" target="_blank" class="badge badge-success">Lihat</a>`
                : "-";

            let statusBadge = '<span class="badge badge-warning">Check-In</span>';
            if (rec.sudah_checkout) statusBadge = '<span class="badge badge-success">Lengkap</span>';

            html += `
                <tr>
                    <td>${formatTanggal(tanggal)}</td>
                    <td>${formatTimestamp(tsCI)}</td>
                    <td>${rec.sudah_checkout ? formatTimestamp(tsCO) : "-"}</td>
                    <td>${fotoCILink}</td>
                    <td>${statusBadge}</td>
                </tr>`;
        }

        tbody.innerHTML = html;

    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-soft" style="padding:20px">Gagal memuat riwayat</td></tr>`;
    }
}

// ---- Mulai proses presensi ----
async function mulaiPresensi(aksi) {
    aksiPresensi     = aksi;
}

// ---- Kirim presensi ke blockchain ----
async function kirimPresensi() {
    // Tampilkan loading
    document.getElementById("stepKonfirmasi").classList.add("hidden");
    document.getElementById("stepLoading").classList.remove("hidden");


    try {
        // Step 2: Kirim transaksi ke blockchain
        document.getElementById("loadingText").innerText = "Menunggu konfirmasi blockchain...";

        let tx;
        if (aksiPresensi === "checkin") {
            tx = await attendanceContract.methods
                .send({ from: walletUser });
        } else {
            tx = await attendanceContract.methods
                .send({ from: walletUser });
        }

        // Step 3: Tampilkan sukses
        document.getElementById("stepLoading").classList.add("hidden");
        document.getElementById("stepSukses").classList.remove("hidden");
        
        const judul = aksiPresensi === "checkin" ? "Check-In Berhasil! ✅" : "Check-Out Berhasil! 🏁";
        const sub   = aksiPresensi === "checkin"
        ? "Kehadiranmu telah tercatat di blockchain."
        : "Check-out berhasil. Sampai jumpa besok!";
        
        document.getElementById("suksesJudul").innerText = judul;
        document.getElementById("suksesSub").innerText   = sub;
        
        const txLink = `https://amoy.polygonscan.com/tx/${tx.transactionHash}`;
        document.getElementById("suksesTX").innerText = tx.transactionHash;
        document.getElementById("suksesTX").href      = txLink;
        
        // Reload status
        await loadStatusHariIni();
        await loadRiwayat();
        
    } catch(e) {
        document.getElementById("stepLoading").classList.add("hidden");
        document.getElementById("stepKonfirmasi").classList.remove("hidden");
        
        let pesanError = e.message || "Terjadi kesalahan";
        if (pesanError.includes("Sudah check-in")) {
            pesanError = "Kamu sudah melakukan check-in hari ini!";
        } else if (pesanError.includes("Belum check-in")) {
            pesanError = "Kamu belum check-in hari ini!";
        } else if (pesanError.includes("Sudah check-out")) {
            pesanError = "Kamu sudah melakukan check-out hari ini!";
        } else if (pesanError.includes("User denied")) {
            pesanError = "Transaksi dibatalkan di MetaMask.";
        }
        
        showAlert("❌ " + pesanError, "error");
    }
}


// ---- Reset setelah sukses ----
function resetPresensi() {
    aksiPresensi     = null;

    document.getElementById("stepSukses").classList.add("hidden");
    document.getElementById("stepPilih").classList.remove("hidden");
    document.getElementById("judulPresensi").innerText = "Lakukan Presensi";
}

function tampilStep(stepId) {
    const steps = ["stepPilih","stepKonfirmasi","stepLoading","stepSukses"];
    steps.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });
    const target = document.getElementById(stepId);
    if (target) target.classList.remove("hidden");
}
