/**
 * Modul: publik-aduan.js
 * Deskripsi: Formulir pengaduan mandiri sengketa bansos dan stepper 4 tahapan investigasi
 */

// 8. STATE, RESUME & PANTAU PENGADUAN MANDIRI (TANPA LAPOR ULANG)
// =========================================================================
function cekResumeAduanLokal() {
    const lastNik = localStorage.getItem('lastAduanNik');
    const lastNama = localStorage.getItem('lastAduanNama');
    const cardResume = document.getElementById('cardResumeAduanCepat');
    if (lastNik && lastNama && cardResume) {
        const rNama = document.getElementById('resumeAduanNama');
        const rNik = document.getElementById('resumeAduanNik');
        if (rNama) rNama.innerText = lastNama;
        if (rNik) rNik.innerText = lastNik;
        cardResume.style.display = 'block';
    }
}

window.bukaAduanTersimpan = function () {
    const lastNik = localStorage.getItem('lastAduanNik');
    if (lastNik) {
        const inp = document.getElementById('inputNikPantauAduan');
        if (inp) inp.value = lastNik;
        window.lacakAduanWarga();
    }
};

window.lacakAduanWarga = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const nik = document.getElementById('inputNikPantauAduan')?.value.trim();

    if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) {
        return showPortalAlert({ icon: 'warning', title: 'Peringatan', text: 'Masukkan tepat 16 digit NIK pelapor.' });
    }

    showPortalAlert({ title: 'Mencari Berkas Aduan...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        const res = await fetch(`${API_URL}/api/publik/cek-aduan?nik=${encodeURIComponent(nik)}`);
        const json = await res.json().catch(() => ({}));
        Swal?.close();

        if (res.ok && json.data) {
            const d = json.data;
            window.masukDashboardPengaduan(d.nik, d.nama, d.uraian, false);
            showPortalAlert({ icon: 'success', title: 'Aduan Ditemukan', text: `Selamat datang kembali, ${d.nama}.`, timer: 1200, showConfirmButton: false });
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Belum Ada Aduan',
                text: 'NIK ini belum memiliki riwayat pengaduan. Ingin membuat aduan baru?',
                showCancelButton: true,
                confirmButtonText: 'Buat Aduan via Asisten Bot',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#dc2626'
            }).then(r => {
                if (r.isConfirmed) {
                    window.botBukaFormLapor();
                }
            });
        }
    } catch (err) {
        Swal?.close();
        showPortalAlert({ icon: 'error', title: 'Gangguan Jaringan', text: 'Gagal menghubungi server basis data.' });
    }
};

window.masukDashboardPengaduan = function (nik, nama, uraian, isNewReport = false) {
    sesiAduanAktif = { nik, nama, uraian };
    localStorage.setItem('lastAduanNik', nik);
    localStorage.setItem('lastAduanNama', nama);

    window.switchTabPublik('sectionDashboardPengaduan');

    const dispNama = document.getElementById('aduanNamaDisplay');
    const dispNik = document.getElementById('aduanNikDisplay');
    const dispUraian = document.getElementById('aduanUraianDisplay');

    if (dispNama) dispNama.innerText = nama;
    if (dispNik) dispNik.innerText = nik;
    if (dispUraian) dispUraian.innerText = uraian;

    window.initPeerWarga();

    if (isNewReport) {
        fetch(`${API_URL}/api/publik/pengaduan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nik: nik,
                nama_pelapor: nama,
                kategori: 'Aduan Belum Terdaftar',
                isi_laporan: uraian
            })
        }).catch(() => {});
    }

    lastAduanChatHash = '';
    window.sinkronStatusStepperAduan();
    window.muatPesanAduan(true);

    // Daftarkan listener real-time instan untuk pembaruan stepper & status aduan
    if (window.RealtimeHub && typeof window.RealtimeHub.on === 'function') {
        window.RealtimeHub.on('ADUAN_UPDATE', (evt) => {
            if (sesiAduanAktif && evt.nik === sesiAduanAktif.nik) {
                window.sinkronStatusStepperAduan();
            }
        });
        window.RealtimeHub.on('PUTUSAN_SUPERADMIN', (evt) => {
            if (sesiAduanAktif && evt.nik === sesiAduanAktif.nik) {
                window.sinkronStatusStepperAduan();
                window.muatPesanAduan(true);
            }
        });
    }

    if (!aduanChatInterval) {
        aduanChatInterval = setInterval(() => {
            // Hanya poll jika koneksi realtime terputus untuk menghemat bandwidth & cegah glitch
            if (window.RealtimeHub && window.RealtimeHub.isConnected()) {
                return;
            }
            window.muatPesanAduan(false);
            window.sinkronStatusStepperAduan();
        }, 5000);
    }
};

window.keluarDashboardPengaduan = function () {
    if (aduanChatInterval) {
        clearInterval(aduanChatInterval);
        aduanChatInterval = null;
    }
    sesiAduanAktif = null;
    window.switchTabPublik('pantauAduanSection');
};

// =========================================================================
// SINKRONISASI STEPPER ADUAN (STEP 4 HIJAU DENGAN CENTANG GANDA)
// =========================================================================
window.sinkronStatusStepperAduan = async function () {
    if (!sesiAduanAktif) return;
    try {
        const res = await fetch(`${API_URL}/api/publik/cek-aduan?nik=${encodeURIComponent(sesiAduanAktif.nik)}`);
        const json = await res.json();
        if (json.status === 'success' && json.data) {
            const d = json.data;
            const step = parseInt(d.status_step || 2, 10);
            
            const badge = document.getElementById('aduanStatusTextBadge');
            if (badge) {
                badge.innerText = d.status_text || 'Ditinjau Petugas';
                badge.style.background = (step === 4) ? '#e6f9f0' : '#fee2e2';
                badge.style.color = (step === 4) ? '#009846' : '#dc2626';
            }
            
            const catatan = document.getElementById('aduanCatatanPetugasDisplay');
            if (catatan) catatan.innerText = d.catatan_petugas || 'Petugas sedang meninjau berkas Anda.';

            for (let i = 1; i <= 4; i++) {
                const node = document.getElementById(`stepNode${i}`);
                const circle = document.getElementById(`stepCircle${i}`) || node?.querySelector('.step-circle');
                if (!node || !circle) continue;

                node.classList.remove('done', 'active');

                if (step === 4) {
                    node.classList.add('done');
                    circle.style.background = '#009846';
                    circle.style.boxShadow = '0 0 14px rgba(0, 152, 70, 0.4)';
                    circle.innerHTML = (i === 4) ? '<i class="fas fa-check-double"></i>' : '<i class="fas fa-check"></i>';
                } else if (i < step) {
                    node.classList.add('done');
                    circle.style.background = '#009846';
                    circle.style.boxShadow = 'none';
                    circle.innerHTML = '<i class="fas fa-check"></i>';
                } else if (i === step) {
                    node.classList.add('active');
                    circle.style.background = '#dc2626';
                    circle.style.boxShadow = '0 0 14px rgba(220, 38, 38, 0.45)';
                    circle.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
                } else {
                    circle.style.background = '#cbd5e1';
                    circle.style.boxShadow = 'none';
                    circle.innerText = i;
                }
            }
        }
    } catch (e) {}
};

// =========================================================================
