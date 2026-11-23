// ===== Elemen =====
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");
const cameraMsg = document.getElementById("cameraMsg");
const btnStart = document.getElementById("btnStart");
const btnCapture = document.getElementById("btnCapture");
const btnRetake = document.getElementById("btnRetake");
const form = document.getElementById("formAbsen");
const inputNama = document.getElementById("nama");
const inputId = document.getElementById("idPeserta");
const selectStatus = document.getElementById("status");
const checkLokasi = document.getElementById("pakaiLokasi");
const pesan = document.getElementById("pesan");
const tabelBody = document.getElementById("tabelBody");
const kosong = document.getElementById("kosong");
const btnExport = document.getElementById("btnExport");
const btnHapusSemua = document.getElementById("btnHapusSemua");

const STORAGE_KEY = "absensi_selfie_data";

let stream = null;
let fotoData = null; // hasil selfie (base64)

// ===== Jam & tanggal =====
function updateJam() {
  const now = new Date();
  document.getElementById("tanggal").textContent = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  document.getElementById("jam").textContent = now.toLocaleTimeString("id-ID", {
    hour12: false,
  });
}
updateJam();
setInterval(updateJam, 1000);

// ===== Penyimpanan =====
function ambilData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function simpanData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    tampilPesan("Penyimpanan penuh. Hapus sebagian data lama.", "error");
    return false;
  }
}

// ===== Pesan =====
function tampilPesan(teks, tipe) {
  pesan.textContent = teks;
  pesan.className = "pesan " + (tipe || "");
}

// ===== Kamera =====
async function nyalakanKamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    tampilPesan("Browser tidak mendukung kamera. Gunakan Chrome/Edge terbaru.", "error");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    cameraMsg.classList.add("hide");
    btnCapture.disabled = false;
    btnStart.textContent = "Matikan Kamera";
    tampilPesan("", "");
  } catch (err) {
    let teks = "Gagal mengakses kamera.";
    if (err.name === "NotAllowedError") {
      teks = "Izin kamera ditolak. Klik ikon gembok di address bar lalu izinkan kamera.";
    } else if (err.name === "NotFoundError") {
      teks = "Kamera tidak ditemukan di perangkat ini.";
    } else if (err.name === "NotReadableError") {
      teks = "Kamera sedang dipakai aplikasi lain.";
    }
    tampilPesan(teks, "error");
  }
}

function matikanKamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
  cameraMsg.textContent = "Kamera belum aktif";
  cameraMsg.classList.remove("hide");
  btnCapture.disabled = true;
  btnStart.textContent = "Aktifkan Kamera";
}

btnStart.addEventListener("click", () => {
  if (stream) {
    matikanKamera();
  } else {
    nyalakanKamera();
  }
});

// ===== Ambil foto =====
btnCapture.addEventListener("click", () => {
  if (!stream || !video.videoWidth) return;

  // Perkecil agar hemat ruang penyimpanan
  const lebarMaks = 480;
  const skala = Math.min(1, lebarMaks / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * skala);
  canvas.height = Math.round(video.videoHeight * skala);

  const ctx = canvas.getContext("2d");
  // Foto disimpan apa adanya (tidak dicerminkan); tampilan dicerminkan lewat CSS
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  fotoData = canvas.toDataURL("image/jpeg", 0.7);

  preview.src = fotoData;
  preview.hidden = false;
  video.hidden = true;
  btnCapture.hidden = true;
  btnRetake.hidden = false;
  tampilPesan("", "");
});

btnRetake.addEventListener("click", () => {
  fotoData = null;
  preview.hidden = true;
  video.hidden = false;
  btnCapture.hidden = false;
  btnRetake.hidden = true;
});

// Preview selfie juga dicerminkan agar sama dengan tampilan video
preview.style.transform = "scaleX(-1)";

// ===== Lokasi =====
function ambilLokasi() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// ===== Kirim absensi =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nama = inputNama.value.trim();
  const id = inputId.value.trim();
  const status = selectStatus.value;

  if (!nama || !id) {
    tampilPesan("Nama dan NIM/ID wajib diisi.", "error");
    return;
  }
  if (!fotoData) {
    tampilPesan("Ambil foto selfie terlebih dahulu.", "error");
    return;
  }

  const data = ambilData();
  const hariIni = new Date().toDateString();
  const sudahAbsen = data.some(
    (d) => d.id === id && new Date(d.waktu).toDateString() === hariIni
  );
  if (sudahAbsen) {
    tampilPesan("NIM/ID ini sudah absen hari ini.", "error");
    return;
  }

  let lokasi = null;
  if (checkLokasi.checked) {
    tampilPesan("Mengambil lokasi...", "");
    lokasi = await ambilLokasi();
    if (!lokasi) {
      tampilPesan("Lokasi tidak bisa diambil, absensi tetap disimpan tanpa lokasi.", "");
    }
  }

  data.unshift({
    uid: Date.now(),
    nama: nama,
    id: id,
    status: status,
    waktu: new Date().toISOString(),
    foto: fotoData,
    lokasi: lokasi,
  });

  if (!simpanData(data)) return;

  tampilPesan("Absensi berhasil disimpan ✔", "ok");
  form.reset();
  btnRetake.click();
  renderTabel();
});

// ===== Tabel =====
function formatWaktu(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("id-ID", { hour12: false })
  );
}

function buatSel(teks) {
  const td = document.createElement("td");
  td.textContent = teks;
  return td;
}

function renderTabel() {
  const data = ambilData();
  tabelBody.innerHTML = "";
  kosong.hidden = data.length > 0;

  data.forEach((item, i) => {
    const tr = document.createElement("tr");

    tr.appendChild(buatSel(i + 1));

    const tdFoto = document.createElement("td");
    const img = document.createElement("img");
    img.src = item.foto;
    img.alt = "Selfie " + item.nama;
    img.addEventListener("click", () => bukaFoto(item.foto));
    tdFoto.appendChild(img);
    tr.appendChild(tdFoto);

    tr.appendChild(buatSel(item.nama));
    tr.appendChild(buatSel(item.id));

    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge " + item.status;
    badge.textContent = item.status;
    tdStatus.appendChild(badge);
    tr.appendChild(tdStatus);

    tr.appendChild(buatSel(formatWaktu(item.waktu)));

    const tdLok = document.createElement("td");
    if (item.lokasi) {
      const a = document.createElement("a");
      a.href = `https://www.google.com/maps?q=${item.lokasi.lat},${item.lokasi.lng}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Lihat peta";
      tdLok.appendChild(a);
    } else {
      tdLok.textContent = "-";
    }
    tr.appendChild(tdLok);

    const tdAksi = document.createElement("td");
    const btnHapus = document.createElement("button");
    btnHapus.className = "btn btn-danger btn-sm";
    btnHapus.textContent = "Hapus";
    btnHapus.addEventListener("click", () => hapusItem(item.uid));
    tdAksi.appendChild(btnHapus);
    tr.appendChild(tdAksi);

    tabelBody.appendChild(tr);
  });
}

function hapusItem(uid) {
  if (!confirm("Hapus data absensi ini?")) return;
  const data = ambilData().filter((d) => d.uid !== uid);
  simpanData(data);
  renderTabel();
}

btnHapusSemua.addEventListener("click", () => {
  if (ambilData().length === 0) return;
  if (!confirm("Hapus SEMUA data absensi? Tindakan ini tidak bisa dibatalkan.")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderTabel();
});

// ===== Foto besar =====
function bukaFoto(src) {
  const modal = document.createElement("div");
  modal.className = "modal";
  const img = document.createElement("img");
  img.src = src;
  modal.appendChild(img);
  modal.addEventListener("click", () => modal.remove());
  document.body.appendChild(modal);
}

// ===== Ekspor CSV =====
btnExport.addEventListener("click", () => {
  const data = ambilData();
  if (data.length === 0) {
    alert("Belum ada data untuk diunduh.");
    return;
  }

  const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const baris = [["No", "Nama", "NIM/ID", "Status", "Waktu", "Latitude", "Longitude"]];

  data.forEach((d, i) => {
    baris.push([
      i + 1,
      d.nama,
      d.id,
      d.status,
      formatWaktu(d.waktu),
      d.lokasi ? d.lokasi.lat : "",
      d.lokasi ? d.lokasi.lng : "",
    ]);
  });

  const csv = "\uFEFF" + baris.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "absensi.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// Matikan kamera saat halaman ditutup
window.addEventListener("beforeunload", matikanKamera);

// Tampilkan data saat halaman dibuka
renderTabel();
