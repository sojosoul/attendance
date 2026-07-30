// ============================================================
// CAMERA.JS
// Akses kamera perangkat dan capture foto selfie
// ============================================================

let videoStream = null;

// ---- Mulai kamera ----
async function startCamera(videoElementId) {
    const video = document.getElementById(videoElementId);
    if (!video) return;

    try {
        // Minta akses kamera — prioritas kamera depan untuk selfie
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: 640, height: 480 },
            audio: false
        });

        video.srcObject = videoStream;
        await video.play();
        return true;

    } catch (err) {
        if (err.name === "NotAllowedError") {
            showAlert("Izin kamera ditolak. Silakan izinkan akses kamera di browser.", "error");
        } else if (err.name === "NotFoundError") {
            showAlert("Kamera tidak ditemukan pada perangkat ini.", "error");
        } else {
            showAlert("Gagal akses kamera: " + err.message, "error");
        }
        return false;
    }
}

// ---- Stop kamera ----
function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    const videos = document.querySelectorAll("video");
    videos.forEach(v => { v.srcObject = null; });
}

// ---- Capture foto dari video stream ----
function capturePhoto(videoElementId, canvasElementId) {
    const video  = document.getElementById(videoElementId);
    const canvas = document.getElementById(canvasElementId);
    if (!video || !canvas) return null;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");

    // Mirror foto selfie (agar tidak terbalik)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Tampilkan preview canvas
    canvas.style.display = "block";

    return canvas;
}

// ---- Konversi canvas ke Blob (untuk upload IPFS) ----
async function canvasToBlob(canvas, quality = 0.85) {
    return new Promise((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", quality);
    });
}

// ---- Ambil koordinat GPS ----
async function getGPS() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("GPS tidak didukung browser ini"));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat:  pos.coords.latitude.toString(),
                    long: pos.coords.longitude.toString(),
                    accuracy: pos.coords.accuracy
                });
            },
            (err) => {
                // GPS gagal tapi tidak block presensi — kirim string kosong
                console.warn("GPS tidak tersedia:", err.message);
                resolve({ lat: "0", long: "0", accuracy: 0 });
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    });
}
