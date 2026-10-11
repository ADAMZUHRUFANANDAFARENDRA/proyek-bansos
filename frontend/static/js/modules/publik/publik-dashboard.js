/**
 * Modul: publik-dashboard.js
 * Deskripsi: Autentikasi portal warga terdaftar, monitoring bantuan, dan dasbor profil pribadi terpadu
 */

var API_URL = (typeof window.API_URL !== 'undefined' ? window.API_URL : (typeof window.API_BASE_URL !== 'undefined' ? window.API_BASE_URL : window.location.origin)).replace(/\/+$/, '');
var BASE_URL = API_URL;
window.API_URL = API_URL;
window.BASE_URL = BASE_URL;

if (typeof window.showPortalAlert !== 'function') {
    window.showPortalAlert = function (opts) {
        if (typeof Swal !== 'undefined') return Swal.fire(opts);
        const msg = (typeof opts === 'string') ? opts : ((opts && (opts.text || opts.title)) || '');
        if (msg) alert(msg);
        return Promise.resolve({ isConfirmed: true, value: '' });
    };
}

// 1. HELPER IDENTIFIKASI & SESI WARGA RESMI
// =========================================================================
window.getActiveWargaNik = function () {
    let nik = (window.sesiWargaAktif && (window.sesiWargaAktif.nik_asli || window.sesiWargaAktif.nik)) ||
              (typeof sesiWargaAktif !== 'undefined' && sesiWargaAktif && (sesiWargaAktif.nik_asli || sesiWargaAktif.nik)) ||
              window.wargaNik ||
              (typeof wargaNik !== 'undefined' ? wargaNik : '') ||
              localStorage.getItem('wargaNik') ||
              sessionStorage.getItem('wargaNik') ||
              '';
    if (!nik) {
        const el = document.getElementById('wNik') || document.getElementById('dashWargaNik');
        if (el) nik = el.innerText.replace(/\D/g, '');
    }
    return String(nik || '').replace(/\D/g, '');
};

window.getActiveWargaNama = function () {
    let nama = (window.sesiWargaAktif && (window.sesiWargaAktif.nama_lengkap || window.sesiWargaAktif.nama)) ||
               (typeof sesiWargaAktif !== 'undefined' && sesiWargaAktif && (sesiWargaAktif.nama_lengkap || sesiWargaAktif.nama)) ||
               window.wargaNama ||
               (typeof wargaNama !== 'undefined' ? wargaNama : '') ||
               localStorage.getItem('wargaNama') ||
               sessionStorage.getItem('wargaNama') ||
               '';
    if (!nama) {
        const el = document.getElementById('wNama') || document.getElementById('dashWargaNama');
        if (el) nama = el.innerText.trim();
    }
    return String(nama || 'Warga').trim();
};

window.fetchDataWargaTerverifikasi = async function (nik, nama, email = '') {
    const cleanNik = String(nik || '').replace(/\D/g, '');
    try {
        const res = await fetch(`${API_URL}/api/publik/dashboard-warga`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ nik: cleanNik, nama, email })
        });
        const json = await res.json().catch(() => ({}));
        return { ok: res.ok && !!json.data, status: res.status, json };
    } catch (e) {
        // Fallback jika POST gagal, coba lewat GET
        try {
            const res2 = await fetch(`${API_URL}/api/publik/dashboard-warga?nik=${encodeURIComponent(cleanNik)}&nama=${encodeURIComponent(nama)}&email=${encodeURIComponent(email)}`);
            const json2 = await res2.json().catch(() => ({}));
            return { ok: res2.ok && !!json2.data, status: res2.status, json: json2 };
        } catch (err) {
            return { ok: false, status: 0, json: { message: err.message } };
        }
    }
};

// 2. MASUK KE PORTAL SETELAH VALIDASI BERHASIL
// =========================================================================
window.masukKePortal = function (nik, nama, email = '', dataAwal = null) {
    const cleanNik = String(nik || '').replace(/\D/g, '');
    localStorage.setItem('wargaNik', cleanNik);
    localStorage.setItem('wargaNama', nama);
    if (email) localStorage.setItem('wargaEmail', email);

    window.wargaNik = cleanNik;
    window.wargaNama = nama;
    const sesi = { ...(dataAwal || {}), nik: cleanNik, nama_lengkap: nama, email_login: email };
    window.sesiWargaAktif = sesi;

    if (typeof wargaNik !== 'undefined') wargaNik = cleanNik;
    if (typeof wargaNama !== 'undefined') wargaNama = nama;
    if (typeof sesiWargaAktif !== 'undefined') sesiWargaAktif = sesi;

    if (dataAwal) {
        wargaDataCache = dataAwal;
        window.renderDashboardWarga(dataAwal);
    }

    window.switchTabPublik('dashboardWargaSection');
    window.loadDashboardWarga();
};

// 3. PROSES LOGIN / AKSES KONSULTASI WARGA
// =========================================================================
window.loginWarga = window.prosesMasukDashboard = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const nik = (document.getElementById('loginNik')?.value || '').replace(/\D/g, '');
    const nama = document.getElementById('loginNama')?.value.trim();
    const email = document.getElementById('loginEmail')?.value.trim() || '';

    if (!nik || !nama) {
        return showPortalAlert({ icon: 'warning', title: 'Peringatan', text: 'NIK dan Nama Lengkap wajib diisi.' });
    }

    if (nik.length !== 16) {
        return showPortalAlert({ icon: 'warning', title: 'Format NIK Salah', text: 'NIK wajib terdiri dari 16 digit angka.' });
    }

    showPortalAlert({ title: 'Memeriksa Akses & Menyinkronkan Data...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        const { ok, status, json } = await window.fetchDataWargaTerverifikasi(nik, nama, email);
        Swal?.close();

        if (ok) {
            const w = json.data;
            window.masukKePortal(nik, w.nama_lengkap || w.nama || nama, email, w);
            showPortalAlert({
                icon: 'success',
                title: 'Akses Diberikan!',
                text: `Selamat datang, ${w.nama_lengkap || w.nama}. Data bantuan sosial Anda telah tersinkronkan.`,
                timer: 1500,
                showConfirmButton: false
            });
        } else if (status === 401) {
            showPortalAlert({
                icon: 'error',
                title: 'Data Tidak Cocok',
                text: json.message || 'Nama lengkap yang dimasukkan tidak cocok dengan NIK terdaftar di sistem.'
            });
        } else if (status === 404) {
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
        } else {
            showPortalAlert({ icon: 'warning', title: 'Gagal Masuk', text: json.message || 'Permintaan akses tidak dapat diproses.' });
        }
    } catch (err) {
        Swal?.close();
        showPortalAlert({
            icon: 'error',
            title: 'Koneksi Peladen Terputus',
            html: `<p style="font-size:0.9rem;">Gagal menghubungi peladen di <b>${safeHtml(API_URL || window.location.origin)}</b>.<br>Pastikan server Node (<code>npm run dev</code>) dan servis <b>MySQL</b> sedang berjalan.</p>`
        });
    }
};


// 4. LOGOUT WARGA
// =========================================================================
window.logoutWarga = function () {
    if (window.chatIntervalWarga) {
        clearInterval(window.chatIntervalWarga);
        window.chatIntervalWarga = null;
    }
    if (window.dashboardIntervalWarga) {
        clearInterval(window.dashboardIntervalWarga);
        window.dashboardIntervalWarga = null;
    }
    if (currentCallWarga) {
        window.endCallWarga();
    }
    localStorage.removeItem('wargaNik');
    localStorage.removeItem('wargaNama');
    localStorage.removeItem('wargaEmail');
    wargaNik = '';
    wargaNama = '';
    wargaDataCache = null;
    sesiWargaAktif = null;
    window.location.reload();
};

// 5. NAVIGASI KE DASHBOARD
// =========================================================================
window.bukaDashboardWargaTerdaftar = function () {
    if (!sesiWargaAktif && !localStorage.getItem('wargaNik')) return;
    window.switchTabPublik('dashboardWargaSection');
    window.loadDashboardWarga();
};

// 6. RENDER DATA KE DOM DASHBOARD
// =========================================================================
window.renderDashboardWarga = function (w) {
    if (!w) return;

    const elNama = document.getElementById('wNama') || document.getElementById('dashWargaNama');
    const elNik = document.getElementById('wNik') || document.getElementById('dashWargaNik');
    const elAlamat = document.getElementById('wAlamat') || document.getElementById('dashWargaAlamat');
    const elStatus = document.getElementById('wStatus') || document.getElementById('dashWargaStatusBansos');
    const elDesil = document.getElementById('dashWargaDesilBadge') || document.getElementById('wDesil');
    const elSalur = document.getElementById('dashWargaStatusSalur');

    const namaTampil = w.nama_lengkap || w.nama || wargaNama || '-';
    const nikTampil = w.nik || wargaNik || '-';
    const alamatTampil = w.alamat || 'Kabupaten Sidoarjo';
    const desilNum = Number(w.desil) || 0;
    const isPrioritas = desilNum >= 1 && desilNum <= 4;
    const rawSalur = String(w.status_salur || '').trim();
    const isBelumDiterima = rawSalur === 'Belum Diterima' || rawSalur.toLowerCase().includes('belum diterima') || rawSalur.toLowerCase().includes('sengketa');
    const isTelahMenerima = (rawSalur === 'Telah Menerima' || rawSalur === 'Selesai' || rawSalur === 'Sudah Diterima' || Boolean(w.konfirmasi_warga)) && !isBelumDiterima;
    const isSudahSalur = !isBelumDiterima && !isTelahMenerima && (rawSalur === 'Disalurkan' || rawSalur === 'Sudah Disalurkan' || rawSalur === 'Menunggu Konfirmasi Warga' || Boolean(w.bukti_salur));

    if (elNama) elNama.innerText = namaTampil;
    if (elNik) elNik.innerText = nikTampil;
    if (elAlamat) elAlamat.innerText = alamatTampil;

    // 1. STATUS PENETAPAN BANSOS (Prioritas Desil 1 s/d 4)
    if (elStatus) {
        if (!isPrioritas) {
            elStatus.innerText = 'Tidak Menerima';
            elStatus.style.background = '#fee2e2';
            elStatus.style.color = '#b91c1c';
        } else {
            elStatus.innerText = 'Menerima Bansos';
            elStatus.style.background = '#dcfce7';
            elStatus.style.color = '#15803d';
        }
    }

    // 2. BADGE DESIL
    if (elDesil) {
        if (desilNum > 0) {
            if (!isPrioritas) {
                elDesil.innerText = `Desil ${desilNum} (Di Luar Prioritas)`;
                elDesil.style.background = '#f1f5f9';
                elDesil.style.color = '#64748b';
            } else {
                elDesil.innerText = `Desil ${desilNum}`;
                elDesil.style.background = '#e6f9f0';
                elDesil.style.color = '#009846';
            }
        } else {
            elDesil.innerText = '-';
        }
    }

    // 3. STATUS PENYALURAN REAL-TIME
    let customMap = {};
    try { customMap = JSON.parse(localStorage.getItem('adminCustomBantuanMap') || '{}'); } catch (e) {}
    const customNominal = customMap[w.nik] || (window.customBantuanMap && window.customBantuanMap[w.nik]);
    const nominal = (w.nominal_bantuan && w.nominal_bantuan.trim() !== '' && w.nominal_bantuan !== '-') 
        ? w.nominal_bantuan 
        : (customNominal || 'Rp 600.000 / Beras 10 Kg');

    let progressHtml = '';

    if (!isPrioritas) {
        // Desil 5 hingga 10 TIDAK MENERIMA BANSOS & TIDAK MUNCUL TOMBOL/NOTIFIKASI SALUR
        if (elSalur) {
            elSalur.innerText = 'Tidak Dialokasikan (Bansos diprioritaskan untuk Desil 1–4)';
            elSalur.style.color = '#64748b';
            elSalur.style.fontWeight = '700';
        }

        progressHtml = `
            <div style="background:#f8fafc; border:1.5px solid #e2e8f0; padding:16px 18px; border-radius:14px; margin-top:10px;">
                <div style="display:flex; align-items:center; gap:8px; color:#475569; font-weight:800; font-size:0.95rem;">
                    <i class="fas fa-info-circle text-slate-500"></i> Penetapan Desil ${desilNum || '-'}: Di Luar Sasaran Penerima
                </div>
                <p style="font-size:0.86rem; color:#64748b; margin:8px 0 0 0; line-height:1.5;">
                    Berdasarkan pemeringkatan kriteria sosial-ekonomi dan DTKS terpadu, bantuan sosial dialokasikan dan diprioritaskan secara ketat bagi kelompok <b>Desil 1 s/d Desil 4</b>.
                </p>
            </div>
        `;
    } else {
        // Desil 1 hingga 4 (PENERIMA PRIORITAS BANSOS)
        const aduan = w.aduan_aktif || (window.sesiWargaAktif && window.sesiWargaAktif.aduan_aktif) || (window.wargaDataCache && window.wargaDataCache.aduan_aktif) || null;
        const currentStep = aduan ? (Number(aduan.status_step) || (aduan.status === 'Selesai' ? 5 : 1)) : 1;
        const isLaporanSelesai = Boolean(aduan && (currentStep === 5 || aduan.status === 'Selesai' || String(aduan.status_text || '').toLowerCase().includes('selesai')));
        const hasAduanOrSanggah = Boolean(aduan || isBelumDiterima);

        if (hasAduanOrSanggah) {
            if (isLaporanSelesai) {
                if (elSalur) {
                    elSalur.innerText = `Telah Menerima (${nominal}) - Selesai & Dikonfirmasi Sah`;
                    elSalur.style.color = '#1d4ed8';
                    elSalur.style.fontWeight = '800';
                }
            } else {
                if (elSalur) {
                    elSalur.innerText = `Belum Diterima (Sanggahan Dilaporkan)`;
                    elSalur.style.color = '#dc2626';
                    elSalur.style.fontWeight = '800';
                }
            }

            const stepText = (aduan && aduan.status_text) ? aduan.status_text : (isLaporanSelesai ? 'Putusan Akhir & Selesai' : 'Laporan Diterima & Masuk Antrean');
            const catatanPetugas = (aduan && aduan.catatan_petugas) ? aduan.catatan_petugas : (w.catatan || (isLaporanSelesai ? 'Laporan telah diverifikasi keabsahan datanya oleh petugas Dinsos dan bantuan disalurkan sesuai regulasi.' : 'Tim verifikator dan investigasi Dinsos sedang memproses sanggahan Anda.'));
            const waktuAduan = (aduan && aduan.waktu) ? aduan.waktu : (w.tanggal_salur || 'Hari ini');

            const stepList = [
                { num: 1, label: 'Laporan Diterima', icon: 'fas fa-file-invoice' },
                { num: 2, label: 'Peninjauan Bukti', icon: 'fas fa-search' },
                { num: 3, label: 'Investigasi Lapangan', icon: 'fas fa-walking' },
                { num: 4, label: 'Mediasi Dinsos', icon: 'fas fa-comments' },
                { num: 5, label: 'Putusan Selesai', icon: 'fas fa-check-circle' }
            ];

            const pct = isLaporanSelesai ? 100 : (currentStep === 1 ? 15 : (currentStep === 2 ? 35 : (currentStep === 3 ? 60 : 85)));

            const stepperNodesHtml = stepList.map(st => {
                const isDone = isLaporanSelesai || st.num < currentStep;
                const isActive = !isLaporanSelesai && st.num === currentStep;
                let circleBg = '#cbd5e1';
                let circleColor = '#ffffff';
                let circleBorder = 'none';
                let boxShadow = 'none';

                if (isDone) {
                    circleBg = '#10b981';
                    circleColor = '#ffffff';
                } else if (isActive) {
                    circleBg = '#dc2626';
                    circleColor = '#ffffff';
                    circleBorder = '3px solid #ffffff';
                    boxShadow = '0 0 12px rgba(220,38,38,0.5)';
                }

                return `
                    <div style="flex:1; text-align:center; position:relative; z-index:2;">
                        <div style="width:34px; height:34px; border-radius:50%; background:${circleBg}; color:${circleColor}; border:${circleBorder}; box-shadow:${boxShadow}; margin:0 auto 6px auto; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:800; transition:all 0.3s ease;">
                            ${isDone ? '<i class="fas fa-check"></i>' : `<i class="${st.icon}"></i>`}
                        </div>
                        <div style="font-size:0.7rem; font-weight:${(isActive || isLaporanSelesai) ? '800' : '600'}; color:${isLaporanSelesai ? '#047857' : (isActive ? '#991b1b' : (isDone ? '#047857' : '#64748b'))}; line-height:1.2;">
                            ${st.label}
                        </div>
                    </div>
                `;
            }).join('');

            if (isLaporanSelesai) {
                progressHtml = `
                    <div style="background:#f0fdf4; border:1.5px solid #86efac; padding:16px 18px; border-radius:14px; margin-top:10px; box-shadow:0 4px 16px rgba(16,185,129,0.06);">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <div style="color:#166534; font-weight:900; font-size:1rem; display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-check-circle text-emerald-600"></i> Laporan Selesai & Sengketa Dituntaskan
                            </div>
                            <span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fas fa-check-double"></i> Tahap 5/5: Laporan Selesai Ditangani
                            </span>
                        </div>

                        <p style="font-size:0.86rem; color:#334155; margin:8px 0 12px 0;">
                            Laporan sanggahan Anda bahwa alokasi bantuan fisik (${nominal}) belum diterima telah berhasil dituntaskan dan diselesaikan resmi oleh dinas sosial.
                        </p>

                        <!-- STEPPER VISUAL INTERAKTIF 5 TAHAPAN SELESAI -->
                        <div style="background:#ffffff; border:1px solid #bbf7d0; border-radius:12px; padding:14px 10px; margin-bottom:12px; box-shadow:0 2px 6px rgba(16,185,129,0.04);">
                            <div style="font-size:0.75rem; font-weight:800; color:#166534; margin-bottom:12px; text-transform:uppercase; display:flex; justify-content:space-between;">
                                <span><i class="fas fa-route text-emerald-600"></i> Pantauan Tahapan Pelaporan Sanggahan</span>
                                <span style="color:#059669; font-weight:900;">Progres: 100% (Tuntas)</span>
                            </div>
                            <div style="position:relative; display:flex; justify-content:space-between; align-items:flex-start;">
                                <div style="position:absolute; top:17px; left:20px; right:20px; height:4px; background:#e2e8f0; z-index:1;">
                                    <div style="height:100%; width:100%; background:linear-gradient(90deg, #34d399, #059669); transition:width 0.4s ease;"></div>
                                </div>
                                ${stepperNodesHtml}
                            </div>
                        </div>

                        <!-- KOTAK CATATAN PUTUSAN AKHIR PETUGAS -->
                        <div style="background:#ffffff; border-left:4px solid #10b981; border-radius:8px; padding:10px 14px; margin-bottom:12px; font-size:0.83rem; color:#1e293b; border-top:1px solid #f1f5f9; border-right:1px solid #f1f5f9; border-bottom:1px solid #f1f5f9;">
                            <div style="font-weight:800; color:#047857; display:flex; justify-content:space-between; align-items:center;">
                                <span><i class="fas fa-user-shield text-emerald-600"></i> Rekomendasi & Putusan Akhir Petugas Dinsos:</span>
                                <small style="color:#64748b; font-weight:600;"><i class="far fa-clock"></i> ${safeHtml(waktuAduan)}</small>
                            </div>
                            <div style="margin-top:4px; line-height:1.4;">
                                ${safeHtml(catatanPetugas)}
                            </div>
                        </div>

                        ${w.bukti_salur ? `
                            <div style="margin:8px 0 12px 0; display:flex; gap:8px; flex-wrap:wrap;">
                                <a href="/uploads/${w.bukti_salur}" target="_blank" class="btn btn-sm" style="background:#ffffff; border:1.5px solid #10b981; color:#047857; font-size:0.8rem; font-weight:700; border-radius:8px; padding:5px 12px; display:inline-flex; align-items:center; gap:6px; text-decoration:none; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                                    <i class="fas fa-image text-emerald-600"></i> Lihat Foto Bukti Serah Terima
                                </a>
                                <a href="/api/chat/download/${w.bukti_salur}?name=Bukti_Penyaluran_${w.nik || 'KPM'}.jpg" download="Bukti_Penyaluran_${w.nik || 'KPM'}.jpg" class="btn btn-sm" style="background:#059669; color:#ffffff; border:1px solid #047857; font-size:0.8rem; font-weight:700; border-radius:8px; padding:5px 12px; display:inline-flex; align-items:center; gap:6px; text-decoration:none; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                                    <i class="fas fa-download"></i> Unduh Foto Bukti
                                </a>
                            </div>
                        ` : ''}

                        <div style="background:#ffffff; border:1px solid #bbf7d0; border-radius:10px; padding:10px 14px; color:#166534; font-weight:700; font-size:0.82rem; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-shield-alt text-emerald-600"></i> Status sengketa resmi ditutup. Penyaluran bantuan sosial telah terverifikasi secara sah.
                        </div>
                        <div style="margin-top:10px;">
                            <button type="button" onclick="document.getElementById('wargaChatInput')?.focus()" class="btn btn-secondary" style="border-color:#cbd5e1; font-size:0.82rem; padding:7px 14px; border-radius:8px;"><i class="fas fa-comments"></i> Hubungi Petugas via Chat</button>
                        </div>
                    </div>
                `;
            } else {
                progressHtml = `
                    <div style="background:#fef2f2; border:1.5px solid #fca5a5; padding:16px 18px; border-radius:14px; margin-top:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <div style="color:#dc2626; font-weight:800; font-size:0.98rem; display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-exclamation-triangle text-rose-600"></i> Laporan Sanggahan: Bantuan Belum Diterima
                            </div>
                            <span style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fas fa-spinner fa-spin"></i> Tahap ${currentStep}/5: ${safeHtml(stepText)}
                            </span>
                        </div>

                        <p style="font-size:0.86rem; color:#334155; margin:8px 0 12px 0;">
                            Laporan Anda bahwa alokasi bantuan fisik (${nominal}) belum diterima sedang ditangani secara interaktif oleh dinas sosial.
                        </p>

                        <!-- STEPPER VISUAL INTERAKTIF 5 TAHAPAN -->
                        <div style="background:#ffffff; border:1px solid #fecaca; border-radius:12px; padding:14px 10px; margin-bottom:12px; box-shadow:0 2px 6px rgba(220,38,38,0.04);">
                            <div style="font-size:0.75rem; font-weight:800; color:#475569; margin-bottom:12px; text-transform:uppercase; display:flex; justify-content:space-between;">
                                <span><i class="fas fa-route text-rose-600"></i> Pantauan Tahapan Pelaporan Sanggahan</span>
                                <span style="color:#dc2626; font-weight:800;">Progres: ${pct}%</span>
                            </div>
                            <div style="position:relative; display:flex; justify-content:space-between; align-items:flex-start;">
                                <!-- Garis Background Progress -->
                                <div style="position:absolute; top:17px; left:20px; right:20px; height:4px; background:#e2e8f0; z-index:1;">
                                    <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, #f87171, #dc2626); transition:width 0.4s ease;"></div>
                                </div>
                                ${stepperNodesHtml}
                            </div>
                        </div>

                        <!-- KOTAK CATATAN TIM VERIFIKATOR -->
                        <div style="background:#ffffff; border-left:4px solid #dc2626; border-radius:8px; padding:10px 14px; margin-bottom:12px; font-size:0.83rem; color:#1e293b; border-top:1px solid #f1f5f9; border-right:1px solid #f1f5f9; border-bottom:1px solid #f1f5f9;">
                            <div style="font-weight:800; color:#991b1b; display:flex; justify-content:space-between; align-items:center;">
                                <span><i class="fas fa-user-shield text-rose-600"></i> Catatan Tindak Lanjut Petugas Dinsos:</span>
                                <small style="color:#64748b; font-weight:600;"><i class="far fa-clock"></i> ${safeHtml(waktuAduan)}</small>
                            </div>
                            <div style="margin-top:4px; line-height:1.4;">
                                ${safeHtml(catatanPetugas)}
                            </div>
                        </div>

                        ${w.bukti_salur ? `
                            <div style="margin:8px 0 12px 0; display:flex; gap:8px; flex-wrap:wrap;">
                                <a href="/uploads/${w.bukti_salur}" target="_blank" class="btn btn-sm" style="background:#ffffff; border:1.5px solid #dc2626; color:#b91c1c; font-size:0.8rem; font-weight:700; border-radius:8px; padding:5px 12px; display:inline-flex; align-items:center; gap:6px; text-decoration:none; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                                    <i class="fas fa-image text-rose-600"></i> Lihat Foto Bukti Serah Terima
                                </a>
                                <a href="/api/chat/download/${w.bukti_salur}?name=Bukti_Penyaluran_${w.nik || 'KPM'}.jpg" download="Bukti_Penyaluran_${w.nik || 'KPM'}.jpg" class="btn btn-sm" style="background:#dc2626; color:#ffffff; border:1px solid #b91c1c; font-size:0.8rem; font-weight:700; border-radius:8px; padding:5px 12px; display:inline-flex; align-items:center; gap:6px; text-decoration:none; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                                    <i class="fas fa-download"></i> Unduh Foto Bukti
                                </a>
                            </div>
                        ` : ''}

                        <div style="font-size:0.82rem; color:#64748b; margin-bottom:8px;">Jika setelah investigasi paket bantuan fisik telah Anda terima, silakan konfirmasi:</div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button type="button" onclick="window.konfirmasiTerimaBansos()" class="btn btn-primary" style="background:#10b981; border-color:#10b981; font-size:0.82rem; padding:7px 14px; border-radius:8px; font-weight:800;"><i class="fas fa-check-circle"></i> Konfirmasi Sudah Diterima</button>
                            <button type="button" onclick="document.getElementById('wargaChatInput')?.focus()" class="btn btn-secondary" style="border-color:#cbd5e1; font-size:0.82rem; padding:7px 14px; border-radius:8px;"><i class="fas fa-comments"></i> Hubungi Petugas via Chat</button>
                        </div>
                    </div>
                `;
            }
        } else if (isTelahMenerima) {
            if (elSalur) {
                elSalur.innerText = `Telah Menerima (${nominal}) - Selesai & Dikonfirmasi`;
                elSalur.style.color = '#1d4ed8';
                elSalur.style.fontWeight = '800';
            }
            progressHtml = `
                <div style="background:#eff6ff; border:1.5px solid #93c5fd; padding:16px 18px; border-radius:14px; margin-top:10px;">
                    <div style="color:#1d4ed8; font-weight:900; font-size:0.98rem; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-check-double text-blue-600"></i> Bantuan Sosial Selesai & Dikonfirmasi Sah
                    </div>
                    <p style="font-size:0.88rem; color:#334155; margin-top:4px;">
                        Paket bantuan sosial fisik (${nominal}) tervalidasi telah diserahterimakan dan dikonfirmasi resmi oleh penerima bansos.
                    </p>
                    ${w.keterangan_salur ? `<div style="font-size:0.84rem; color:#1e40af; margin:6px 0;"><i class="fas fa-clipboard-check text-blue-600"></i> Rincian Penyerahan: ${safeHtml(w.keterangan_salur)}</div>` : ''}
                    ${w.tanggal_salur && w.tanggal_salur !== '-' ? `<div style="font-size:0.78rem; color:#2563eb; margin-bottom:4px;"><i class="fas fa-calendar-check"></i> Waktu Penyerahan: ${safeHtml(w.tanggal_salur)}</div>` : ''}
                    ${w.waktu_konfirmasi_warga ? `<small style="color:#2563eb; font-weight:700;"><i class="fas fa-clock"></i> Dikonfirmasi pada: ${safeHtml(w.waktu_konfirmasi_warga)}</small>` : ''}
                    ${w.bukti_salur ? `
                        <div style="margin:10px 0 4px 0; display:flex; gap:8px; flex-wrap:wrap;">
                            <a href="/uploads/${w.bukti_salur}" target="_blank" class="btn btn-sm" style="background:#ffffff; border:1.5px solid #2563eb; color:#1d4ed8; font-size:0.8rem; font-weight:700; border-radius:8px; padding:5px 12px; display:inline-flex; align-items:center; gap:6px; text-decoration:none; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                                <i class="fas fa-image text-blue-600"></i> Lihat Foto Bukti Serah Terima
                            </a>
                            <a href="/api/chat/download/${w.bukti_salur}?name=Bukti_Penyaluran_${w.nik || 'KPM'}.jpg" download="Bukti_Penyaluran_${w.nik || 'KPM'}.jpg" class="btn btn-sm" style="background:#2563eb; color:#ffffff; border:1px solid #1d4ed8; font-size:0.8rem; font-weight:700; border-radius:8px; padding:5px 12px; display:inline-flex; align-items:center; gap:6px; text-decoration:none; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                                <i class="fas fa-download"></i> Unduh Foto Bukti
                            </a>
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (isSudahSalur) {
            if (elSalur) {
                elSalur.innerText = `Sudah Disalurkan (${nominal}) - Menunggu Konfirmasi Anda`;
                elSalur.style.color = '#059669';
                elSalur.style.fontWeight = '800';
            }
            progressHtml = `
                <div style="background:#ecfdf5; border:1.5px solid #6ee7b7; padding:16px 18px; border-radius:14px; margin-top:10px;">
                    <div style="display:flex; align-items:center; gap:8px; color:#065f46; font-weight:800; font-size:1rem;">
                        <i class="fas fa-truck text-emerald-600"></i> Bantuan Sosial Telah Disalurkan oleh Petugas
                    </div>
                    <p style="font-size:0.88rem; color:#334155; margin:8px 0;">
                        ${safeHtml(w.keterangan_salur || `Paket bantuan sosial (${nominal}) telah diserahterimakan kepada Anda/keluarga di lapangan.`)}
                    </p>
                    ${w.tanggal_salur && w.tanggal_salur !== '-' ? `<div style="font-size:0.78rem; color:#059669; margin-bottom:8px;"><i class="fas fa-calendar-check"></i> Waktu Penyaluran: ${safeHtml(w.tanggal_salur)}</div>` : ''}
                    ${w.bukti_salur ? `
                        <div style="margin:8px 0 12px 0; display:flex; gap:8px; flex-wrap:wrap;">
                            <a href="/uploads/${w.bukti_salur}" target="_blank" class="btn btn-sm" style="background:#ffffff; border:1px solid #10b981; color:#065f46; font-size:0.78rem; font-weight:700; border-radius:8px; padding:4px 10px; display:inline-flex; align-items:center; gap:6px; text-decoration:none;">
                                <i class="fas fa-image text-emerald-600"></i> Lihat Foto Bukti Serah Terima
                            </a>
                            <a href="/api/chat/download/${w.bukti_salur}?name=Bukti_Penyaluran_${w.nik || 'KPM'}.jpg" download="Bukti_Penyaluran_${w.nik || 'KPM'}.jpg" class="btn btn-sm" style="background:#059669; color:#ffffff; border:1px solid #047857; font-size:0.78rem; font-weight:700; border-radius:8px; padding:4px 10px; display:inline-flex; align-items:center; gap:6px; text-decoration:none;">
                                <i class="fas fa-download"></i> Unduh Foto
                            </a>
                        </div>
                    ` : ''}
                    <div style="font-size:0.84rem; font-weight:700; color:#1e293b; margin-bottom:8px;">Mohon konfirmasi penerimaan fisik bantuan ini:</div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <button type="button" onclick="window.konfirmasiTerimaBansos()" class="btn btn-primary" style="background:#10b981; border-color:#10b981; font-size:0.85rem; padding:8px 16px; border-radius:10px; font-weight:800; box-shadow:0 3px 8px rgba(16,185,129,0.3);"><i class="fas fa-check-circle"></i> Ya, Sudah Diterima</button>
                        <button type="button" onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="font-size:0.85rem; padding:8px 16px; color:#ef4444; border-color:#fca5a5; border-radius:10px; font-weight:700;"><i class="fas fa-times"></i> Belum Diterima / Sanggah</button>
                    </div>
                </div>
            `;
        } else if (isSengketa) {
            if (elSalur) {
                elSalur.innerText = `Laporan Sengketa Sedang Diinvestigasi (${nominal})`;
                elSalur.style.color = '#dc2626';
                elSalur.style.fontWeight = '800';
            }
            progressHtml = `
                <div style="background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:10px; margin-top:10px;">
                    <div style="color:#dc2626; font-weight:bold;"><i class="fas fa-exclamation-triangle"></i> Laporan Sengketa Sedang Diinvestigasi</div>
                    <p style="font-size:0.88rem; color:#64748b; margin-top:4px;">Petugas Dinsos sedang meninjau sanggahan Anda. Silakan koordinasikan bukti fisik via Live Chat di samping.</p>
                </div>
            `;
        } else {
            if (elSalur) {
                elSalur.innerText = `Belum Disalurkan (${nominal})`;
                elSalur.style.color = '#d97706';
                elSalur.style.fontWeight = '800';
            }
            progressHtml = `
                <div style="background:#fffbeb; border:1px solid #fde68a; padding:14px 16px; border-radius:12px; margin-top:10px;">
                    <div style="color:#b45309; font-weight:800; font-size:0.92rem;"><i class="fas fa-hourglass-half text-amber-500"></i> Dalam Antrean Distribusi Lapangan</div>
                    <p style="font-size:0.84rem; color:#78350f; margin:6px 0 10px 0;">Alokasi bantuan Anda (${nominal}) telah disetujui dan sedang dalam jadwal penyerahan oleh petugas Dinsos.</p>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <button type="button" onclick="window.konfirmasiTerimaBansos()" class="btn btn-primary" style="font-size:0.82rem; padding:7px 14px; border-radius:8px;"><i class="fas fa-check"></i> Konfirmasi Sudah Terima</button>
                        <button type="button" onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="border-color:#ef4444; color:#ef4444; font-size:0.82rem; padding:7px 14px; border-radius:8px;"><i class="fas fa-exclamation-circle"></i> Belum Menerima Bantuan</button>
                    </div>
                </div>
            `;
        }
    }

    const actCont = document.getElementById('actionContainer');
    if (actCont) actCont.innerHTML = progressHtml;

    if (typeof window.loadChatMessagesWarga === 'function') {
        window.loadChatMessagesWarga(false);
    }
};

// 7. MEMUAT & MENYINKRONKAN DATA DASHBOARD DARI BACKEND
// =========================================================================
window.loadDashboardWarga = async function () {
    const rawNik = (sesiWargaAktif && sesiWargaAktif.nik_asli) || 
                   (sesiWargaAktif && sesiWargaAktif.nik && !sesiWargaAktif.nik.includes('*') ? sesiWargaAktif.nik : '') || 
                   wargaNik || 
                   localStorage.getItem('wargaNik') || '';
    const activeNik = String(rawNik).replace(/\D/g, '');
    const activeNama = wargaNama || (sesiWargaAktif && (sesiWargaAktif.nama_lengkap || sesiWargaAktif.nama)) || localStorage.getItem('wargaNama') || '';
    const activeEmail = (sesiWargaAktif && sesiWargaAktif.email_login) || localStorage.getItem('wargaEmail') || '';

    if (!activeNik || activeNik.length !== 16) return;

    // Render data cache awal jika tersedia agar UI langsung tampil tanpa jeda
    if (wargaDataCache) {
        window.renderDashboardWarga(wargaDataCache);
    }

    try {
        let loadedData = null;

        // Prioritas 1: Ambil data lengkap lewat endpoint terverifikasi dashboard-warga
        const { ok, json } = await window.fetchDataWargaTerverifikasi(activeNik, activeNama, activeEmail);
        if (ok && json.data) {
            loadedData = json.data;
        }

        // Prioritas 2: Fallback ke cek-bansos jika dashboard-warga belum mengembalikan data
        if (!loadedData) {
            const res = await fetch(`${API_URL}/api/publik/cek-bansos?nik=${encodeURIComponent(activeNik)}`);
            const jsonFallback = await res.json().catch(() => ({}));
            if (res.ok && jsonFallback.data) {
                loadedData = jsonFallback.data;
            }
        }

        if (loadedData) {
            loadedData.nik = activeNik;
            wargaDataCache = loadedData;
            sesiWargaAktif = { ...sesiWargaAktif, ...loadedData, nik: activeNik, nik_asli: activeNik };
            window.renderDashboardWarga(loadedData);

            if (!window.chatIntervalWarga) {
                window.chatIntervalWarga = setInterval(() => {
                    if (typeof window.loadChatMessagesWarga === 'function') {
                        window.loadChatMessagesWarga(false);
                    }
                }, 4000);
            }

            if (!window.dashboardIntervalWarga) {
                window.dashboardIntervalWarga = setInterval(() => {
                    const dashSec = document.getElementById('dashboardWargaSection');
                    if (dashSec && (dashSec.style.display !== 'none' && !dashSec.classList.contains('hidden'))) {
                        window.loadDashboardWarga();
                    }
                }, 5000);
            }
        }
    } catch (err) {
        console.error('[Dashboard Error]', err);
    }
};

// Jalur Ganda Realtime untuk Portal Warga Publik (BroadcastChannel & Storage Event)
try {
    const bcWarga = new BroadcastChannel('bansos_realtime');
    bcWarga.onmessage = function (ev) {
        if (!ev.data) return;
        const targetNik = ev.data.nik || (ev.data.data && ev.data.data.nik);
        const curNik = (sesiWargaAktif && (sesiWargaAktif.nik_asli || sesiWargaAktif.nik)) || localStorage.getItem('wargaNik') || wargaNik;
        const cTarget = String(targetNik || '').replace(/\D/g, '');
        const cCur = String(curNik || '').replace(/\D/g, '');

        if (ev.data.type === 'WARGA_SALUR_UPDATED' || ev.data.type === 'WARGA_UPDATED') {
            if (cTarget && cCur && cTarget === cCur) {
                const freshNominal = ev.data.nominal_bantuan || (ev.data.data && ev.data.data.nominal_bantuan);
                const freshSalur = ev.data.status_salur || (ev.data.data && ev.data.data.status_salur) || 'Disalurkan';
                const freshKet = ev.data.keterangan_salur || (ev.data.data && ev.data.data.keterangan_salur);
                const freshTgl = ev.data.tanggal_salur || (ev.data.data && ev.data.data.tanggal_salur);

                wargaDataCache = {
                    ...(wargaDataCache || {}),
                    ...(ev.data.data || {}),
                    status_salur: freshSalur,
                    konfirmasi_warga: freshSalur === 'Telah Menerima',
                    nik: cCur
                };
                if (freshNominal) wargaDataCache.nominal_bantuan = freshNominal;
                if (freshKet) wargaDataCache.keterangan_salur = freshKet;
                if (freshTgl) wargaDataCache.tanggal_salur = freshTgl;

                sesiWargaAktif = { ...sesiWargaAktif, ...wargaDataCache };
                window.renderDashboardWarga(wargaDataCache);
                window.loadDashboardWarga();
            }
        } else if (ev.data.type === 'ADUAN_UPDATE' || ev.data.type === 'ADUAN_NEW') {
            if (cTarget && cCur && cTarget === cCur) {
                const aduanData = ev.data.data;
                if (aduanData) {
                    wargaDataCache = wargaDataCache || {};
                    wargaDataCache.aduan_aktif = aduanData;
                    if (aduanData.status === 'Selesai' || aduanData.status_step === 5) {
                        wargaDataCache.status_salur = 'Telah Menerima';
                        wargaDataCache.konfirmasi_warga = true;
                    }
                    sesiWargaAktif = { ...sesiWargaAktif, ...wargaDataCache };
                    window.renderDashboardWarga(wargaDataCache);
                    window.loadDashboardWarga();
                }
            }
        }
    };
} catch (e) {}

window.addEventListener('storage', function (ev) {
    if (ev.key === 'bansos_realtime_signal' && ev.newValue) {
        try {
            const signal = JSON.parse(ev.newValue);
            const targetNik = signal.nik || (signal.data && signal.data.nik);
            const curNik = (sesiWargaAktif && (sesiWargaAktif.nik_asli || sesiWargaAktif.nik)) || localStorage.getItem('wargaNik') || wargaNik;
            const cTarget = String(targetNik || '').replace(/\D/g, '');
            const cCur = String(curNik || '').replace(/\D/g, '');

            if (signal.type === 'WARGA_SALUR_UPDATED' || signal.type === 'WARGA_UPDATED') {
                if (cTarget && cCur && cTarget === cCur) {
                    const freshNominal = signal.nominal_bantuan || (signal.data && signal.data.nominal_bantuan);
                    const freshSalur = signal.status_salur || (signal.data && signal.data.status_salur) || 'Disalurkan';
                    const freshKet = signal.keterangan_salur || (signal.data && signal.data.keterangan_salur);
                    const freshTgl = signal.tanggal_salur || (signal.data && signal.data.tanggal_salur);

                    wargaDataCache = {
                        ...(wargaDataCache || {}),
                        ...(signal.data || {}),
                        status_salur: freshSalur,
                        konfirmasi_warga: freshSalur === 'Telah Menerima',
                        nik: cCur
                    };
                    if (freshNominal) wargaDataCache.nominal_bantuan = freshNominal;
                    if (freshKet) wargaDataCache.keterangan_salur = freshKet;
                    if (freshTgl) wargaDataCache.tanggal_salur = freshTgl;

                    sesiWargaAktif = { ...sesiWargaAktif, ...wargaDataCache };
                    window.renderDashboardWarga(wargaDataCache);
                    window.loadDashboardWarga();
                }
            } else if (signal.type === 'ADUAN_UPDATE' || signal.type === 'ADUAN_NEW') {
                if (cTarget && cCur && cTarget === cCur) {
                    const aduanData = signal.data;
                    if (aduanData) {
                        wargaDataCache = wargaDataCache || {};
                        wargaDataCache.aduan_aktif = aduanData;
                        if (aduanData.status === 'Selesai' || aduanData.status_step === 5) {
                            wargaDataCache.status_salur = 'Telah Menerima';
                            wargaDataCache.konfirmasi_warga = true;
                        }
                        sesiWargaAktif = { ...sesiWargaAktif, ...wargaDataCache };
                        window.renderDashboardWarga(wargaDataCache);
                        window.loadDashboardWarga();
                    }
                }
            }
        } catch (err) {}
    }
});

// 8. KONFIRMASI TERIMA BANSOS
// =========================================================================
window.konfirmasiTerimaBansos = function () {
    const currentNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
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
                    body: JSON.stringify({ nik: currentNik })
                });

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
    const cleanNik = String(nik).replace(/\D/g, '');
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
                    body: JSON.stringify({ nik: cleanNik })
                });
                const j = await r.json().catch(() => ({}));
                showPortalAlert({
                    icon: 'success',
                    title: 'Penerimaan Berhasil Dikonfirmasi!',
                    text: j.message || 'Status bantuan sosial Anda kini telah resmi tercatat sebagai Telah Menerima.'
                });
                if (window.cekStatusPublik) {
                    const input = document.getElementById('inputLacakNik') || document.getElementById('cekNik') || document.getElementById('lacakNik');
                    if (input) {
                        input.value = cleanNik;
                        window.cekStatusPublik();
                    }
                }
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Kendala Jaringan', text: 'Gagal mengirimkan konfirmasi penerimaan.' });
            }
        }
    });
};

// 9. LAPOR BANSOS BELUM DITERIMA / SANGGAH
// =========================================================================
window.laporBansosBelumDiterima = function () {
    const currentNik = window.getActiveWargaNik ? window.getActiveWargaNik() : (wargaNik || (sesiWargaAktif && sesiWargaAktif.nik));
    const currentNama = window.getActiveWargaNama ? window.getActiveWargaNama() : (wargaNama || (sesiWargaAktif && (sesiWargaAktif.nama_lengkap || sesiWargaAktif.nama)));

    if (!currentNik) {
        showPortalAlert({ icon: 'warning', title: 'Perhatian', text: 'Sesi Anda belum teridentifikasi. Silakan masuk terlebih dahulu.' });
        return;
    }

    showPortalAlert({
        title: 'Laporkan Belum Diterima / Sanggah',
        html: `
            <p style="font-size:0.88rem; color:#475569; margin-bottom:12px; line-height:1.5;">
                Anda terdata sebagai penerima bantuan sosial, namun <b>belum menerima fisik bantuan</b> di lapangan?
            </p>
            <textarea id="swalAlasanSanggah" style="width:100%; height:75px; padding:8px 12px; border:1.5px solid #cbd5e1; border-radius:10px; font-size:0.84rem; font-family:inherit; outline:none; box-sizing:border-box;" placeholder="Tuliskan keterangan kendala Anda (contoh: Belum ada petugas yang datang ke rumah / fisik paket belum diterima)..."></textarea>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-paper-plane"></i> Ya, Kirim Sanggahan',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const el = document.getElementById('swalAlasanSanggah');
            return el ? el.value.trim() : '';
        }
    }).then(async (res) => {
        if (res.isConfirmed) {
            const alasan = res.value || 'Warga melapor belum menerima alokasi bantuan sosial fisik di lapangan.';
            try {
                showPortalAlert({ title: 'Mengirim Laporan Sanggahan...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });
                const resp = await fetch(`${API_URL}/api/public/lapor-belum-diterima`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nik: currentNik,
                        nama_pelapor: currentNama,
                        alasan: alasan,
                        kategori: 'Bansos Belum Diterima'
                    })
                });

                if (window.sesiWargaAktif) {
                    window.sesiWargaAktif.status_salur = 'Belum Diterima';
                    window.sesiWargaAktif.konfirmasi_warga = false;
                    window.sesiWargaAktif.catatan = `Sanggahan: ${alasan}`;
                }

                showPortalAlert({
                    icon: 'success',
                    title: 'Laporan Sanggahan Terkirim!',
                    text: 'Status penyaluran telah diperbarui menjadi Belum Diterima dan diteruskan ke petugas Dinsos untuk investigasi fisik.'
                });

                window.loadDashboardWarga();
                if (typeof window.loadChatMessagesWarga === 'function') {
                    window.loadChatMessagesWarga(true);
                }
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Gagal mengirimkan laporan sengketa.' });
            }
        }
    });
};

// 10. LAPOR SELESAI
// =========================================================================
window.konfirmasiLaporSelesaiWarga = function () {
    const currentNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
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
                    body: JSON.stringify({ nik: currentNik })
                }).catch(() => null);

                showPortalAlert({ icon: 'success', title: 'Selesai', text: 'Kasus pengaduan telah ditutup secara sukses.' });
                window.loadDashboardWarga();
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Gagal memperbarui status pengaduan.' });
            }
        }
    });
};
