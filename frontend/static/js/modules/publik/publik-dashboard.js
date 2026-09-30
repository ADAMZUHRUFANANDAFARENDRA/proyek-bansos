/**
 * Modul: publik-dashboard.js
 * Deskripsi: Autentikasi portal warga terdaftar, monitoring bantuan, dan dasbor profil pribadi
 */

// 5. LOGIN DASHBOARD WARGA TERDAFTAR
// =========================================================================
window.masukKePortal = function (nik, nama, email = '') {
    localStorage.setItem('wargaNik', nik);
    localStorage.setItem('wargaNama', nama);
    wargaNik = nik;
    wargaNama = nama;
    sesiWargaAktif = { nik, nama_lengkap: nama, email_login: email };
    window.switchTabPublik('dashboardWargaSection');
    window.loadDashboardWarga();
};

window.loginWarga = window.prosesMasukDashboard = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const nik = document.getElementById('loginNik')?.value.trim();
    const nama = document.getElementById('loginNama')?.value.trim();
    const email = document.getElementById('loginEmail')?.value.trim() || '';

    if (!nik || !nama) {
        return showPortalAlert({ icon: 'warning', title: 'Peringatan', text: 'NIK dan Nama Lengkap wajib diisi.' });
    }

    if (nik.length !== 16 || !/^\d+$/.test(nik)) {
        return showPortalAlert({ icon: 'warning', title: 'Format NIK Salah', text: 'NIK wajib terdiri dari 16 digit angka.' });
    }

    showPortalAlert({ title: 'Memeriksa Akses...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        const res = await fetch(`${API_URL}/api/publik/cek-bansos?nik=${encodeURIComponent(nik)}`);
        const json = await res.json().catch(() => ({}));
        Swal?.close();

        if (res.ok && json.data) {
            const w = json.data;
            const dbNama = (w.nama_lengkap || w.nama || '').toLowerCase();
            const inputNama = nama.toLowerCase();

            if (dbNama.includes(inputNama) || inputNama.includes(dbNama)) {
                sesiWargaAktif = { ...w, email_login: email };
                window.masukKePortal(w.nik, w.nama_lengkap || w.nama, email);
                showPortalAlert({ 
                    icon: 'success', 
                    title: 'Selamat Datang!', 
                    text: `Akses berhasil dibuka untuk ${w.nama_lengkap || w.nama}.`, 
                    timer: 1400, 
                    showConfirmButton: false 
                });
            } else {
                showPortalAlert({ 
                    icon: 'error', 
                    title: 'Data Tidak Cocok', 
                    text: 'Nama lengkap yang dimasukkan tidak cocok dengan NIK terdaftar di sistem.' 
                });
            }
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Belum Terdaftar',
                text: json.message || 'NIK Anda belum terdaftar dalam pangkalan data penetapan bantuan sosial.',
                showCancelButton: true,
                confirmButtonText: 'Daftar Mandiri Sekarang',
                cancelButtonText: 'Buka Dashboard Pengaduan',
                confirmButtonColor: '#009846',
                cancelButtonColor: '#dc2626'
            }).then(r => {
                if (r.isConfirmed) {
                    window.switchTabPublik('daftarMandiriSection');
                    if (document.getElementById('regNik')) document.getElementById('regNik').value = nik;
                    if (document.getElementById('regNama')) document.getElementById('regNama').value = nama;
                    if (document.getElementById('regEmail')) document.getElementById('regEmail').value = email;
                } else if (r.dismiss === Swal.DismissReason.cancel) {
                    window.masukDashboardPengaduan(nik, nama, 'Kendala Akses: Belum Terdaftar di Basis Data Penetapan Bansos');
                }
            });
        }
    } catch (err) {
        Swal?.close();
        showPortalAlert({ 
            icon: 'error', 
            title: 'Koneksi Peladen Terputus', 
            html: '<p style="font-size:0.9rem;">Gagal menghubungi backend di <b>http://127.0.0.1:5000</b>.<br>Pastikan backend Flask (<code>python app.py</code>) dan servis <b>MySQL</b> telah dijalankan.</p>' 
        });
    }
};

window.logoutWarga = function () {
    if (chatIntervalWarga) {
        clearInterval(chatIntervalWarga);
        chatIntervalWarga = null;
    }
    if (currentCallWarga) {
        window.endCallWarga();
    }
    localStorage.removeItem('wargaNik');
    localStorage.removeItem('wargaNama');
    wargaNik = '';
    wargaNama = '';
    wargaDataCache = null;
    sesiWargaAktif = null;
    window.location.reload();
};

// =========================================================================


// 7. DASHBOARD PRIBADI WARGA TERDAFTAR (MONITORING & CHAT)
// =========================================================================
window.bukaDashboardWargaTerdaftar = function () {
    if (!sesiWargaAktif) return;
    window.switchTabPublik('dashboardWargaSection');
    window.loadDashboardWarga();
};

window.loadDashboardWarga = async function () {
    const activeNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
    if (!activeNik) return;

    try {
        const res = await fetch(`${API_URL}/api/publik/cek-bansos?nik=${encodeURIComponent(activeNik)}`);
        const json = await res.json().catch(() => ({}));

        if (json.data) {
            const w = json.data;
            wargaDataCache = w;

            const elNama = document.getElementById('wNama') || document.getElementById('dashWargaNama');
            const elNik = document.getElementById('wNik') || document.getElementById('dashWargaNik');
            const elAlamat = document.getElementById('wAlamat') || document.getElementById('dashWargaAlamat');
            const elStatus = document.getElementById('wStatus') || document.getElementById('dashWargaStatusBansos');
            const elDesil = document.getElementById('dashWargaDesilBadge') || document.getElementById('wDesil');
            const elSalur = document.getElementById('dashWargaStatusSalur');

            if (elNama) elNama.innerText = w.nama_lengkap || w.nama || wargaNama;
            if (elNik) elNik.innerText = w.nik || activeNik;
            if (elAlamat) elAlamat.innerText = w.alamat || 'Kabupaten Sidoarjo';
            if (elStatus) elStatus.innerText = w.status_bansos || 'Diproses';
            if (elDesil && w.desil) elDesil.innerText = `Desil ${w.desil}`;
            if (elSalur) elSalur.innerText = `${w.status_salur || 'Pending'} (${w.nominal_bantuan || 'BLT Rp 300.000'})`;

            let progressHtml = '';
            const statusSalur = w.status_salur || 'Pending';

            if (statusSalur === 'Menunggu Konfirmasi Warga' || statusSalur === 'Disalurkan' || (w.bukti_salur && !w.konfirmasi_warga)) {
                progressHtml = `
                    <div style="background:#ecfdf5; border:1.5px solid #6ee7b7; padding:16px 18px; border-radius:14px; margin-top:10px;">
                        <div style="display:flex; align-items:center; gap:8px; color:#065f46; font-weight:800; font-size:1rem;">
                            <i class="fas fa-truck text-emerald-600"></i> Bantuan Sosial Telah Disalurkan oleh Petugas
                        </div>
                        <p style="font-size:0.88rem; color:#334155; margin:8px 0;">
                            ${safeHtml(w.keterangan_salur || 'Paket bantuan sosial telah diserahterimakan kepada Anda/keluarga di lapangan.')}
                        </p>
                        ${w.tanggal_salur && w.tanggal_salur !== '-' ? `<div style="font-size:0.78rem; color:#059669; margin-bottom:8px;"><i class="fas fa-calendar-check"></i> Waktu Penyaluran: ${safeHtml(w.tanggal_salur)}</div>` : ''}
                        ${w.bukti_salur ? `
                            <div style="margin:8px 0 12px 0;">
                                <a href="/uploads/${w.bukti_salur}" target="_blank" class="btn btn-sm" style="background:#ffffff; border:1px solid #10b981; color:#065f46; font-size:0.78rem; font-weight:700; border-radius:8px; padding:4px 10px; display:inline-flex; align-items:center; gap:6px; text-decoration:none;">
                                    <i class="fas fa-image text-emerald-600"></i> Lihat Foto Bukti Serah Terima
                                </a>
                            </div>
                        ` : ''}
                        <div style="font-size:0.84rem; font-weight:700; color:#1e293b; margin-bottom:8px;">Mohon konfirmasi penerimaan fisik bantuan ini:</div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button onclick="window.konfirmasiTerimaBansos()" class="btn btn-primary" style="background:#10b981; border-color:#10b981; font-size:0.85rem; padding:8px 16px; border-radius:10px; font-weight:800; box-shadow:0 3px 8px rgba(16,185,129,0.3);"><i class="fas fa-check-circle"></i> Ya, Sudah Diterima</button>
                            <button onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="font-size:0.85rem; padding:8px 16px; color:#ef4444; border-color:#fca5a5; border-radius:10px; font-weight:700;"><i class="fas fa-times"></i> Belum Diterima / Sanggah</button>
                        </div>
                    </div>
                `;
            } else if (statusSalur.includes('Sengketa')) {
                progressHtml = `
                    <div style="background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:10px; margin-top:10px;">
                        <div style="color:#dc2626; font-weight:bold;"><i class="fas fa-exclamation-triangle"></i> Laporan Sengketa Sedang Diinvestigasi</div>
                        <p style="font-size:0.88rem; color:#64748b; margin-top:4px;">Petugas Dinsos sedang meninjau sanggahan Anda. Silakan hubungi petugas via Live Chat di samping.</p>
                    </div>
                `;
            } else if (statusSalur === 'Telah Menerima' || statusSalur === 'Selesai' || w.konfirmasi_warga) {
                progressHtml = `
                    <div style="background:#eff6ff; border:1.5px solid #93c5fd; padding:14px 18px; border-radius:14px; margin-top:10px;">
                        <div style="color:#1d4ed8; font-weight:900; font-size:0.98rem; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-check-double text-blue-600"></i> Bantuan Sosial Selesai & Dikonfirmasi Sah
                        </div>
                        <p style="font-size:0.88rem; color:#334155; margin-top:4px;">Bantuan fisik tervalidasi telah diserahterimakan dan dikonfirmasi resmi oleh penerima bansos.</p>
                        ${w.waktu_konfirmasi_warga ? `<small style="color:#2563eb; font-weight:700;"><i class="fas fa-clock"></i> Dikonfirmasi pada: ${safeHtml(w.waktu_konfirmasi_warga)}</small>` : ''}
                    </div>
                `;
            } else if (w.desil <= 4 || w.status_bansos === 'Menerima Bansos') {
                progressHtml = `
                    <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                        <button onclick="window.konfirmasiTerimaBansos()" class="btn btn-primary" style="font-size:0.88rem; padding:9px 16px;"><i class="fas fa-check"></i> Konfirmasi Sudah Terima</button>
                        <button onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="border-color:#ef4444; color:#ef4444; font-size:0.88rem; padding:9px 16px;"><i class="fas fa-exclamation-circle"></i> Belum Menerima Bantuan</button>
                    </div>
                `;
            }

            const actCont = document.getElementById('actionContainer');
            if (actCont) actCont.innerHTML = progressHtml;

            window.loadChatMessagesWarga(true);
            if (!chatIntervalWarga) {
                chatIntervalWarga = setInterval(() => {
                    window.loadChatMessagesWarga(true);
                }, 3500);
            }
        }
    } catch (err) {
        console.error('[Dashboard Error]', err);
    }
};

window.konfirmasiTerimaBansos = function () {
    showPortalAlert({
        title: 'Konfirmasi Penerimaan',
        text: 'Apakah Anda yakin telah menerima paket bantuan sosial dari petugas?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Sudah Terima',
        confirmButtonColor: '#009846',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await fetch(`${API_URL}/api/public/konfirmasi-terima`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nik: wargaNik })
                }).catch(() => null);

                showPortalAlert({ icon: 'success', title: 'Terima Kasih', text: 'Konfirmasi penerimaan bantuan berhasil dicatat.' });
                window.loadDashboardWarga();
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Terjadi gangguan jaringan saat konfirmasi.' });
            }
        }
    });
};

window.konfirmasiTerimaMandiri = function (nik) {
    if (!nik) return;
    showPortalAlert({
        title: 'Konfirmasi Penerimaan Bansos',
        text: `Konfirmasi bahwa Anda dengan NIK ${nik} telah menerima bantuan sosial fisik secara sah?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Sudah Saya Terima',
        confirmButtonColor: '#009846',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                const r = await fetch(`${API_URL}/api/public/konfirmasi-terima`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nik })
                });
                const j = await r.json().catch(() => ({}));
                showPortalAlert({
                    icon: 'success',
                    title: 'Penerimaan Berhasil Dikonfirmasi!',
                    text: j.message || 'Status bantuan sosial Anda kini telah resmi tercatat sebagai Telah Menerima.'
                });
                if (window.cekStatusPublik) {
                    const input = document.getElementById('cekNik') || document.getElementById('lacakNik');
                    if (input) {
                        input.value = nik;
                        window.cekStatusPublik();
                    }
                }
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Kendala Jaringan', text: 'Gagal mengirimkan konfirmasi penerimaan.' });
            }
        }
    });
};

window.laporBansosBelumDiterima = function () {
    showPortalAlert({
        title: 'Laporkan Kendala Penyaluran',
        text: 'Nama Anda tercatat sebagai penerima namun belum menerima bantuan fisik?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Buat Pengaduan',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await fetch(`${API_URL}/api/publik/pengaduan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nik: wargaNik,
                        nama_pelapor: wargaNama,
                        kategori: 'Bansos Belum Diterima',
                        isi_laporan: 'Warga melapor belum menerima alokasi bantuan sosial di lapangan.'
                    })
                }).catch(() => null);

                showPortalAlert({ icon: 'info', title: 'Laporan Diterima', text: 'Sanggahan Anda telah diteruskan ke meja investigasi Dinas Sosial.' });
                window.loadDashboardWarga();
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Gagal mengirimkan laporan sengketa.' });
            }
        }
    });
};

window.konfirmasiLaporSelesaiWarga = function () {
    showPortalAlert({
        title: 'Konfirmasi Akhir',
        text: 'Apakah bantuan sosial sudah Anda terima secara lengkap?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Selesaikan Laporan',
        confirmButtonColor: '#009846',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await fetch(`${API_URL}/api/public/lapor-selesai`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nik: wargaNik })
                }).catch(() => null);

                showPortalAlert({ icon: 'success', title: 'Selesai', text: 'Kasus pengaduan telah ditutup secara sukses.' });
                window.loadDashboardWarga();
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Gagal memperbarui status pengaduan.' });
            }
        }
    });
};

// =========================================================================
