/**
 * Modul: admin-sync-db.js
 * Deskripsi: Pencadangan, pemulihan arsip snapshot JSON, dan integrasi MySQL localhost
 */

// 22. CADANGKAN & PULIHKAN ARSIP (SINKRON DATA ARSIP MODERN & MEMBULAT)
// =========================================================================
window.bukaModalSinkronArsip = function () {
    const modal = document.getElementById('modalSinkronArsip');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

window.eksekusiCadangkanKeServer = async function () {
    showAdminAlert({
        title: 'Mencadangkan Data ke Server...',
        text: 'Mengamankan snapshot seluruh arsip warga aktif...',
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        let res = await fetch(`${base}/api/arsip/cadangkan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ data: window.globalDataWarga || [] })
        });

        if (!res.ok) {
            res = await fetch(`${base}/arsip/cadangkan`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data: window.globalDataWarga || [] })
            });
        }

        const json = await res.json().catch(() => ({}));
        
        // Simpan salinan ke localStorage browser juga
        try {
            localStorage.setItem('cadangan_arsip_lokal_terakhir', JSON.stringify({
                waktu: new Date().toISOString(),
                total: (window.globalDataWarga || []).length,
                data: window.globalDataWarga || []
            }));
        } catch (_) {}

        Swal.fire({
            icon: 'success',
            title: 'Cadangan Server Tersimpan!',
            text: json.message || `Berhasil mengamankan ${(window.globalDataWarga || []).length} data warga ke memori server master.`,
            buttonsStyling: false,
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
        });
    } catch (e) {
        showAdminAlert({ icon: 'error', title: 'Gagal Mencadangkan', text: e.message || 'Kendala koneksi ke server.' });
    }
};

window.eksekusiUnduhCadanganJson = function () {
    const dataList = window.globalDataWarga || [];
    if (!dataList.length) {
        return showAdminAlert({ icon: 'warning', title: 'Data Masih Kosong', text: 'Tidak ada data warga untuk dicadangkan saat ini.' });
    }

    try {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
        
        const backupPayload = {
            sumber: "Sistem Pendukung Keputusan Bansos Pemkab Sidoarjo",
            versi_sistem: "2.5.0",
            tanggal_arsip: now.toISOString(),
            waktu_format: `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
            total_warga: dataList.length,
            data_warga: dataList,
            kriteria: window.cachedKriteria || []
        };

        const jsonStr = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `cadangan_arsip_bansos_sidoarjo_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        showAdminAlert({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Berkas cadangan JSON (${dataList.length} warga) berhasil diunduh!`,
            showConfirmButton: false,
            timer: 2500
        });
    } catch (err) {
        showAdminAlert({ icon: 'error', title: 'Gagal Mengunduh', text: err.message });
    }
};

window.eksekusiPulihkanDariServer = async function () {
    showAdminAlert({
        title: 'Memulihkan dari Server Master...',
        text: 'Mengembalikan snapshot data kependudukan...',
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        let res = await fetch(`${base}/api/arsip/pulihkan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            }
        });

        if (!res.ok) {
            res = await fetch(`${base}/arsip/pulihkan`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
            });
        }

        const json = await res.json().catch(() => ({}));
        if (json.data && Array.isArray(json.data)) {
            window.globalDataWarga = json.data;
        }

        window.closeModal('modalSinkronArsip');
        await window.loadDashboardData(true);

        Swal.fire({
            icon: 'success',
            title: 'Berhasil Dipulihkan!',
            text: json.message || 'Data kependudukan berhasil dikembalikan dari arsip server.',
            buttonsStyling: false,
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
        });
    } catch (e) {
        showAdminAlert({ icon: 'error', title: 'Gagal Memulihkan', text: e.message || 'Kendala saat memulihkan arsip.' });
    }
};

window.eksekusiPulihkanDariFileJson = function (input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();

    showAdminAlert({
        title: 'Membaca Berkas Cadangan...',
        text: `Memvalidasi integritas data dari ${file.name}...`,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    reader.onload = async function (e) {
        try {
            const content = e.target.result;
            const parsed = JSON.parse(content);
            const restoreList = Array.isArray(parsed) ? parsed : (parsed.data_warga || parsed.data || []);

            if (!restoreList.length) {
                throw new Error('Berkas JSON tidak memuat array data kependudukan yang sah.');
            }

            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            let res = await fetch(`${base}/api/arsip/pulihkan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ data: restoreList })
            });

            if (!res.ok) {
                res = await fetch(`${base}/api/warga/bulk`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.getCleanToken()}`
                    },
                    body: JSON.stringify({ data: restoreList, overwrite: true })
                });
            }

            window.closeModal('modalSinkronArsip');
            await window.loadDashboardData(true);

            Swal.fire({
                icon: 'success',
                title: 'Pemulihan Berkas Berhasil!',
                text: `Sebanyak ${restoreList.length} data warga dari ${file.name} berhasil dipulihkan ke arsip.`,
                buttonsStyling: false,
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
            });
        } catch (err) {
            showAdminAlert({
                icon: 'error',
                title: 'Gagal Memulihkan File Cadangan',
                text: err.message || 'Format berkas cadangan JSON tidak valid atau rusak.'
            });
        } finally {
            input.value = '';
        }
    };

    reader.onerror = () => {
        showAdminAlert({ icon: 'error', title: 'Gagal Membaca File', text: 'Tidak dapat membuka berkas cadangan dari perangkat.' });
    };

    reader.readAsText(file);
};

window.eksekusiResetMasterWarga = async function () {
    const k = await Swal.fire({
        title: 'Kembalikan ke Data Master Awal?',
        text: 'Sistem akan memuat ulang 12 data warga binaan awal resmi Dinas Sosial Kabupaten Sidoarjo.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Pulihkan Data Awal',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        showAdminAlert({
            title: 'Mereset Data Master...',
            customClass: { popup: 'swal-modern-rounded' },
            didOpen: () => Swal?.showLoading()
        });

        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            let res = await fetch(`${base}/api/arsip/reset-master`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                }
            });

            if (!res.ok) {
                res = await fetch(`${base}/arsip/reset-master`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
                });
            }

            const json = await res.json().catch(() => ({}));
            window.closeModal('modalSinkronArsip');
            await window.loadDashboardData(true);

            Swal.fire({
                icon: 'success',
                title: 'Data Master Aktif!',
                text: json.message || 'Sebanyak 12 data warga awal Kabupaten Sidoarjo berhasil dipulihkan.',
                buttonsStyling: false,
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
            });
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal Reset', text: err.message || 'Kendala saat mereset data.' });
        }
    }
};

window.eksekusiCadangkanArsip = () => window.eksekusiCadangkanKeServer();
window.eksekusiPulihkanArsip = () => window.eksekusiPulihkanDariServer();

// =========================================================================
// PENGHAPUSAN DATA ARSIP DARI MODAL SINKRONISASI (MODERN & MEMBULAT)
// =========================================================================
window.eksekusiHapusSemuaArsipDariModalSync = async function () {
    const k = await Swal.fire({
        title: 'Kosongkan Seluruh Data Arsip?',
        text: 'Seluruh data warga kependudukan yang tersimpan dalam arsip akan dihapus secara total dari sistem.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus Semua Arsip',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        showAdminAlert({
            title: 'Menghapus Seluruh Arsip...',
            text: 'Membersihkan data dari database peladen...',
            customClass: { popup: 'swal-modern-rounded' },
            didOpen: () => Swal?.showLoading()
        });

        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            let res = await fetch(`${base}/api/warga/delete-all`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                }
            });

            if (!res.ok) {
                res = await fetch(`${base}/warga/delete-all`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
                });
            }

            // Bersihkan data state di browser
            window.globalDataWarga = [];
            window.cachedWarga = [];
            localStorage.removeItem('bansos_warga_cache');
            localStorage.removeItem('bansos_data_warga');

            if (window.$ && $.fn && $.fn.DataTable && $.fn.DataTable.isDataTable('#dataTable')) {
                $('#dataTable').DataTable().clear().draw();
            } else {
                const tbody = document.querySelector('#dataTable tbody');
                if (tbody) tbody.innerHTML = '';
            }

            if (window.clusterWargaGroup && typeof window.clusterWargaGroup.clearLayers === 'function') {
                window.clusterWargaGroup.clearLayers();
            }

            if (typeof window.updateStatsAndCards === 'function') {
                window.updateStatsAndCards(0, 0, 0, 0, false);
            }

            if (typeof window.render3DashboardCharts === 'function') {
                try { window.render3DashboardCharts([]); } catch (_) {}
            }

            window.closeModal('modalSinkronArsip');

            Swal.fire({
                icon: 'success',
                title: 'Data Arsip Telah Dihapus!',
                text: 'Seluruh arsip data kependudukan telah berhasil dibersihkan dari sistem secara aman.',
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menghapus Arsip',
                text: err.message || 'Terjadi gangguan saat mengosongkan arsip data warga.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    }
};

window.eksekusiHapusCadanganServer = async function () {
    const k = await Swal.fire({
        title: 'Hapus Snapshot Cadangan Server?',
        text: 'Berkas cadangan riwayat snapshot yang tersimpan di peladen akan dibersihkan.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus Snapshot',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        showAdminAlert({
            title: 'Menghapus Snapshot...',
            customClass: { popup: 'swal-modern-rounded' },
            didOpen: () => Swal?.showLoading()
        });

        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            let res = await fetch(`${base}/api/arsip/cadangan`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                }
            });

            if (!res.ok) {
                res = await fetch(`${base}/arsip/cadangan`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
                });
            }

            try { localStorage.removeItem('cadangan_arsip_lokal_terakhir'); } catch (_) {}
            window.closeModal('modalSinkronArsip');

            Swal.fire({
                icon: 'success',
                title: 'Snapshot Arsip Berhasil Dihapus',
                text: 'Seluruh berkas cadangan snapshot di server telah dibersihkan.',
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menghapus Snapshot',
                text: err.message || 'Kendala koneksi ke server saat membersihkan cadangan.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    }
};

// =========================================================================
// PENYIMPANAN BASIS DATA MYSQL LOCALHOST (INTEGRASI PENUH SELURUH SISTEM)
// =========================================================================
window.bukaModalSettingMysql = async function () {
    const modal = document.getElementById('modalSettingMysql');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/config`, {
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (res.ok) {
            const json = await res.json();
            const cfg = json.config || {};
            if (document.getElementById('mysqlHost')) document.getElementById('mysqlHost').value = cfg.host || 'localhost';
            if (document.getElementById('mysqlPort')) document.getElementById('mysqlPort').value = cfg.port || 3306;
            if (document.getElementById('mysqlUser')) document.getElementById('mysqlUser').value = cfg.user || 'root';
            if (document.getElementById('mysqlPassword')) document.getElementById('mysqlPassword').value = cfg.password || '';
            if (document.getElementById('mysqlDatabase')) document.getElementById('mysqlDatabase').value = cfg.database || 'db_bansos_sidoarjo';
            if (document.getElementById('mysqlEnableToggle')) document.getElementById('mysqlEnableToggle').checked = !!cfg.enabled;
            
            const track = document.getElementById('mysqlToggleTrack');
            if (track) track.style.background = cfg.enabled ? '#16a34a' : '#cbd5e1';
        }
    } catch (_) {}

    window.cekStatusKoneksiMysql();
};

window.cekStatusKoneksiMysql = async function () {
    const statusText = document.getElementById('mysqlConnectionStatusText');
    const badge = document.getElementById('mysqlConnectionBadge');

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/status`, {
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.connected) {
                if (statusText) statusText.innerHTML = `<span style="color:#15803d;"><i class="fas fa-check-circle"></i> Terhubung ke MySQL Localhost (v${data.version || '8.x'}) &bull; DB: <b>${data.database}</b></span>`;
                if (badge) {
                    badge.className = 'mysql-status-badge connected';
                    badge.innerHTML = '<i class="fas fa-link"></i> Terhubung';
                }
                return true;
            } else {
                if (statusText) statusText.innerHTML = `<span style="color:#64748b;"><i class="fas fa-info-circle"></i> Belum Terhubung: ${window.safeHtml(data.message || 'Siap dikonfigurasikan')}</span>`;
                if (badge) {
                    badge.className = 'mysql-status-badge disconnected';
                    badge.innerHTML = '<i class="fas fa-unlink"></i> Standby';
                }
                return false;
            }
        }
    } catch (_) {
        if (statusText) statusText.innerText = 'Server proxy lokal aktif (Gunakan tombol Uji Koneksi)';
    }
    return false;
};

window.simpanConfigMysql = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const host = document.getElementById('mysqlHost')?.value.trim() || 'localhost';
    const port = parseInt(document.getElementById('mysqlPort')?.value) || 3306;
    const user = document.getElementById('mysqlUser')?.value.trim() || 'root';
    const password = document.getElementById('mysqlPassword')?.value || '';
    const database = document.getElementById('mysqlDatabase')?.value.trim() || 'db_bansos_sidoarjo';
    const enabled = document.getElementById('mysqlEnableToggle')?.checked || false;

    const payload = { host, port, user, password, database, enabled };

    showAdminAlert({
        title: 'Menyimpan Pengaturan MySQL...',
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json().catch(() => ({}));

        await window.cekStatusKoneksiMysql();

        Swal.fire({
            icon: 'success',
            title: 'Konfigurasi Tersimpan!',
            text: json.message || 'Pengaturan koneksi MySQL localhost berhasil disimpan.',
            buttonsStyling: false,
            confirmButtonText: 'Oke, Mengerti',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menyimpan',
            text: err.message || 'Kendala saat menyimpan konfigurasi MySQL.',
            buttonsStyling: false,
            confirmButtonText: 'Oke',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    }
};

window.ujiKoneksiMysql = async function () {
    const host = document.getElementById('mysqlHost')?.value.trim() || 'localhost';
    const port = parseInt(document.getElementById('mysqlPort')?.value) || 3306;
    const user = document.getElementById('mysqlUser')?.value.trim() || 'root';
    const password = document.getElementById('mysqlPassword')?.value || '';
    const database = document.getElementById('mysqlDatabase')?.value.trim() || 'db_bansos_sidoarjo';

    showAdminAlert({
        title: 'Menguji Koneksi MySQL Localhost...',
        text: `Menghubungkan ke ${host}:${port} (${user})...`,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({ host, port, user, password, database })
        });

        const json = await res.json().catch(() => ({}));

        if (json.success) {
            await window.cekStatusKoneksiMysql();
            Swal.fire({
                icon: 'success',
                title: 'Koneksi MySQL Sukses!',
                html: `Berhasil terhubung ke server MySQL Localhost.<br><br><b>Versi:</b> ${json.version || 'MySQL'}<br><b>Database '${database}':</b> ${json.databaseExists ? '<span style="color:#15803d;">Sudah Ada</span>' : '<span style="color:#d97706;">Belum Ada (Dapat dibuat di Langkah 2)</span>'}`,
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Koneksi Belum Terhubung',
                text: json.message || 'Pastikan MySQL (XAMPP / Laragon / MySQL Service) telah berjalan di komputer Anda.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menguji Koneksi',
            text: err.message || 'Kendala koneksi ke server lokal.',
            buttonsStyling: false,
            confirmButtonText: 'Oke',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    }
};

window.migrasiTabelMysql = async function () {
    showAdminAlert({
        title: 'Membuat Database & Tabel...',
        text: 'Menginisialisasi skema tabel kependudukan, kriteria SPK, dan log di MySQL...',
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/migrate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            }
        });

        const json = await res.json().catch(() => ({}));

        if (json.success) {
            await window.cekStatusKoneksiMysql();
            Swal.fire({
                icon: 'success',
                title: 'Tabel MySQL Siap!',
                html: `${json.message || 'Struktur tabel berhasil dibuat.'}<br><br><b>Tabel Terdaftar:</b> ${(json.tables || []).join(', ')}`,
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Membuat Tabel',
                text: json.message || 'Pastikan kredensial user MySQL memiliki izin CREATE TABLE.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Kendala Migrasi',
            text: err.message || 'Terjadi kesalahan komunikasi dengan server MySQL.',
            buttonsStyling: false,
            confirmButtonText: 'Oke',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    }
};

window.simpanKeMysql = async function () {
    const dataList = window.globalDataWarga || [];
    showAdminAlert({
        title: 'Menyimpan Data ke MySQL...',
        text: `Menyinkronkan ${dataList.length} data warga kependudukan ke database localhost...`,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/sync-to-mysql`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            }
        });

        const json = await res.json().catch(() => ({}));

        if (json.success) {
            Swal.fire({
                icon: 'success',
                title: 'Data Tersimpan di MySQL Localhost!',
                html: `Seluruh data sistem berhasil disimpan ke basis data MySQL Anda:<br><br><b>Data Warga Tersimpan:</b> ${json.syncedWarga || dataList.length} baris<br><b>Kriteria SPK:</b> ${json.syncedKriteria || 10} kriteria`,
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Gagal Menyimpan ke MySQL',
                text: json.message || 'Pastikan MySQL terhubung dan Anda telah menjalankan tombol "Buat Database & Tabel".',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Kendala Ekspor MySQL',
            text: err.message || 'Tidak dapat mengirimkan data ke database MySQL.',
            buttonsStyling: false,
            confirmButtonText: 'Oke',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    }
};

window.muatDariMysql = async function () {
    showAdminAlert({
        title: 'Memuat Data dari MySQL...',
        text: 'Mengambil data kependudukan dari database MySQL localhost...',
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/sync-from-mysql`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            }
        });

        const json = await res.json().catch(() => ({}));

        if (json.success) {
            await window.loadDashboardData(true);
            Swal.fire({
                icon: 'success',
                title: 'Data Berhasil Dimuat dari MySQL!',
                text: `Sebanyak ${json.count || 0} data arsip warga dari database MySQL berhasil dimuat ke sistem.`,
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Gagal Memuat dari MySQL',
                text: json.message || 'Database MySQL belum memiliki data warga atau belum terhubung.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Kendala Impor MySQL',
            text: err.message || 'Tidak dapat mengambil data dari database MySQL.',
            buttonsStyling: false,
            confirmButtonText: 'Oke',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    }
};

window.unduhXamppBridgePhp = function () {
    const a = document.createElement('a');
    a.href = '/api/mysql/bridge-script';
    a.download = 'bridge_sync.php';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    Swal.fire({
        icon: 'success',
        title: 'Skrip Jembatan XAMPP Diunduh!',
        html: `
            <div style="font-size:0.86rem; line-height:1.6; text-align:left; color:#1e293b;">
                Berkas <b>bridge_sync.php</b> telah diunduh.<br><br>
                <b>Panduan 3 Langkah Mudah Menghubungkan ke XAMPP Localhost:</b><br>
                1. Salin berkas <code>bridge_sync.php</code> ke folder <code>C:\\xampp\\htdocs\\bansos\\</code>.<br>
                2. Buka XAMPP Control Panel, pastikan <b>Apache</b> dan <b>MySQL</b> statusnya hijau (Running).<br>
                3. Buka browser: <a href="http://localhost/bansos/bridge_sync.php" target="_blank" style="color:#0284c7; font-weight:700;">http://localhost/bansos/bridge_sync.php</a> untuk melihat status sinkronisasi.<br><br>
                <i>Atau cukup unduh file <b>.SQL Lengkap</b> dan impor ke phpMyAdmin dengan 1 klik!</i>
            </div>
        `,
        confirmButtonText: 'Oke, Sangat Mengerti',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
    });
};

// =========================================================================
