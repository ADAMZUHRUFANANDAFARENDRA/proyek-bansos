/* =========================================================================
   PUBLIK.JS - PORTAL WARGA SPK BANSOS PEMKAB SIDOARJO (FULL ACTIONS)
   MENGELOLA: OTENTIKASI, DASHBOARD PRIBADI, LACAK BANSOS REAL-TIME,
              LIVE CHAT, WEBRTC DUA ARAH, VOICE RECORDER, TUR INTERAKTIF,
              CHATBOT ASISTEN CERDAS & DASHBOARD PENGADUAN
   Lokasi: frontend/static/js/publik.js
   ========================================================================= */

// =========================================================================
// 1. STATE & KONFIGURASI GLOBAL PORTAL WARGA
// =========================================================================
const API_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
    ? window.CONFIG.BASE_URL.replace(/\/+$/, '')
    : ((typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL.replace(/\/+$/, '') : 'http://127.0.0.1:5000');

const BASE_URL = API_URL;

let wargaNik = localStorage.getItem('wargaNik') || '';
let wargaNama = localStorage.getItem('wargaNama') || '';
let wargaDataCache = null;

let sesiWargaAktif = null;
let sesiAduanAktif = null;
window.lastLacakData = null;

window.editedMediaBlob = null;
window.editedMediaExt = '';
window.editedMediaType = '';

let replyToDataWarga = null;
let lastChatHashWarga = '';
let chatIntervalWarga = null;
let aduanChatInterval = null;

// Voice Recording State
let mediaRecorderWarga = null;
let audioChunksWarga = [];
let voiceTimerIntervalWarga = null;
let voiceSecondsWarga = 0;

// WebRTC Call State
let peerWarga = null;
let currentCallWarga = null;
let localStreamWarga = null;
let callTimerWarga = null;
let callSecondsWarga = 0;

// Captcha State
let captchaAnswerPendaftaran = 0;

// Tour State
let activeTourIndex = 0;

// Injeksi CSS Dinamis untuk Animasi Tur & Sorotan Kartu Non-blocking
const tourStyle = document.createElement('style');
tourStyle.innerHTML = `
    .highlight-focus {
        outline: 4px solid #009846 !important;
        box-shadow: 0 0 25px rgba(0, 152, 70, 0.45) !important;
        border-radius: 20px !important;
        transition: all 0.3s ease-in-out !important;
    }
    @keyframes slideUpTourBar {
        from { opacity: 0; transform: translate(-50%, 30px); }
        to { opacity: 1; transform: translate(-50%, 0); }
    }
`;
document.head.appendChild(tourStyle);

// =========================================================================
// 2. HELPER SANITASI & ENCODING
// =========================================================================
function safeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function enc(str) {
    return encodeURIComponent(str || '');
}

function showPortalAlert(options) {
    if (typeof Swal !== 'undefined') {
        return Swal.fire(options);
    }
    alert(options.text || options.title || 'Pemberitahuan');
    return Promise.resolve({ isConfirmed: true, value: true });
}

// =========================================================================
// 3. NAVIGASI TAB PORTAL & SINKRONISASI VIEW (ANTI-TERPENDAM)
// =========================================================================
window.switchTabPublik = window.switchTab = function (targetSectionId, btnEl) {
    const landingView = document.getElementById('landingView') || document.querySelector('.container-public');
    const dashboardView = document.getElementById('dashboardWargaSection');
    const aduanView = document.getElementById('sectionDashboardPengaduan');
    const chatbotBtn = document.getElementById('chatbotFabBtn') || document.getElementById('chatbotTriggerBtn');

    // 1. Tampilan Dasbor Warga Terdaftar
    if (targetSectionId === 'dashboardWargaSection') {
        if (landingView) landingView.style.display = 'none';
        if (aduanView) aduanView.style.display = 'none';
        if (dashboardView) {
            dashboardView.style.display = 'block';
            dashboardView.style.opacity = '1';
            dashboardView.style.visibility = 'visible';
        }
        if (chatbotBtn) chatbotBtn.style.display = 'none';
        return;
    }

    // 2. Tampilan Dasbor Khusus Pengaduan (Warga Belum Terdaftar)
    if (targetSectionId === 'sectionDashboardPengaduan') {
        if (landingView) landingView.style.display = 'none';
        if (dashboardView) dashboardView.style.display = 'none';
        if (aduanView) {
            aduanView.style.display = 'block';
            aduanView.style.opacity = '1';
            aduanView.style.visibility = 'visible';
        }
        if (chatbotBtn) chatbotBtn.style.display = 'none';
        return;
    }

    // 3. Tampilan Portal Utama (4 Tabs)
    if (landingView) {
        landingView.style.display = 'block';
        landingView.style.opacity = '1';
        landingView.style.visibility = 'visible';
    }
    if (dashboardView) dashboardView.style.display = 'none';
    if (aduanView) aduanView.style.display = 'none';
    if (chatbotBtn) chatbotBtn.style.display = 'flex';

    document.querySelectorAll('.tab-btn-portal, .tab-btn').forEach(b => b.classList.remove('active'));
    const allSections = [
        'loginWargaSection', 'cekStatusSection', 'daftarMandiriSection', 'bantuanSection',
        'panelMasukDashboard', 'panelCekStatus', 'panelDaftarMandiri', 'panelFAQ'
    ];
    allSections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            el.classList.remove('active');
        }
    });

    const mapIds = {
        'loginWargaSection': ['loginWargaSection', 'panelMasukDashboard'],
        'panelMasukDashboard': ['loginWargaSection', 'panelMasukDashboard'],
        'cekStatusSection': ['cekStatusSection', 'panelCekStatus'],
        'panelCekStatus': ['cekStatusSection', 'panelCekStatus'],
        'daftarMandiriSection': ['daftarMandiriSection', 'panelDaftarMandiri'],
        'panelDaftarMandiri': ['daftarMandiriSection', 'panelDaftarMandiri'],
        'bantuanSection': ['bantuanSection', 'panelFAQ'],
        'panelFAQ': ['bantuanSection', 'panelFAQ']
    };

    const targets = mapIds[targetSectionId] || [targetSectionId];
    targets.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'block';
            el.classList.add('active');
        }
    });

    if (btnEl) {
        btnEl.classList.add('active');
    } else {
        const mapBtn = {
            'loginWargaSection': ['btn-login', 'tabBtnMasuk'],
            'panelMasukDashboard': ['btn-login', 'tabBtnMasuk'],
            'cekStatusSection': ['btn-cek', 'tabBtnCek'],
            'panelCekStatus': ['btn-cek', 'tabBtnCek'],
            'daftarMandiriSection': ['btn-daftar', 'tabBtnDaftar'],
            'panelDaftarMandiri': ['btn-daftar', 'tabBtnDaftar'],
            'bantuanSection': ['btn-panduan', 'tabBtnFAQ'],
            'panelFAQ': ['btn-panduan', 'tabBtnFAQ']
        };
        const btnKeys = mapBtn[targetSectionId] || [];
        btnKeys.forEach(bk => {
            const b = document.getElementById(bk);
            if (b) b.classList.add('active');
        });
    }

    if (targetSectionId === 'daftarMandiriSection' || targetSectionId === 'panelDaftarMandiri') {
        setTimeout(() => {
            if (typeof initGeotaggingMap === 'function') initGeotaggingMap();
        }, 250);
    }
};

window.gantiTabPortal = function (tab) {
    const map = {
        'masuk': 'loginWargaSection',
        'cek': 'cekStatusSection',
        'daftar': 'daftarMandiriSection',
        'faq': 'bantuanSection'
    };
    window.switchTabPublik(map[tab] || tab);
};

window.toggleFaqCard = function (cardEl) {
    if (!cardEl) return;
    const body = cardEl.querySelector('.faq-card-body');
    const isOpen = cardEl.classList.contains('open');

    document.querySelectorAll('.faq-modern-card').forEach(c => {
        c.classList.remove('open');
        const b = c.querySelector('.faq-card-body');
        if (b) b.style.display = 'none';
    });

    if (!isOpen && body) {
        cardEl.classList.add('open');
        body.style.display = 'block';
    }
};

// =========================================================================
// 4. INISIALISASI HALAMAN
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    window.switchTabPublik('loginWargaSection');

    if (wargaNik) {
        const nikInp = document.getElementById('loginNik');
        const namaInp = document.getElementById('loginNama');
        if (nikInp) nikInp.value = wargaNik;
        if (namaInp && wargaNama) namaInp.value = wargaNama;
    }

    const wFile = document.getElementById('wargaChatFile');
    if (wFile) {
        wFile.addEventListener('change', function () {
            const file = this.files[0];
            if (!file) return;
            window.editedMediaBlob = file;
            window.editedMediaExt = file.name.split('.').pop().toLowerCase();
            window.editedMediaType = file.type.startsWith('image/')
                ? 'image'
                : (file.type.startsWith('video/') ? 'video' : (file.type.startsWith('audio/') ? 'audio' : 'document'));

            window.showPreviewWarga(URL.createObjectURL(file), window.editedMediaType, file.name);
            document.getElementById('wargaChatInput')?.focus();
        });
    }

    window.acakCaptchaPendaftaran();
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('[id^="menu-warga-"]')) {
        document.querySelectorAll('[id^="menu-warga-"]').forEach(m => m.style.display = 'none');
    }
    const emojiPicker = document.getElementById('emojiPickerWarga');
    if (emojiPicker && !e.target.closest('#emojiPickerWarga') && !e.target.closest('.emoji-toggle-btn')) {
        emojiPicker.style.display = 'none';
    }
});

// =========================================================================
// 5. LOGIN DASHBOARD WARGA (DENGAN PENANGANAN ERROR JELAS)
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
// 6. LACAK STATUS BANSOS REAL-TIME & AUTO-FILL LENGKAP KE DASHBOARD
// =========================================================================
window.cekStatusAwal = window.prosesLacakBansos = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const nik = (document.getElementById('cekNik') || document.getElementById('lacakNik'))?.value.trim();

    if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) {
        return showPortalAlert({ icon: 'warning', title: 'Peringatan', text: 'Masukkan tepat 16 digit NIK.' });
    }

    showPortalAlert({ title: 'Melacak Status Bansos...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        const res = await fetch(`${API_URL}/api/publik/cek-bansos?nik=${encodeURIComponent(nik)}`);
        const json = await res.json().catch(() => ({}));
        Swal?.close();

        const pInput = document.getElementById('panelInputLacak') || document.getElementById('panel-input-nik');
        const pHasil = document.getElementById('panel-hasil-cek') || document.getElementById('wadahHasilLacak');
        const kartu = document.getElementById('kartuStatus') || document.getElementById('wadahHasilLacak');

        if (!res.ok || !json.data) {
            if (pHasil) pHasil.style.display = 'none';
            return showPortalAlert({ icon: 'info', title: 'Tidak Ditemukan', text: json.message || 'Data NIK tidak ditemukan dalam pangkalan data penetapan bansos.' });
        }

        const d = json.data;
        window.lastLacakData = d;
        const desil = parseInt(d.desil || '5', 10);
        const isLayak = desil <= 4;
        const badgeBg = isLayak ? '#e6f9f0' : '#fef3c7';
        const badgeCol = isLayak ? '#15803d' : '#b45309';

        const resultHtml = `
            <div class="result-box-complete" style="border:1.5px solid #cbd5e1; border-radius:18px; overflow:hidden; background:#ffffff; box-shadow:0 6px 25px rgba(0,0,0,0.06); width:100%;">
                <div style="background:#f8fafc; padding:16px 24px; border-bottom:1.5px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:800; font-size:1rem; color:#0f172a;"><i class="fas fa-id-badge" style="color:#009846;"></i> Rincian Penerima Manfaat Terdaftar</span>
                    <span style="background:${badgeBg}; color:${badgeCol}; padding:5px 14px; border-radius:20px; font-weight:800; font-size:0.82rem;">
                        ${isLayak ? '<i class="fas fa-check-circle"></i> LAYAK MENERIMA' : '<i class="fas fa-info-circle"></i> TIDAK DIPRIORITASKAN'}
                    </span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:24px; font-size:0.92rem;">
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">NAMA LENGKAP</small>
                        <span style="font-weight:800; color:#0f172a;">${safeHtml(d.nama_lengkap || d.nama || '-')}</span>
                    </div>
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">NOMOR INDUK KEPENDUDUKAN (NIK)</small>
                        <span class="font-mono" style="font-weight:800; color:#0f172a;">${safeHtml(d.nik)}</span>
                    </div>
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">ALAMAT LENGKAP TERDAFTAR</small>
                        <span style="font-weight:700; color:#334155;">${safeHtml(d.alamat || 'Kabupaten Sidoarjo')}</span>
                    </div>
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">ALAMAT EMAIL</small>
                        <span style="font-weight:700; color:#334155;">${safeHtml(d.email || '-')}</span>
                    </div>
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">KLASIFIKASI DESIL KELAYAKAN</small>
                        <span style="font-weight:800; color:#0284c7;"><i class="fas fa-layer-group"></i> Desil ${desil} (${d.prioritas || (isLayak ? 'Prioritas Bansos' : 'Ekonomi Cukup')})</span>
                    </div>
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">KEPUTUSAN BANTUAN SOSIAL</small>
                        <span style="font-weight:800; color:${isLayak ? '#059669' : '#dc2626'};">${d.status_bansos}</span>
                    </div>
                    <div style="grid-column: span 2; background:#f0fdf4; padding:14px 18px; border-radius:12px; border:1px solid #bbf7d0;">
                        <small style="display:block; color:#166534; font-size:0.75rem; font-weight:700; margin-bottom:3px;">STATUS PENYALURAN FISIK LAPANGAN</small>
                        <span style="font-weight:800; color:#15803d; font-size:1rem;"><i class="fas fa-truck"></i> ${d.status_salur || 'Pending'} — (${d.nominal_bantuan || 'BLT Rp 300.000'})</span>
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:12px; margin-top:20px; justify-content:center;">
                <button type="button" onclick="window.resetCekStatus()" class="btn btn-secondary" style="padding:12px 24px; border-radius:30px; font-weight:700; cursor:pointer; background:#f1f5f9; border:1px solid #cbd5e1; color:#475569;">
                    <i class="fas fa-arrow-left"></i> Cek NIK Lain
                </button>
                <button type="button" onclick="window.lanjutKeDashboardDariCek()" class="btn btn-primary" style="padding:12px 24px; border-radius:30px; font-weight:800; cursor:pointer; background:#009846; border:none; color:white; box-shadow:0 4px 12px rgba(0,152,70,0.25);">
                    <i class="fas fa-sign-in-alt"></i> Lanjut ke Dashboard Pribadi
                </button>
            </div>
        `;

        if (kartu) kartu.innerHTML = resultHtml;
        if (pInput) pInput.style.display = 'none';
        if (pHasil) pHasil.style.display = 'block';
    } catch (err) {
        showPortalAlert({ icon: 'error', title: 'Error', text: 'Gagal memuat informasi status warga.' });
    }
};

window.resetCekStatus = function () {
    const pHasil = document.getElementById('panel-hasil-cek') || document.getElementById('wadahHasilLacak');
    const pInput = document.getElementById('panelInputLacak') || document.getElementById('panel-input-nik');
    const input = document.getElementById('cekNik') || document.getElementById('lacakNik');

    if (pHasil) pHasil.style.display = 'none';
    if (pInput) pInput.style.display = 'block';
    if (input) {
        input.value = '';
        input.focus();
    }
};

window.lanjutKeDashboardDariCek = function () {
    if (window.lastLacakData) {
        const d = window.lastLacakData;
        const nikInp = document.getElementById('loginNik');
        const namaInp = document.getElementById('loginNama');
        const emailInp = document.getElementById('loginEmail');

        if (nikInp) nikInp.value = d.nik || '';
        if (namaInp) namaInp.value = d.nama_lengkap || d.nama || '';
        if (emailInp) emailInp.value = (d.email && d.email !== '-') ? d.email : 'warga@gmail.com';
    }
    window.switchTabPublik('loginWargaSection');
    const target = document.getElementById('panelMasukDashboard') || document.getElementById('loginWargaSection');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
    if (!wargaNik) return;

    try {
        const res = await fetch(`${API_URL}/api/publik/cek-bansos?nik=${encodeURIComponent(wargaNik)}`);
        const json = await res.json().catch(() => ({}));

        if (json.data) {
            const w = json.data;
            wargaDataCache = w;

            const elNama = document.getElementById('wNama') || document.getElementById('dashWargaNama');
            const elNik = document.getElementById('wNik') || document.getElementById('dashWargaNik');
            const elAlamat = document.getElementById('wAlamat') || document.getElementById('dashWargaAlamat');
            const elStatus = document.getElementById('wStatus') || document.getElementById('dashWargaStatusBansos');
            const elDesil = document.getElementById('wDesil') || document.getElementById('dashWargaDesilBadge');
            const elSalur = document.getElementById('dashWargaStatusSalur');

            if (elNama) elNama.innerText = w.nama_lengkap || w.nama || wargaNama;
            if (elNik) elNik.innerText = w.nik || wargaNik;
            if (elAlamat) elAlamat.innerText = w.alamat || 'Kabupaten Sidoarjo';
            if (elStatus) elStatus.innerText = w.status_bansos || w.status || 'Diproses';
            if (elDesil && w.desil) elDesil.innerText = `Desil ${w.desil}`;
            if (elSalur) elSalur.innerText = `${w.status_salur || 'Pending'} (${w.nominal_bantuan || 'BLT Rp 300.000'})`;

            let progressHtml = '';
            const statusSalur = w.status_salur || 'Pending';

            if (w.is_lapor_curang && statusSalur === 'Menunggu Konfirmasi Warga') {
                progressHtml = `
                    <div style="background:#fffbeb; border:1px solid #fcd34d; padding:15px; border-radius:12px; margin-top:10px;">
                        <b style="color:#b45309;"><i class="fas fa-check-double"></i> Konfirmasi Penerimaan Fisik (Double-Check):</b>
                        <p style="font-size:0.9rem; color:#475569; margin:8px 0;">Pihak Dinas Sosial menyatakan bantuan Anda telah disalurkan kembali. Apakah Anda sudah menerima bansos tersebut secara nyata?</p>
                        <div style="display:flex; gap:10px;">
                            <button onclick="window.konfirmasiLaporSelesaiWarga()" class="btn btn-primary" style="font-size:0.85rem; padding:8px 14px;"><i class="fas fa-check-circle"></i> Ya, Sudah Diterima</button>
                            <button onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="font-size:0.85rem; padding:8px 14px; color:#ef4444; border-color:#ef4444;"><i class="fas fa-times"></i> Belum Diterima</button>
                        </div>
                    </div>
                `;
            } else if (w.is_lapor_curang || statusSalur.includes('Sengketa')) {
                progressHtml = `
                    <div style="background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:10px; margin-top:10px;">
                        <div style="color:#dc2626; font-weight:bold;"><i class="fas fa-exclamation-triangle"></i> Sanggahan Dalam Investigasi</div>
                        <p style="font-size:0.88rem; color:#64748b; margin-top:4px;">Petugas Dinsos sedang menindaklanjuti sanggahan Anda. Silakan koordinasi melalui kolom obrolan di samping.</p>
                    </div>
                `;
            } else if (statusSalur === 'Telah Menerima' || statusSalur === 'Selesai') {
                progressHtml = `
                    <div style="background:#ecfdf5; border:1px solid #a7f3d0; padding:12px; border-radius:10px; margin-top:10px;">
                        <div style="color:#059669; font-weight:bold;"><i class="fas fa-check-circle"></i> Bantuan Sosial Selesai Disalurkan</div>
                        <p style="font-size:0.88rem; color:#64748b; margin-top:4px;">Bantuan fisik telah tervalidasi diterima oleh Kepala Keluarga bersangkutan.</p>
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
// 8. DASHBOARD KHUSUS PENGADUAN (WARGA BELUM TERDAFTAR / GAGAL DAFTAR)
// =========================================================================
window.masukDashboardPengaduan = function (nik, nama, uraian) {
    sesiAduanAktif = { nik, nama, uraian, statusStep: 2 };

    window.switchTabPublik('sectionDashboardPengaduan');

    const dispNama = document.getElementById('aduanNamaDisplay');
    const dispNik = document.getElementById('aduanNikDisplay');
    const dispUraian = document.getElementById('aduanUraianDisplay');

    if (dispNama) dispNama.innerText = nama;
    if (dispNik) dispNik.innerText = nik;
    if (dispUraian) dispUraian.innerText = uraian;

    fetch(`${API_URL}/api/publik/pengaduan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nik: nik,
            nama_pelapor: nama,
            kategori: 'Aduan Belum Terdaftar',
            isi_laporan: `[Aduan Belum Terdaftar] ${uraian}`
        })
    }).catch(() => {});

    window.muatPesanAduan();
    if (!aduanChatInterval) {
        aduanChatInterval = setInterval(() => {
            window.muatPesanAduan();
        }, 3500);
    }
};

window.keluarDashboardPengaduan = function () {
    if (aduanChatInterval) {
        clearInterval(aduanChatInterval);
        aduanChatInterval = null;
    }
    sesiAduanAktif = null;
    window.switchTabPublik('loginWargaSection');
};

window.muatPesanAduan = async function () {
    if (!sesiAduanAktif) return;
    const box = document.getElementById('aduanChatMessages');
    if (!box) return;

    try {
        const res = await fetch(`${API_URL}/api/chat/${encodeURIComponent(sesiAduanAktif.nik)}`);
        const chats = await res.json();
        if (!Array.isArray(chats) || chats.length === 0) {
            box.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin:auto; padding:20px;">Pesan aduan Anda telah dicatat ke Pusat Investigasi. Petugas akan membalas di sini secara langsung.</div>`;
            return;
        }

        box.innerHTML = chats.map(c => {
            const isMe = c.sender === 'warga';
            return `
                <div style="align-self:${isMe ? 'flex-end' : 'flex-start'}; max-width:80%; background:${isMe ? '#fee2e2' : '#f1f5f9'}; color:${isMe ? '#991b1b' : '#0f172a'}; padding:10px 14px; border-radius:14px; font-size:0.88rem; border:1px solid ${isMe ? '#fecdd3' : '#e2e8f0'}; box-shadow:0 2px 5px rgba(0,0,0,0.04);">
                    ${!isMe ? '<small style="display:block; font-weight:800; color:#0284c7; margin-bottom:3px;"><i class="fas fa-user-shield"></i> Petugas Dinsos</small>' : ''}
                    ${safeHtml(c.pesan)}
                    <div style="font-size:0.68rem; color:#94a3b8; text-align:right; margin-top:4px;">${c.waktu || ''}</div>
                </div>
            `;
        }).join('');
        box.scrollTop = box.scrollHeight;
    } catch (e) {}
};

window.kirimPesanAduan = async function () {
    const inp = document.getElementById('aduanChatInput');
    const msg = inp ? inp.value.trim() : '';
    if (!msg || !sesiAduanAktif) return;
    inp.value = '';

    const formData = new FormData();
    formData.append('sender', 'warga');
    formData.append('nama', sesiAduanAktif.nama);
    formData.append('pesan', `[Aduan Belum Terdaftar] ${msg}`);

    try {
        await fetch(`${API_URL}/api/chat/${encodeURIComponent(sesiAduanAktif.nik)}`, {
            method: 'POST',
            body: formData
        });
        window.muatPesanAduan();
    } catch (err) {}
};

// =========================================================================
// 9. CHAT & SENGKETA MULTIMEDIA DINSOS
// =========================================================================
window.sendWargaChat = window.kirimPesanWarga = async function () {
    const currentNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
    const currentNama = wargaNama || (sesiWargaAktif && sesiWargaAktif.nama_lengkap) || 'Warga';
    if (!currentNik) return;

    const input = document.getElementById('wargaChatInput');
    const pesan = input ? input.value.trim() : '';

    if (!pesan && !window.editedMediaBlob) return;

    const formData = new FormData();
    formData.append('sender', 'warga');
    formData.append('nama', currentNama);
    formData.append('pesan', pesan);

    if (window.editedMediaBlob) {
        const finalName = `media_${Date.now()}.${window.editedMediaExt || 'jpg'}`;
        formData.append('file', window.editedMediaBlob, finalName);
        if (window.editedMediaType) {
            formData.append('custom_file_type', window.editedMediaType);
        }
    }

    if (replyToDataWarga) {
        formData.append('reply_to_id', replyToDataWarga.id);
        formData.append('reply_to_text', replyToDataWarga.text);
        formData.append('reply_to_sender', replyToDataWarga.sender);
    }

    if (input) input.value = '';
    window.batalLampiranWarga();
    window.batalReplyWarga();

    try {
        await fetch(`${API_URL}/api/chat/${encodeURIComponent(currentNik)}`, {
            method: 'POST',
            body: formData
        });
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {
        console.error('[Send Chat Error]', e);
    }
};

window.setReplyWarga = function (id, sender, text, file_type) {
    let displayTxt = text;
    if (file_type === 'image') displayTxt = '📷 Gambar';
    else if (file_type === 'video') displayTxt = '🎥 Video';
    else if (file_type === 'audio') displayTxt = '🎤 Pesan Suara';

    replyToDataWarga = { id, sender, text: displayTxt };
    const cont = document.getElementById('replyPreviewContainerWarga');
    if (cont) {
        const sEl = document.getElementById('replyPreviewSenderWarga');
        const tEl = document.getElementById('replyPreviewTextWarga');
        if (sEl) sEl.innerText = safeHtml(sender);
        if (tEl) tEl.innerText = displayTxt;
        cont.style.display = 'flex';
    }
    document.getElementById('wargaChatInput')?.focus();
};

window.batalReplyWarga = function () {
    replyToDataWarga = null;
    const cont = document.getElementById('replyPreviewContainerWarga');
    if (cont) cont.style.display = 'none';
};

window.reactToMessageWarga = async function (msgId) {
    const emojis = ['👍', '❤️', '😂', '🙏', '🔥', '✅', '❌', '🚨'];
    let html = `<div style="display:flex; gap:10px; justify-content:center; font-size:1.8rem; cursor:pointer; flex-wrap:wrap;">`;
    emojis.forEach(em => {
        html += `<span onclick="window.submitReactionWarga(${msgId}, '${em}')" style="transition:0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${em}</span>`;
    });
    html += `</div>`;
    showPortalAlert({ title: 'Beri Reaksi Emoji', html, showConfirmButton: false });
};

window.submitReactionWarga = async function (msgId, emoji) {
    Swal?.close();
    try {
        await fetch(`${API_URL}/api/chat/react/${msgId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction: emoji })
        }).catch(() => null);
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {}
};

window.togglePinMessageWarga = async function (msgId) {
    try {
        await fetch(`${API_URL}/api/chat/pin/${msgId}`, { method: 'PATCH' }).catch(() => null);
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {}
};

window.hapusPesanWarga = async function (id, tipe) {
    const konfirmasi = confirm(`Yakin ingin ${tipe === 'everyone' ? 'menarik pesan ini' : 'menghapus pesan dari layar Anda'}?`);
    if (konfirmasi) {
        try {
            await fetch(`${API_URL}/api/chat/action/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: tipe, requester: 'warga' })
            }).catch(() => null);
            lastChatHashWarga = '';
            window.loadChatMessagesWarga(false);
        } catch (e) {}
    }
};

window.laporPesanAdmin = async function (msgId) {
    if (typeof Swal === 'undefined') {
        alert('Fitur pelaporan memerlukan pustaka SweetAlert.');
        return;
    }

    const { value: alasan } = await Swal.fire({
        title: 'Laporkan Pesan Petugas',
        input: 'select',
        inputOptions: {
            'Kata-kata Kasar': 'Kata-kata Kasar / Pelecehan',
            'Permintaan Ilegal': 'Permintaan Uang / Pungutan Liar',
            'Informasi Palsu': 'Informasi Penyaluran Tidak Sesuai',
            'Lainnya': 'Lainnya'
        },
        showCancelButton: true,
        confirmButtonText: 'Kirim Laporan',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Batal'
    });

    if (alasan) {
        try {
            await fetch(`${API_URL}/api/chat/report/${msgId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: alasan, reporter: wargaNama })
            }).catch(() => null);
            showPortalAlert({ icon: 'success', title: 'Terlapor', text: 'Laporan Anda telah diteruskan ke meja Pengawas Dinsos Sidoarjo.' });
        } catch (e) {}
    }
};

window.toggleChatMenuWarga = function (id, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    document.querySelectorAll('[id^="menu-warga-"]').forEach(m => {
        if (m.id !== `menu-warga-${id}`) m.style.display = 'none';
    });
    const menu = document.getElementById(`menu-warga-${id}`);
    if (menu) menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'flex' : 'none';
};

window.scrollToMessageWarga = function (id) {
    const el = document.getElementById(`msg-warga-${id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = '0 0 15px #009846';
        setTimeout(() => el.style.boxShadow = '', 2000);
    }
};

window.toggleEmojiPickerWarga = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const el = document.getElementById('emojiPickerWarga');
    if (el) {
        const emojisList = ['😀', '😂', '🥰', '😎', '😭', '😡', '👍', '🙏', '❤️', '🔥', '✅', '❌', '💡', '🎉', '😢', '🤔', '👏', '🚨'];
        let html = '';
        emojisList.forEach(e => {
            html += `<div style="cursor:pointer; font-size:1.4rem; text-align:center; user-select:none; padding:4px;" onclick="window.addEmojiWarga('${e}')">${e}</div>`;
        });
        el.innerHTML = html;
        el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'grid' : 'none';
    }
};

window.addEmojiWarga = function (emoji) {
    const input = document.getElementById('wargaChatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
};

window.showPreviewWarga = function (srcUrl, type, fname = '') {
    const previewContainer = document.getElementById('previewMediaContainerWarga');
    const previewArea = document.getElementById('preSendPreviewWarga');
    if (previewArea && previewContainer) {
        if (type === 'image') {
            previewContainer.innerHTML = `<img src="${srcUrl}" style="max-height:100px; border-radius:8px; object-fit:contain;">`;
        } else if (type === 'video') {
            previewContainer.innerHTML = `<video src="${srcUrl}" style="max-height:100px; border-radius:8px;" controls></video>`;
        } else {
            previewContainer.innerHTML = `<div style="font-weight:700; color:var(--info, #0284c7); text-align:center;"><i class="fas fa-file-alt fa-2x"></i><br><small>${safeHtml(fname)}</small></div>`;
        }
        previewArea.style.display = 'block';
    }
};

window.batalLampiranWarga = function () {
    window.editedMediaBlob = null;
    window.editedMediaExt = '';
    window.editedMediaType = '';
    const fileInput = document.getElementById('wargaChatFile');
    if (fileInput) fileInput.value = '';
    const preArea = document.getElementById('preSendPreviewWarga');
    if (preArea) preArea.style.display = 'none';
    const preContainer = document.getElementById('previewMediaContainerWarga');
    if (preContainer) preContainer.innerHTML = '';
};

window.openLightbox = function (type, src) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            imageUrl: src,
            imageAlt: 'Lampiran Berkas',
            showConfirmButton: false,
            showCloseButton: true,
            background: 'rgba(0,0,0,0.85)'
        });
    } else {
        window.open(src, '_blank');
    }
};

// =========================================================================
// 10. VOICE RECORDER WARGA (PESAN SUARA)
// =========================================================================
window.toggleVoiceRecordWarga = async function () {
    const ui = document.getElementById('wargaRecordingUI');
    const btnRecord = document.getElementById('btnRecordWarga');

    if (mediaRecorderWarga && mediaRecorderWarga.state === 'recording') {
        mediaRecorderWarga.stop();
        if (voiceTimerIntervalWarga) clearInterval(voiceTimerIntervalWarga);
        if (ui) ui.style.display = 'none';
        if (btnRecord) btnRecord.style.color = '#64748b';
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksWarga = [];
        mediaRecorderWarga = new MediaRecorder(stream);

        mediaRecorderWarga.ondataavailable = e => {
            if (e.data.size > 0) audioChunksWarga.push(e.data);
        };

        mediaRecorderWarga.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const audioBlob = new Blob(audioChunksWarga, { type: 'audio/webm' });
            window.editedMediaBlob = audioBlob;
            window.editedMediaExt = 'webm';
            window.editedMediaType = 'audio';
            window.sendWargaChat();
        };

        mediaRecorderWarga.start();
        voiceSecondsWarga = 0;
        if (ui) ui.style.display = 'flex';
        if (btnRecord) btnRecord.style.color = '#dc2626';

        const timeEl = document.getElementById('wargaRecordTime');
        if (timeEl) timeEl.innerText = '00:00';
        voiceTimerIntervalWarga = setInterval(() => {
            voiceSecondsWarga++;
            const m = String(Math.floor(voiceSecondsWarga / 60)).padStart(2, '0');
            const s = String(voiceSecondsWarga % 60).padStart(2, '0');
            if (timeEl) timeEl.innerText = `${m}:${s}`;
        }, 1000);
    } catch (err) {
        showPortalAlert({ icon: 'error', title: 'Mikrofon Ditolak', text: 'Izinkan akses mikrofon peramban untuk merekam suara.' });
    }
};

window.cancelVoiceRecordWarga = function () {
    if (mediaRecorderWarga && mediaRecorderWarga.state === 'recording') {
        mediaRecorderWarga.ondataavailable = null;
        mediaRecorderWarga.onstop = null;
        mediaRecorderWarga.stop();
    }
    if (voiceTimerIntervalWarga) clearInterval(voiceTimerIntervalWarga);
    audioChunksWarga = [];
    const ui = document.getElementById('wargaRecordingUI');
    const btnRecord = document.getElementById('btnRecordWarga');
    if (ui) ui.style.display = 'none';
    if (btnRecord) btnRecord.style.color = '#64748b';
};

// =========================================================================
// 11. WEBRTC DUA ARAH (VIDEO & AUDIO CALL DENGAN DINAS)
// =========================================================================
window.initPeerWarga = function () {
    if (peerWarga && !peerWarga.destroyed) return;
    const peerId = `warga_${wargaNik || 'guest'}_${Math.floor(Math.random() * 1000)}`;
    peerWarga = new Peer(peerId, { debug: 1 });

    peerWarga.on('call', call => {
        Swal.fire({
            title: '<i class="fas fa-phone-volume text-success"></i> Panggilan Masuk',
            text: 'Petugas Dinas Sosial Sidoarjo memanggil Anda.',
            showCancelButton: true,
            confirmButtonText: 'Terima',
            cancelButtonText: 'Tolak',
            confirmButtonColor: '#009846',
            cancelButtonColor: '#dc2626'
        }).then(async r => {
            if (r.isConfirmed) {
                const isVideo = (call.metadata && call.metadata.type === 'video');
                try {
                    localStreamWarga = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
                    call.answer(localStreamWarga);
                    window.handleCallConnectedWarga(call, isVideo);
                } catch (e) {
                    showPortalAlert({ icon: 'error', title: 'Gagal Menjawab', text: 'Tidak dapat mengakses kamera/mikrofon gawai.' });
                }
            } else {
                call.close();
            }
        });
    });
};

window.startCallAdmin = async function (type = 'audio') {
    if (typeof Peer === 'undefined') {
        return showPortalAlert({ icon: 'warning', title: 'Fitur Belum Siap', text: 'Pustaka WebRTC PeerJS belum termuat pada halaman.' });
    }

    window.initPeerWarga();
    const isVideo = (type === 'video');

    try {
        localStreamWarga = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        const callTargetId = 'petugas_dinsos_sidoarjo';
        const call = peerWarga.call(callTargetId, localStreamWarga, { metadata: { type, nik: wargaNik, nama: wargaNama } });

        if (!call) {
            return showPortalAlert({ icon: 'info', title: 'Petugas Sibuk', text: 'Petugas Dinsos sedang tidak dalam antrean panggilan langsung.' });
        }

        window.handleCallConnectedWarga(call, isVideo);
    } catch (e) {
        showPortalAlert({ icon: 'error', title: 'Izin Ditolak', text: 'Izinkan akses kamera dan mikrofon pada peramban Anda.' });
    }
};

window.handleCallConnectedWarga = function (call, isVideo) {
    currentCallWarga = call;
    const modal = document.getElementById('wargaActiveCallUI');
    const vArea = document.getElementById('wargaVideoCallArea');
    const aArea = document.getElementById('wargaAudioCallArea');
    const localV = document.getElementById('wargaLocalVideo');
    const remoteV = document.getElementById('wargaRemoteVideo');
    const timerEl = document.getElementById('wargaCallStatusText');

    if (modal) modal.style.display = 'flex';

    if (isVideo) {
        if (vArea) vArea.style.display = 'block';
        if (aArea) aArea.style.display = 'none';
        if (localV && localStreamWarga) localV.srcObject = localStreamWarga;
    } else {
        if (vArea) vArea.style.display = 'none';
        if (aArea) aArea.style.display = 'flex';
    }

    call.on('stream', remoteStream => {
        if (remoteV) remoteV.srcObject = remoteStream;
    });

    call.on('close', () => {
        window.endCallWarga();
    });

    callSecondsWarga = 0;
    if (callTimerWarga) clearInterval(callTimerWarga);
    callTimerWarga = setInterval(() => {
        callSecondsWarga++;
        const m = String(Math.floor(callSecondsWarga / 60)).padStart(2, '0');
        const s = String(callSecondsWarga % 60).padStart(2, '0');
        if (timerEl) timerEl.innerText = `${m}:${s}`;
    }, 1000);
};

window.toggleMuteCallWarga = function () {
    if (!localStreamWarga) return;
    const aTrack = localStreamWarga.getAudioTracks()[0];
    if (!aTrack) return;
    aTrack.enabled = !aTrack.enabled;
    const btn = document.getElementById('wargaBtnMute');
    if (btn) btn.style.background = aTrack.enabled ? '#334155' : '#dc2626';
};

window.endCallWarga = function () {
    if (callTimerWarga) clearInterval(callTimerWarga);
    if (currentCallWarga) currentCallWarga.close();
    if (localStreamWarga) {
        localStreamWarga.getTracks().forEach(t => t.stop());
        localStreamWarga = null;
    }
    currentCallWarga = null;
    const modal = document.getElementById('wargaActiveCallUI');
    if (modal) modal.style.display = 'none';
};

// =========================================================================
// 12. RENDER BUBBLE OBROLAN WARGA
// =========================================================================
window.loadChatMessagesWarga = window.muatPesanWarga = async function (isSilent = false) {
    const currentNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
    if (!currentNik) return;

    try {
        const res = await fetch(`${API_URL}/api/chat/${encodeURIComponent(currentNik)}?viewer=warga`);
        if (!res.ok) return;
        let data = await res.json();
        if (!Array.isArray(data)) data = [];

        const dataHash = JSON.stringify(data);
        if (isSilent && lastChatHashWarga === dataHash) return;
        lastChatHashWarga = dataHash;

        let html = '';
        let pinnedHtml = '';

        data.forEach(msg => {
            const isWarga = msg.sender === 'warga';
            const align = isWarga ? 'flex-end' : 'flex-start';
            const bg = isWarga ? '#dcf8c6' : '#ffffff';
            const color = '#1e293b';
            const borderRadius = isWarga ? '14px 2px 14px 14px' : '2px 14px 14px 14px';
            const shadow = '0 1px 3px rgba(0,0,0,0.12)';

            if (msg.is_pinned && !msg.is_deleted) {
                pinnedHtml += `
                    <div onclick="window.scrollToMessageWarga(${msg.id})" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; background:#fffbeb; border-left:4px solid #f59e0b; padding:6px 12px; margin-bottom:8px; border-radius:6px; font-size:0.8rem;">
                        <div><i class="fas fa-thumbtack" style="color:#f59e0b; margin-right:6px;"></i><b>${isWarga ? 'Anda' : 'Dinas Sosial'}:</b> ${safeHtml(msg.pesan || 'Lampiran Berkas')}</div>
                        <i class="fas fa-times" onclick="event.stopPropagation(); window.togglePinMessageWarga(${msg.id});"></i>
                    </div>
                `;
            }

            let replyHtml = '';
            if (msg.reply_to_text) {
                replyHtml = `
                    <div onclick="window.scrollToMessageWarga(${msg.reply_to_id})" style="cursor:pointer; background:rgba(0,0,0,0.05); padding:6px 10px; border-radius:8px; border-left:4px solid ${isWarga ? '#10b981' : '#0284c7'}; margin-bottom:6px; font-size:0.82rem; color:#475569;">
                        <b>${safeHtml(msg.reply_to_sender)}</b><br>
                        <i>${safeHtml(msg.reply_to_text)}</i>
                    </div>
                `;
            }

            let reactionHtml = '';
            if (msg.reaction) {
                reactionHtml = `<div style="position:absolute; ${isWarga ? 'left:-8px' : 'right:-8px'}; bottom:-10px; background:#ffffff; border-radius:20px; padding:2px 6px; box-shadow:0 2px 5px rgba(0,0,0,0.2); font-size:0.95rem; z-index:5;">${msg.reaction}</div>`;
            }

            let mediaHtml = '';
            if (msg.file_path) {
                const cleanFileUrl = `${API_URL}/uploads/${msg.file_path.replace('/uploads/', '').replace(/^\/+/, '')}`;
                if (msg.file_type === 'audio') {
                    mediaHtml = `<div style="margin-bottom:8px;"><audio controls src="${cleanFileUrl}" style="max-width:220px; height:36px;"></audio></div>`;
                } else if (msg.file_type === 'image') {
                    mediaHtml = `<img src="${cleanFileUrl}" alt="Lampiran" style="max-width:240px; border-radius:8px; margin-bottom:6px; cursor:pointer; object-fit:cover;" onclick="window.openLightbox('image', '${cleanFileUrl}')">`;
                } else if (msg.file_type === 'video') {
                    mediaHtml = `<video src="${cleanFileUrl}" controls style="max-width:240px; border-radius:8px; margin-bottom:6px; background:#000000;"></video>`;
                } else {
                    mediaHtml = `<div style="margin-bottom:6px;"><a href="${cleanFileUrl}" target="_blank" style="color:#0284c7; font-weight:700; font-size:0.85rem; text-decoration:none;"><i class="fas fa-file-download"></i> Unduh Lampiran Dokumen</a></div>`;
                }
            }

            let actionMenu = '';
            if (!msg.is_deleted) {
                actionMenu = `
                    <div style="position:absolute; ${isWarga ? 'left:-26px' : 'right:-26px'}; top:6px; cursor:pointer; color:#94a3b8;" onclick="window.toggleChatMenuWarga(${msg.id}, event)">
                        <i class="fas fa-ellipsis-v"></i>
                        <div id="menu-warga-${msg.id}" style="display:none; position:absolute; ${isWarga ? 'right:12px' : 'left:12px'}; top:0; background:#ffffff; box-shadow:0 10px 15px -3px rgba(0,0,0,0.15); border-radius:8px; padding:6px; z-index:1000; flex-direction:column; min-width:160px; border:1px solid #e2e8f0; font-size:0.82rem;">
                            <button type="button" onclick="window.reactToMessageWarga(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-smile" style="color:#f59e0b;"></i> Reaksi Emoji</button>
                            <button type="button" onclick="window.setReplyWarga(${msg.id}, '${isWarga ? 'Anda' : 'Dinas Sosial'}', decodeURIComponent('${enc(msg.pesan)}'), '${msg.file_type}')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-reply" style="color:#0284c7;"></i> Balas Pesan</button>
                            <button type="button" onclick="window.togglePinMessageWarga(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-thumbtack" style="color:#10b981;"></i> ${msg.is_pinned ? 'Lepas Pin' : 'Sematkan'}</button>
                            <button type="button" onclick="window.hapusPesanWarga(${msg.id}, 'me')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#64748b;"><i class="fas fa-eye-slash"></i> Hapus untuk Saya</button>
                            ${isWarga ? `<button type="button" onclick="window.hapusPesanWarga(${msg.id}, 'everyone')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#ef4444;"><i class="fas fa-trash-alt"></i> Tarik Pesan</button>` : ''}
                            ${!isWarga ? `<button type="button" onclick="window.laporPesanAdmin(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#dc2626;"><i class="fas fa-flag"></i> Laporkan Petugas</button>` : ''}
                        </div>
                    </div>
                `;
            }

            html += `
                <div id="msg-warga-${msg.id}" style="align-self:${align}; max-width:75%; position:relative; margin-bottom:14px; display:flex; flex-direction:column; align-items:${isWarga ? 'flex-end' : 'flex-start'};">
                    <div style="background:${bg}; color:${color}; padding:8px 12px; border-radius:${borderRadius}; box-shadow:${shadow}; font-size:0.92rem; line-height:1.45; min-width:140px; text-align:left;">
                        ${msg.is_pinned ? `<div style="font-size:0.7rem; color:#f59e0b; font-weight:700; margin-bottom:4px;"><i class="fas fa-thumbtack"></i> Disematkan</div>` : ''}
                        ${replyHtml}
                        ${mediaHtml}
                        ${msg.pesan ? `<span style="display:block; word-break:break-word;">${safeHtml(msg.pesan)}</span>` : ''}
                        <div style="display:flex; justify-content:flex-end; align-items:center; gap:4px; border-top:1px solid rgba(0,0,0,0.06); padding-top:4px; margin-top:4px;">
                            <span style="font-size:0.68rem; color:#64748b; font-weight:700;">${msg.waktu || ''}</span>
                            ${isWarga ? '<i class="fas fa-check-double" style="font-size:0.68rem; color:#0284c7;"></i>' : ''}
                        </div>
                    </div>
                    ${reactionHtml}
                    ${actionMenu}
                </div>
            `;
        });

        const container = document.getElementById('wargaChatMessages');
        if (container) {
            container.innerHTML = (pinnedHtml ? `<div id="pinnedHeaderAreaWarga" style="position:sticky; top:0; z-index:10;">${pinnedHtml}</div>` : '') +
                (html || `<div style="text-align:center; color:#94a3b8; margin-top:50px; font-size:0.88rem;">Belum ada riwayat pesan percakapan.</div>`);
            container.scrollTop = container.scrollHeight;
        }
    } catch (e) {
        console.error('[Load Chat Error]', e);
    }
};

// =========================================================================
// 13. PENDAFTARAN MANDIRI (BEBAS TOKEN AUTENTIKASI)
// =========================================================================
window.acakCaptchaPendaftaran = function () {
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 8) + 1;
    captchaAnswerPendaftaran = a + b;
    const el = document.getElementById('wargaCaptchaQ');
    if (el) el.innerText = `${a} + ${b} = ?`;
    const ansInp = document.getElementById('wargaCaptchaA');
    if (ansInp) ansInp.value = '';
};

window.daftarMandiri = window.kirimPendaftaranMandiri = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const ansInp = document.getElementById('wargaCaptchaA');
    if (ansInp && parseInt(ansInp.value.trim(), 10) !== captchaAnswerPendaftaran) {
        window.acakCaptchaPendaftaran();
        return showPortalAlert({ icon: 'warning', title: 'Verifikasi Gagal', text: 'Jawaban hitungan anti-bot salah! Silakan coba lagi.' });
    }

    const payload = {
        nik: document.getElementById('regNik')?.value.trim(),
        nama: document.getElementById('regNama')?.value.trim(),
        tempat_lahir: document.getElementById('regTempatLahir')?.value.trim() || 'Sidoarjo',
        tanggal_lahir: document.getElementById('regTglLahir')?.value || null,
        alamat: document.getElementById('regAlamat')?.value.trim(),
        lat: document.getElementById('latPublik')?.value.trim() || '-7.4478',
        lng: document.getElementById('lngPublik')?.value.trim() || '112.7183',
        no_hp: document.getElementById('regNoHp')?.value.trim() || '',
        email: document.getElementById('regEmail')?.value.trim() || '',
        c1: parseFloat(document.getElementById('regC1')?.value || 1200000),
        c2: parseInt(document.getElementById('regC2')?.value || 3000000),
        c3: parseInt(document.getElementById('regC3')?.value || 45),
        c4: parseInt(document.getElementById('regC4')?.value || 1),
        c5: parseInt(document.getElementById('regC5')?.value || 3),
        c6: parseInt(document.getElementById('regC6')?.value || 1),
        c7: parseInt(document.getElementById('regC7')?.value || 2),
        c8: parseInt(document.getElementById('regC8')?.value || 1),
        c9: parseInt(document.getElementById('regC9')?.value || 1),
        c10: parseInt(document.getElementById('regC10')?.value || 1),
        catatan: document.getElementById('regCatatan')?.value.trim() || 'Pendaftaran Mandiri Portal Warga'
    };

    if (!payload.nik || !payload.nama || payload.nik.length !== 16) {
        return showPortalAlert({ icon: 'warning', title: 'Data Belum Lengkap', text: 'NIK (16 digit) dan Nama Lengkap wajib diisi.' });
    }

    showPortalAlert({ title: 'Menyimpan Berkas...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        const res = await fetch(`${API_URL}/warga`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => ({}));
        Swal?.close();

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Berhasil Terdaftar!',
                text: 'Berkas Anda berhasil dicatat dan masuk status menunggu validasi petugas.',
                confirmButtonColor: '#009846'
            });
            document.getElementById('formPendaftaranWarga')?.reset();
            window.acakCaptchaPendaftaran();
            window.switchTabPublik('cekStatusSection');
            const cekInput = document.getElementById('cekNik') || document.getElementById('lacakNik');
            if (cekInput) cekInput.value = payload.nik;
        } else {
            showPortalAlert({ 
                icon: 'error', 
                title: 'Gagal Mendaftar', 
                text: json.message || 'Terjadi kesalahan saat memproses berkas pendaftaran.' 
            });
            window.acakCaptchaPendaftaran();
        }
    } catch (err) {
        Swal?.close();
        showPortalAlert({ 
            icon: 'error', 
            title: 'Koneksi Peladen Terputus', 
            html: '<p style="font-size:0.9rem;">Gagal mengirim berkas ke peladen. Pastikan backend Flask (<code>python app.py</code>) telah dijalankan.</p>' 
        });
        window.acakCaptchaPendaftaran();
    }
};

// =========================================================================
// 14. TUR INTERAKTIF NON-BLOCKING & FAQ ACCORDION
// =========================================================================
window.toggleFaq = function (el) {
    const answer = el.nextElementSibling;
    const icon = el.querySelector('i');
    const isOpen = answer.style.display === 'block';
    document.querySelectorAll('.faq-answer').forEach(a => a.style.display = 'none');
    document.querySelectorAll('.faq-question i').forEach(i => i.className = 'fas fa-chevron-down');
    if (!isOpen) {
        answer.style.display = 'block';
        if (icon) icon.className = 'fas fa-chevron-up';
    }
};

const daftarLangkahTur = [
    {
        targetId: 'loginWargaSection',
        badge: 'Kanal Akses',
        title: 'Masuk Dashboard Pribadi',
        desc: 'Masukkan NIK, Nama KTP, dan Email untuk membuka Dashboard Personal, memantau riwayat penetapan, serta berkoordinasi via Live Chat & Panggilan WebRTC bersama petugas Dinsos.'
    },
    {
        targetId: 'cekStatusSection',
        badge: 'Transparansi',
        title: 'Cek Status Bansos Terpadu',
        desc: 'Cukup masukkan 16 digit NIK untuk mengetahui klasifikasi desil (1-10), status kelayakan bansos, dan status penyaluran fisik secara seketika dan transparan.'
    },
    {
        targetId: 'daftarMandiriSection',
        badge: 'Pendaftaran',
        title: 'Pendaftaran Mandiri & Geotagging GPS',
        desc: 'Bagi keluarga yang belum terdata, ajukan data survei mandiri dengan mengisi 10 indikator kelayakan SPK BWM-SAW dan mengunci koordinat titik GPS rumah Anda.'
    },
    {
        targetId: 'bantuanSection',
        badge: 'Edukasi',
        title: 'Pusat Edukasi & Bantuan (FAQ)',
        desc: 'Panduan lengkap mengenai regulasi desil 1-4, prosedur sanggah desil faktual, dan tindakan penyelesaian jika fisik bantuan belum diterima.'
    },
    {
        targetId: 'chatbotFabBtn',
        badge: 'Asisten Virtual',
        title: 'Asisten Cerdas & Jalur Pengaduan',
        desc: 'Jika Anda belum terdaftar atau terkendala teknis saat mendaftar, klik ikon robot di pojok kanan bawah untuk diarahkan langsung ke Dashboard Khusus Pengaduan.'
    }
];

window.mulaiTurInteraktif = function () {
    window.tutupModalPanduan();
    if (typeof Swal !== 'undefined') Swal.close();

    activeTourIndex = 0;
    window.jalankanLangkahTur(activeTourIndex);
};

window.jalankanLangkahTur = function (index) {
    if (index < 0 || index >= daftarLangkahTur.length) {
        window.tutupTurInteraktif();
        return;
    }

    activeTourIndex = index;
    const step = daftarLangkahTur[index];

    document.querySelectorAll('.highlight-focus').forEach(el => el.classList.remove('highlight-focus'));

    if (step.targetId === 'chatbotFabBtn') {
        const botBtn = document.getElementById('chatbotFabBtn') || document.getElementById('chatbotTriggerBtn');
        if (botBtn) {
            botBtn.classList.add('highlight-focus');
            botBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
        window.switchTabPublik(step.targetId);
        const cardTarget = document.getElementById(step.targetId);
        if (cardTarget) {
            cardTarget.classList.add('highlight-focus');
            cardTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    let tourBox = document.getElementById('floatingTourGuideBar');
    if (!tourBox) {
        tourBox = document.createElement('div');
        tourBox.id = 'floatingTourGuideBar';
        tourBox.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            width: 92%;
            max-width: 660px;
            background: #ffffff;
            border-radius: 20px;
            border: 2px solid #009846;
            box-shadow: 0 16px 45px rgba(15, 23, 42, 0.25);
            padding: 18px 24px;
            z-index: 999999;
            animation: slideUpTourBar 0.3s ease;
        `;
        document.body.appendChild(tourBox);
    }

    const isLast = (index === daftarLangkahTur.length - 1);
    tourBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="background:#e6f9f0; color:#009846; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:12px; letter-spacing:0.3px;">
                <i class="fas fa-compass"></i> LANGKAH ${index + 1} DARI ${daftarLangkahTur.length}: ${step.badge.toUpperCase()}
            </span>
            <button type="button" onclick="window.tutupTurInteraktif()" style="background:none; border:none; color:#94a3b8; font-size:1.4rem; cursor:pointer; line-height:1;" title="Tutup Tur">&times;</button>
        </div>
        <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:4px 0 6px 0;">${step.title}</h4>
        <p style="font-size:0.88rem; color:#475569; line-height:1.55; margin:0 0 16px 0;">${step.desc}</p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <button type="button" onclick="window.tutupTurInteraktif()" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#64748b; padding:8px 16px; border-radius:20px; font-weight:700; font-size:0.82rem; cursor:pointer;">
                Lewati Tur
            </button>
            <div style="display:flex; gap:8px;">
                <button type="button" onclick="window.jalankanLangkahTur(${index - 1})" ${index === 0 ? 'disabled' : ''} style="background:${index === 0 ? '#f1f5f9' : '#ffffff'}; border:1px solid #cbd5e1; color:${index === 0 ? '#cbd5e1' : '#0f172a'}; padding:8px 16px; border-radius:20px; font-weight:700; font-size:0.82rem; cursor:${index === 0 ? 'not-allowed' : 'pointer'};">
                    &larr; Sebelumnya
                </button>
                <button type="button" onclick="window.jalankanLangkahTur(${index + 1})" style="background:#009846; border:none; color:#ffffff; padding:8px 20px; border-radius:20px; font-weight:800; font-size:0.82rem; cursor:pointer; box-shadow:0 3px 10px rgba(0,152,70,0.25);">
                    ${isLast ? '<i class="fas fa-check"></i> Selesai Tur' : 'Lanjut &rarr;'}
                </button>
            </div>
        </div>
    `;
};

window.tutupTurInteraktif = function () {
    document.querySelectorAll('.highlight-focus').forEach(el => el.classList.remove('highlight-focus'));
    const tourBox = document.getElementById('floatingTourGuideBar');
    if (tourBox) tourBox.remove();
};

window.bukaModalPanduanPortal = function () {
    const m = document.getElementById('modalPanduanPortal');
    if (m) m.style.display = 'flex';
};

window.tutupModalPanduan = function () {
    const m = document.getElementById('modalPanduanPortal');
    if (m) m.style.display = 'none';
};

window.navigasiPanduan = function (targetId) {
    window.tutupModalPanduan();

    if (targetId === 'chatbot') {
        window.toggleChatbotWindow();
        return;
    }

    window.switchTabPublik(targetId);

    const card = document.getElementById(targetId);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.remove('highlight-focus');
        void card.offsetWidth;
        card.classList.add('highlight-focus');
        setTimeout(() => card.classList.remove('highlight-focus'), 3000);
    }
};

// =========================================================================
// 15. CHATBOT ASISTEN VIRTUAL & INVESTIGASI SENGKETA
// =========================================================================
window.toggleChatbotWindow = window.toggleModernChatbot = function () {
    const win = document.getElementById('chatbotWindow') || document.getElementById('chatbotBox');
    if (!win) return;
    win.style.display = (win.style.display === 'flex' || win.style.display === 'block') ? 'none' : 'flex';
};

window.botReplyFAQ = function (topic) {
    const body = document.getElementById('chatbotMsgBody') || document.getElementById('chatbotMessages');
    if (!body) return;

    let qText = topic === 'kriteria' ? 'Siapa yang berhak menerima bansos?' : 'Kapan bantuan fisik dicairkan?';
    let aText = topic === 'kriteria'
        ? 'Bansos diprioritaskan bagi keluarga yang masuk dalam <b>Desil 1–4</b> hasil kalkulasi kriteria BWM-SAW yang akuntabel.'
        : 'Penyaluran fisik dilaksanakan terjadwal di kantor kelurahan/desa setempat membawa KTP dan KK asli.';

    body.innerHTML += `<div class="user-bubble" style="background:#009846; color:white; padding:10px 14px; border-radius:14px; align-self:flex-end; max-width:80%; margin-bottom:6px;">${qText}</div>`;
    setTimeout(() => {
        body.innerHTML += `<div class="bot-bubble" style="background:white; padding:12px 16px; border-radius:14px; border:1px solid #e2e8f0; font-size:0.88rem; line-height:1.5; margin-bottom:6px;">${aText}</div>`;
        body.scrollTop = body.scrollHeight;
    }, 300);
};

window.kirimPilihanBot = function (teks) {
    const body = document.getElementById('chatbotMessages') || document.getElementById('chatbotMsgBody');
    if (!body) return;
    body.innerHTML += `<div style="background: #0284c7; color: white; padding: 10px 14px; border-radius: 14px; align-self: flex-end; font-size: 0.88rem; max-width: 80%; margin-bottom:6px;">${teks}</div>`;

    setTimeout(() => {
        let balasan = "Petugas kami siap membantu penanganan aduan Anda.";
        if (teks.toLowerCase().includes('berhak')) {
            balasan = "Berdasarkan regulasi resmi, keluarga pada <b>Desil 1 sampai dengan 4</b> merupakan prioritas mutlak penerima bantuan sosial reguler.";
        } else if (teks.toLowerCase().includes('kapan')) {
            balasan = "Pencairan bantuan fisik dilakukan bertahap di kantor desa/kelurahan setempat dan divalidasi langsung oleh pendamping lapangan.";
        }
        body.innerHTML += `<div style="background: white; padding: 12px 16px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 0.88rem; line-height: 1.5; margin-bottom:6px;">${balasan}</div>`;
        body.scrollTop = body.scrollHeight;
    }, 350);
};

window.botSendMessage = window.kirimTeksBot = function () {
    const inp = document.getElementById('botInputText') || document.getElementById('chatbotInput');
    const txt = inp ? inp.value.trim() : '';
    if (!txt) return;
    inp.value = '';

    const body = document.getElementById('chatbotMsgBody') || document.getElementById('chatbotMessages');
    if (!body) return;
    body.innerHTML += `<div style="background: #0284c7; color: white; padding: 10px 14px; border-radius: 14px; align-self: flex-end; font-size: 0.88rem; max-width: 80%; margin-bottom:6px;">${safeHtml(txt)}</div>`;

    setTimeout(() => {
        body.innerHTML += `<div style="background: white; padding: 12px 16px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 0.88rem; line-height: 1.5; margin-bottom:6px;">Terima kasih atas pertanyaan Anda. Jika menemui kendala spesifik saat mendaftar, silakan gunakan tombol <b>Laporkan Masalah / Gagal Daftar</b> di atas.</div>`;
        body.scrollTop = body.scrollHeight;
    }, 350);
};

window.botBukaFormLapor = window.bukaFormLaporKendalaBot = async function () {
    window.toggleChatbotWindow();

    const { value: formValues } = await Swal.fire({
        title: '<i class="fas fa-shield-virus text-danger"></i> Laporkan Masalah / Gagal Daftar',
        html: `
            <div style="text-align:left; font-size:0.88rem;">
                <p style="margin-bottom:12px; color:#64748b;">Gunakan jalur ini jika Anda belum terdaftar atau terkendala teknis saat proses pendaftaran bansos.</p>
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Nomor Induk Kependudukan (NIK)</label>
                <input type="number" id="botSwalNik" class="form-input" placeholder="16 digit NIK KTP" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Nama Lengkap</label>
                <input type="text" id="botSwalNama" class="form-input" placeholder="Nama Anda" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Uraian Kendala yang Dialami</label>
                <textarea id="botSwalPesan" class="form-input" rows="3" placeholder="Contoh: NIK tidak terbaca, gagal kirim formulir, dll..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;"></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Buka Dashboard Pengaduan',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const nik = document.getElementById('botSwalNik')?.value.trim();
            const nama = document.getElementById('botSwalNama')?.value.trim();
            const pesan = document.getElementById('botSwalPesan')?.value.trim();
            if (!nik || nik.length !== 16) {
                Swal.showValidationMessage('Masukkan tepat 16 digit NIK!');
                return false;
            }
            if (!nama || !pesan) {
                Swal.showValidationMessage('Nama dan uraian kendala wajib ditulis!');
                return false;
            }
            return { nik, nama, pesan };
        }
    });

    if (formValues) {
        window.masukDashboardPengaduan(formValues.nik, formValues.nama, formValues.pesan);
    }
};