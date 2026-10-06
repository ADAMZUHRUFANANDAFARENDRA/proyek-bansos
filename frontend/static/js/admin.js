/**
 * Modul Utama: admin.js
 * Deskripsi: Core Orchestrator Dasbor Admin SPK Bansos Pemkab Sidoarjo
 * Menghubungkan seluruh modul fitur:
 * - admin-metrics.js, admin-table.js, admin-warga-crud.js
 * - admin-export.js, admin-import.js, admin-users.js
 * - admin-notif.js, admin-investigasi.js, admin-sync-db.js
 * - admin-spk.js, admin-map.js, admin-print.js, admin-chat.js
 */

/**
 * Modul Utama: admin.js
 * Deskripsi: Core Orchestrator Dasbor Admin SPK Bansos Pemkab Sidoarjo
 */

/* =========================================================================
   ADMIN.JS - ORCHESTRATOR UTAMA SISTEM SPK BANSOS PEMKAB SIDOARJO
   Lokasi: frontend/static/js/admin.js
   Pemerintah Kabupaten Sidoarjo - Dinas Sosial
   Sistem Pendukung Keputusan Penyaluran Bantuan Sosial (Metode BWM-SAW)
   Arsitektur: Modular Event-Driven + Anti-Collision Canvas Engine
   ========================================================================= */

// Matikan jendela peringatan bawaan DataTables secara global
if (typeof $ !== 'undefined' && $.fn && $.fn.dataTable) {
    $.fn.dataTable.ext.errMode = 'none';
}

// =========================================================================
// 1. INISIALISASI MODAL GLOBAL & HOOK DATA OTOMATIS
// =========================================================================
window.openModal = function (modalId) {
    const m = document.getElementById(modalId);
    if (m) {
        m.style.setProperty('display', 'flex', 'important');
        m.style.setProperty('z-index', '99999', 'important');
    }

    if (modalId === 'modalPengguna' || modalId === 'modalUser') {
        setTimeout(() => {
            try {
                if (typeof window.resetFormUser === 'function') window.resetFormUser();
                if (typeof window.loadUserTable === 'function') window.loadUserTable();
            } catch (err) {
                console.warn('[openModal] Gagal memuat tabel pengguna:', err);
            }
        }, 50);
    }

    if (modalId === 'modalLaporanChat') {
        setTimeout(() => {
            try {
                if (typeof window.loadLaporanChatData === 'function') window.loadLaporanChatData();
            } catch (err) {
                console.warn('[openModal] Gagal memuat aduan investigasi:', err);
            }
        }, 50);
    }
};

window.closeModal = function (modalId) {
    const m = document.getElementById(modalId);
    if (m) {
        m.style.setProperty('display', 'none', 'important');
    }
};

window.bukaModalPengguna = function () {
    window.openModal('modalPengguna');
};

window.bukaModalLaporanChat = function () {
    window.openModal('modalLaporanChat');
};

// =========================================================================
// 2. VARIABEL GLOBAL LINGKUNGAN SISTEM
// =========================================================================
if (typeof window.BASE_URL === 'undefined') {
    window.BASE_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
        ? window.CONFIG.BASE_URL.replace(/\/+$/, '')
        : window.location.origin.replace(/\/+$/, '');
}
if (typeof window.BASE_API_URL === 'undefined') {
    window.BASE_API_URL = window.BASE_URL;
}

window.MAP_CENTER_SIDOARJO = [-7.4478, 112.7183];
window.globalDataWarga = window.globalDataWarga || [];
var globalDataWarga = window.globalDataWarga;
window.allLaporanChatData = window.allLaporanChatData || [];
window.currentFilter = 'all';
window.currentSort = 'terbaru';
window.sortNikAsc = false;
window.sortAzAsc = false;
window.stagedImportData = [];
window.isNotifUpdating = false;

// =========================================================================
// 3. INJEKSI GAYA DINAMIS CSS (BADGES, TABLES & BULK BAR)
// =========================================================================
(function injectDynamicAdminStyles() {
    const dtStyleId = 'admin-dynamic-injected-css';
    if (document.getElementById(dtStyleId)) return;

    const dtStyle = document.createElement('style');
    dtStyle.id = dtStyleId;
    dtStyle.innerHTML = `
        .dataTables_length { margin-bottom: 15px; margin-top: 5px; font-weight: 600; color: #64748b; font-size: 0.88rem; }
        .dataTables_length select { padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; margin: 0 8px; cursor: pointer; background: #ffffff; }
        .dataTables_filter { margin-bottom: 15px; margin-top: 5px; }
        .dataTables_filter input { padding: 8px 16px; border-radius: 20px; border: 1.5px solid #cbd5e1; outline: none; margin-left: 8px; width: 260px; background: #ffffff; font-family: 'Inter', sans-serif; font-size: 0.88rem; transition: border-color 0.2s ease; }
        .dataTables_filter input:focus { border-color: #009846; }
        .badge-green { background: #e6f9f0; color: #15803d; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem; border: 1px solid #bbf7d0; }
        .badge-blue { background: #e0f2fe; color: #1d4ed8; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem; border: 1px solid #bae6fd; }
        .badge-red { background: #fee2e2; color: #dc2626; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem; border: 1px solid #fecaca; }
        .badge-warning { background: #fef3c7; color: #b45309; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem; border: 1px solid #fde68a; }
        .filter-btn.active { background: #10b981 !important; color: #ffffff !important; font-weight: 700; border-color: #059669 !important; }
        .filter-btn-danger.active { background: #ef4444 !important; color: #ffffff !important; font-weight: 700; border-color: #dc2626 !important; }
        .fab-bulk { position: fixed; bottom: 25px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #ffffff; padding: 10px 24px; border-radius: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); z-index: 1000; display: none; align-items: center; gap: 15px; border: 1px solid rgba(255,255,255,0.15); animation: slideUpFab 0.3s ease; }
        .fab-text { font-size: 0.92rem; font-weight: 700; }
        @keyframes slideUpFab { from { transform: translate(-50%, 60px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .swal-modern-loading-card .swal2-close { display: none !important; }
        .swal-modern-loading-card .swal2-loader, .swal2-loading .swal2-loader { display: none !important; visibility: hidden !important; width: 0 !important; height: 0 !important; margin: 0 !important; padding: 0 !important; opacity: 0 !important; }
        .swal-modern-loading-card .swal2-actions { display: flex !important; justify-content: center !important; margin: 18px auto 2px auto !important; width: 100% !important; gap: 0 !important; }
    `;
    document.head.appendChild(dtStyle);
})();

// =========================================================================
// 4. VEKTOR BOBOT 10 KRITERIA BWM (SESUAI LAPORAN SKRIPSI RESMI)
// =========================================================================
window.defaultBobotBWM = {
    c1: 0.22, // Kondisi Ekonomi / Penghasilan (Cost)
    c2: 0.15, // Kepemilikan Aset (Cost)
    c3: 0.08, // Umur Kepala Keluarga (Benefit)
    c4: 0.05, // Jenis Kelamin (Benefit)
    c5: 0.18, // Jumlah Tanggungan (Benefit)
    c6: 0.06, // Status Pernikahan (Benefit)
    c7: 0.08, // Kepemilikan Anak / Balita (Benefit)
    c8: 0.10, // Kelayakan Tempat Tinggal (Cost)
    c9: 0.04, // Tingkat Pendidikan Terakhir (Cost)
    c10: 0.04 // Kondisi Kesehatan / Disabilitas (Cost)
};

let dtTable = null;
let chartDesilObj = null;
let chartPersetujuanObj = null;
let chartPenyaluranObj = null;
let chartSengketaObj = null;
let compChartObj = null;
let formMap = null;
let formMarker = null;
let macroMapObj = null;
let macroGeoJsonLayer = null;

let user = null;
try {
    const rawUser = localStorage.getItem('user') || 
                    localStorage.getItem('bansos_user_data') || 
                    localStorage.getItem('bansosUser') || 
                    localStorage.getItem('userData');
    if (rawUser) {
        user = JSON.parse(rawUser);
        if (typeof user === 'string') {
            user = { username: user, role: localStorage.getItem('role') || localStorage.getItem('user_role') || 'admin' };
        }
    }
} catch (e) {
    user = { 
        username: localStorage.getItem('username') || 'ADMIN', 
        role: localStorage.getItem('role') || localStorage.getItem('user_role') || 'admin' 
    };
}

// =========================================================================
// 5. HELPER UTILITAS, SANITASI & TOKEN
// =========================================================================
window.safeHtml = function (str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

window.escapeInlineJS = function (str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
};

function showAdminAlert(options = {}) {
    if (typeof Swal !== 'undefined') {
        const isLoader = (
            options.isLoading || 
            options.showLoading || 
            (options.didOpen && options.didOpen.toString().includes('showLoading'))
        );

        if (isLoader) {
            // Gunakan engine animasi modern terpadu: tanpa tombol OK, satu tombol Batalkan di bawah, tanpa tombol silang di kanan atas
            if (typeof window.showModernLoadingAlert === 'function') {
                const handle = window.showModernLoadingAlert({
                    ...options,
                    showConfirmButton: false,
                    showCancelButton: options.showCancelButton !== undefined ? options.showCancelButton : true,
                    showCloseButton: false
                });
                return handle.swalPromise;
            }
        }

        const defaultClass = {
            popup: 'swal-modern-rounded',
            confirmButton: 'swal-btn-pill-primary',
            cancelButton: 'swal-btn-pill-cancel',
            denyButton: 'swal-btn-pill-danger',
            loader: 'swal-modern-loader'
        };
        const mergedOptions = {
            buttonsStyling: false,
            ...options,
            customClass: {
                ...defaultClass,
                ...(options.customClass || {})
            }
        };
        return Swal.fire(mergedOptions);
    }
    alert(options.text || options.title || 'Pemberitahuan Sistem');
    return Promise.resolve({ isConfirmed: true, value: true });
}
window.showAdminAlert = showAdminAlert;

window.getCleanToken = function () {
    const raw = localStorage.getItem('token') || 
                localStorage.getItem('access_token') || 
                localStorage.getItem('bansos_jwt_token') || 
                localStorage.getItem('bansosToken') || '';
    if (!raw || raw === 'undefined' || raw === 'null') return '';
    return raw.replace(/^["']+|["']+$/g, '').trim();
};

// =========================================================================
// 6. SIKLUS HIDUP DOM & INISIALISASI DASBOR
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const formBansos = document.getElementById('bansosForm');
    if (formBansos) {
        formBansos.onsubmit = function (e) {
            e.preventDefault();
            window.tambahData(e);
            return false;
        };
    }

    document.querySelectorAll('form').forEach(f => {
        f.addEventListener('submit', (e) => e.preventDefault());
    });

    let cleanRole = (
        localStorage.getItem('role') || 
        localStorage.getItem('user_role') || 
        localStorage.getItem('bansos_user_role') || 
        user?.role || 
        'petugas'
    ).toLowerCase().replace(/[\s-]/g, '_');
    if (cleanRole === 'operator') cleanRole = 'petugas';
    if (cleanRole === 'superadmin') cleanRole = 'super_admin';

    const nameEl = document.getElementById('navUsername');
    const roleEl = document.getElementById('navRoleBadge');
    const cmdEl = document.getElementById('adminCommandCenter');
    const currentUsername = localStorage.getItem('username') || user?.username || 'ADMIN';

    if (nameEl) nameEl.innerText = currentUsername.toUpperCase();

    const isSuperAdmin = (cleanRole === 'super_admin' || cleanRole === 'developer');
    const isAdmin = (cleanRole === 'admin' || isSuperAdmin);

    if (roleEl) {
        if (isSuperAdmin) {
            roleEl.className = 'role-badge';
            roleEl.style.cssText = 'background:#fef2f2; color:#b91c1c; border:1px solid #fca5a5; font-weight:800; padding:4px 12px; border-radius:12px; font-size:0.75rem;';
            roleEl.innerHTML = '<i class="fas fa-shield-alt"></i> Super Admin';
        } else if (cleanRole === 'admin') {
            roleEl.className = 'role-badge';
            roleEl.style.cssText = 'background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe; font-weight:800; padding:4px 12px; border-radius:12px; font-size:0.75rem;';
            roleEl.innerHTML = '<i class="fas fa-user-tie"></i> Admin Bansos';
        } else {
            roleEl.className = 'role-badge';
            roleEl.style.cssText = 'background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:800; padding:4px 12px; border-radius:12px; font-size:0.75rem;';
            roleEl.innerHTML = '<i class="fas fa-user-edit"></i> Petugas Lapangan';
        }
    }

    // Hak Akses Cyber Shield: HANYA untuk Super Admin / Developer
    const navCyberBtn = document.getElementById('btnNavCyberShield');
    if (navCyberBtn) {
        navCyberBtn.style.display = isSuperAdmin ? 'inline-flex' : 'none';
    }
    const tileCyber = document.getElementById('tileCyberShield');
    if (tileCyber) {
        tileCyber.style.display = isSuperAdmin ? 'block' : 'none';
    }

    if (cmdEl) {
        cmdEl.style.display = isAdmin ? 'block' : 'none';
    }

    const btnPengguna = document.querySelector('.cmd-tile-item.tile-purple') || 
                        document.querySelector('[onclick*="modalPengguna"]') || 
                        document.querySelector('[onclick*="bukaModalPengguna"]');
    if (btnPengguna) {
        btnPengguna.onclick = (e) => {
            e.preventDefault();
            window.bukaModalPengguna();
        };
    }

    const btnInvestigasi = document.querySelector('.cmd-tile-item.tile-rose') || 
                           document.querySelector('[onclick*="modalLaporanChat"]') || 
                           document.querySelector('[onclick*="bukaModalLaporanChat"]');
    if (btnInvestigasi) {
        btnInvestigasi.onclick = (e) => {
            e.preventDefault();
            window.bukaModalLaporanChat();
        };
    }

    await window.loadDashboardData();

    setTimeout(() => {
        window.initFormMapPicker();
        window.initMacroDistributionMap();
    }, 350);

    window.cekNotifikasiRealtime();
    setInterval(window.cekNotifikasiRealtime, 6000);
});

// =========================================================================

// =========================================================================
// DELEGATOR RESMI MODUL CETAK & CHAT WARGA
// =========================================================================

// 23. CETAK DOKUMEN RESMI SK BUPATI & LAPORAN
// =========================================================================
window.cetakSKBupati = function () {
    if (window.AdminPrint && typeof window.AdminPrint.cetakSKBupati === 'function') {
        return window.AdminPrint.cetakSKBupati();
    }

    const data = (window.cachedHasilSPK || []).filter(w => (w.desil || 5) <= 4);
    if (!data.length) {
        return Swal.fire('Perhatian', 'Jalankan Proses Algoritma SAW terlebih dahulu untuk menghasilkan daftar penetapan.', 'warning');
    }

    const printWin = window.open('', '_blank');
    if (!printWin) return alert('Izinkan pop-up untuk mencetak dokumen SK.');

    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>SURAT KEPUTUSAN BUPATI SIDOARJO</title>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 40px 60px; color: #000; line-height: 1.5; font-size: 12pt; }
                .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 24px; }
                .kop h2 { margin: 0; font-size: 16pt; font-weight: bold; }
                .kop h1 { margin: 0; font-size: 18pt; font-weight: bold; letter-spacing: 1px; }
                .kop p { margin: 2px 0 0 0; font-size: 10pt; }
                .judul { text-align: center; margin-bottom: 25px; }
                .judul h3 { margin: 0; text-decoration: underline; font-size: 13pt; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11pt; }
                th, td { border: 1px solid #000; padding: 6px 10px; text-align: left; }
                th { background: #f2f2f2; text-align: center; }
                .ttd-box { float: right; width: 280px; text-align: center; margin-top: 40px; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="kop">
                <h2>PEMERINTAH KABUPATEN SIDOARJO</h2>
                <h1>DINAS SOSIAL</h1>
                <p>Jl. Pahlawan No. 56 Sidoarjo, Jawa Timur | Telp: (031) 8921234</p>
            </div>
            <div class="judul">
                <h3>KEPUTUSAN BUPATI SIDOARJO</h3>
                <p>NOMOR: 188/BANSOS-SPK/${new Date().getFullYear()}<br>TENTANG<br>PENETAPAN DAFTAR PENERIMA BANTUAN SOSIAL KABUPATEN SIDOARJO</p>
            </div>
            <p>Menetapkan warga terverifikasi dan memenuhi kriteria kelayakan berbasis sistem pendukung keputusan metode BWM-SAW (Desil 1–4) sebagai berikut:</p>
            <table>
                <thead>
                    <tr>
                        <th style="width:40px;">No</th>
                        <th>Nomor NIK</th>
                        <th>Nama Penerima</th>
                        <th>Alamat Lengkap</th>
                        <th style="width:80px;">Desil</th>
                        <th>Skor SAW</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((d, i) => `
                        <tr>
                            <td style="text-align:center;">${i + 1}</td>
                            <td>${d.nik}</td>
                            <td><b>${d.nama}</b></td>
                            <td>${d.alamat}</td>
                            <td style="text-align:center;">Desil ${d.desil}</td>
                            <td style="text-align:center;">${d.skorSaw}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="ttd-box">
                <p>Ditetapkan di Sidoarjo<br>Pada tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br><br><b>BUPATI SIDOARJO</b><br><br><br><br><b>( _________________________ )</b></p>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
};

window.cetakLaporanKomparasi = function () {
    if (window.AdminPrint && typeof window.AdminPrint.cetakLaporanKomparasi === 'function') {
        return window.AdminPrint.cetakLaporanKomparasi();
    }
    window.print();
};

// =========================================================================

// 25. PENGAMAN GLOBAL TOMBOL CHAT WARGA
// =========================================================================
window.openAdminChat = function (nik = null, nama = null) {
    const modalChat = document.getElementById('modalAdminChat') || 
                      document.getElementById('modalChat') || 
                      document.getElementById('modalLaporanChat');
    if (modalChat) {
        modalChat.style.setProperty('display', 'flex', 'important');
        modalChat.style.setProperty('z-index', '99999', 'important');
    }

    if (typeof window.loadChatList === 'function') {
        window.loadChatList();
    } else if (typeof window.loadChatInbox === 'function') {
        window.loadChatInbox();
    }

    if (nik) {
        if (typeof window.loadChatMessages === 'function') {
            window.loadChatMessages(nik, nama);
        }
    } else {
        if (typeof window.tutupObrolanAktif === 'function') {
            window.tutupObrolanAktif();
        }
    }
};

// =========================================================================
// DELEGATOR MODUL CETAK & CHAT WARGA
// =========================================================================
// 23. CETAK DOKUMEN RESMI SK BUPATI & LAPORAN
// =========================================================================
window.cetakSKBupati = function () {
    if (window.AdminPrint && typeof window.AdminPrint.cetakSKBupati === 'function') {
        return window.AdminPrint.cetakSKBupati();
    }

    const data = (window.cachedHasilSPK || []).filter(w => (w.desil || 5) <= 4);
    if (!data.length) {
        return Swal.fire('Perhatian', 'Jalankan Proses Algoritma SAW terlebih dahulu untuk menghasilkan daftar penetapan.', 'warning');
    }

    const printWin = window.open('', '_blank');
    if (!printWin) return alert('Izinkan pop-up untuk mencetak dokumen SK.');

    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>SURAT KEPUTUSAN BUPATI SIDOARJO</title>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 40px 60px; color: #000; line-height: 1.5; font-size: 12pt; }
                .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 24px; }
                .kop h2 { margin: 0; font-size: 16pt; font-weight: bold; }
                .kop h1 { margin: 0; font-size: 18pt; font-weight: bold; letter-spacing: 1px; }
                .kop p { margin: 2px 0 0 0; font-size: 10pt; }
                .judul { text-align: center; margin-bottom: 25px; }
                .judul h3 { margin: 0; text-decoration: underline; font-size: 13pt; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11pt; }
                th, td { border: 1px solid #000; padding: 6px 10px; text-align: left; }
                th { background: #f2f2f2; text-align: center; }
                .ttd-box { float: right; width: 280px; text-align: center; margin-top: 40px; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="kop">
                <h2>PEMERINTAH KABUPATEN SIDOARJO</h2>
                <h1>DINAS SOSIAL</h1>
                <p>Jl. Pahlawan No. 56 Sidoarjo, Jawa Timur | Telp: (031) 8921234</p>
            </div>
            <div class="judul">
                <h3>KEPUTUSAN BUPATI SIDOARJO</h3>
                <p>NOMOR: 188/BANSOS-SPK/${new Date().getFullYear()}<br>TENTANG<br>PENETAPAN DAFTAR PENERIMA BANTUAN SOSIAL KABUPATEN SIDOARJO</p>
            </div>
            <p>Menetapkan warga terverifikasi dan memenuhi kriteria kelayakan berbasis sistem pendukung keputusan metode BWM-SAW (Desil 1–4) sebagai berikut:</p>
            <table>
                <thead>
                    <tr>
                        <th style="width:40px;">No</th>
                        <th>Nomor NIK</th>
                        <th>Nama Penerima</th>
                        <th>Alamat Lengkap</th>
                        <th style="width:80px;">Desil</th>
                        <th>Skor SAW</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((d, i) => `
                        <tr>
                            <td style="text-align:center;">${i + 1}</td>
                            <td>${d.nik}</td>
                            <td><b>${d.nama}</b></td>
                            <td>${d.alamat}</td>
                            <td style="text-align:center;">Desil ${d.desil}</td>
                            <td style="text-align:center;">${d.skorSaw}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="ttd-box">
                <p>Ditetapkan di Sidoarjo<br>Pada tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br><br><b>BUPATI SIDOARJO</b><br><br><br><br><b>( _________________________ )</b></p>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
};

window.cetakLaporanKomparasi = function () {
    if (window.AdminPrint && typeof window.AdminPrint.cetakLaporanKomparasi === 'function') {
        return window.AdminPrint.cetakLaporanKomparasi();
    }
    window.print();
};

// =========================================================================


// 25. PENGAMAN GLOBAL TOMBOL CHAT WARGA
// =========================================================================
window.openAdminChat = function () {
    const modalChat = document.getElementById('modalAdminChat') || 
                      document.getElementById('modalChat') || 
                      document.getElementById('modalLaporanChat');
    if (modalChat) {
        modalChat.style.setProperty('display', 'flex', 'important');
        modalChat.style.setProperty('z-index', '99999', 'important');
    }

    try {
        if (typeof window.tutupObrolanAktif === 'function') {
            window.tutupObrolanAktif();
        }
    } catch (e) {
        console.warn('[openAdminChat] Peringatan penutupan obrolan:', e);
    }

    try {
        if (typeof window.loadChatInbox === 'function') {
            window.loadChatInbox();
        }
    } catch (e) {}
};
