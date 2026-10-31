/**
 * Modul: admin-investigasi.js
 * Deskripsi: Pusat Investigasi Terpadu, Mediasi Sengketa, & Penyelesaian Aduan Bansos Warga
 */

// 21. INVESTIGASI & SENGKETA ADUAN
// =========================================================================
window.allLaporanChatData = [];
window.activeInvestigasiFilter = 'all';
window.activePanelWargaFilter = 'all';
window.activeSearchInvestigasiQuery = '';

window.isSelesaiAduan = function (item) {
    if (!item) return false;
    const currentStep = Number(item.status_step) || (item.status === 'Selesai' ? 5 : 2);
    return item.status === 'Selesai' || currentStep === 5 || String(item.status_text || '').toLowerCase().includes('selesai');
};

window.isSystemIssue = function (item) {
    if (!item) return false;
    if (item.is_sistem === true) return true;
    const kat = String(item.kategori || '').toLowerCase();
    if (kat.includes('sistem') || kat.includes('teknis') || kat.includes('error') || kat.includes('eror') || kat.includes('bug')) return true;
    const raw = (String(item.kategori || '') + ' ' + String(item.uraian || '') + ' ' + String(item.deskripsi || '') + ' ' + String(item.isi_laporan || '')).toLowerCase();
    return raw.includes('eror') || raw.includes('error') || raw.includes('sistem') ||
           raw.includes('teknis') || raw.includes('bug') || raw.includes('crash') ||
           raw.includes('glitch') || raw.includes('gagal') || raw.includes('server') ||
           raw.includes('database') || raw.includes('koneksi') || raw.includes('macet') ||
           raw.includes('freeze') || raw.includes('blank') || raw.includes('rusak') ||
           raw.includes('hang');
};

window.isItemUrgent = function (item) {
    if (!item) return false;
    if (window.isSelesaiAduan(item)) return false;
    // KETENTUAN UTAMA: Persoalan sistem eror / masalah teknis otomatis masuk kategori URGENT
    if (window.isSystemIssue(item)) return true;
    if (item.is_urgent === true) return true;
    if (item.urgensi === 'urgent' || item.urgensi === 'kritis' || item.urgensi === 'tinggi') return true;
    if (item.urgensi_eskalasi === 'Kritis' || item.urgensi_eskalasi === 'Tinggi') return true;
    const raw = (String(item.kategori || '') + ' ' + String(item.uraian || '') + ' ' + String(item.deskripsi || '') + ' ' + String(item.isi_laporan || '')).toLowerCase();
    return raw.includes('urgent') || raw.includes('darurat') || raw.includes('mendesak') || raw.includes('kritis');
};

window.isWargaRegistered = function (item) {
    if (!item) return false;
    if (typeof item.is_terdaftar === 'boolean') return item.is_terdaftar;
    const kat = String(item.kategori || '').toLowerCase();
    if (kat.includes('belum terdaftar') || kat.includes('belum terdata') || kat.includes('non-terdaftar') || kat.includes('gagal daftar')) {
        return false;
    }
    const cleanNik = String(item.nik || '').trim();
    if (cleanNik && Array.isArray(window.globalDataWarga) && window.globalDataWarga.length > 0) {
        const found = window.globalDataWarga.some(w => String(w.nik).trim() === cleanNik);
        if (found) return true;
    }
    if (kat.includes('penyaluran') || kat.includes('sengketa') || kat.includes('desil') || kat.includes('bansos sembako')) {
        return true;
    }
    return false;
};

window.bukaModalLaporanChat = function () {
    const modal = document.getElementById('modalLaporanChat');
    if (modal) modal.style.display = 'flex';
    if (typeof window.loadLaporanChatData === 'function') {
        window.loadLaporanChatData();
    }
};

window.loadLaporanChatData = async function () {
    const container = document.getElementById('laporanChatList');
    if (!container) return;
    try {
        const token = window.getCleanToken();
        const headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' };
        const laporanEndpoints = [
            window.BASE_URL + '/api/laporan-chat',
            window.BASE_URL + '/api/chat/laporan',
            window.BASE_URL + '/api/pengaduan',
            window.BASE_URL + '/laporan-chat'
        ];
        let res = null;
        for (const url of laporanEndpoints) {
            try {
                let testRes = await fetch(url, { headers });
                if (testRes.status === 401 || testRes.status === 422) {
                    testRes = await fetch(url, { headers: { 'Accept': 'application/json' } });
                }
                if (testRes && testRes.ok) {
                    res = testRes;
                    break;
                }
            } catch (e) {}
        }
        if (res && res.ok) {
            const resJson = await res.json();
            window.allLaporanChatData = Array.isArray(resJson) ? resJson : (resJson.data || []);
            window.updateInvestigasiKPIMetrics(window.allLaporanChatData);
            window.applyCombinedInvestigasiFilter();
        } else {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8;">Belum ada laporan sengketa atau aduan warga yang masuk.</div>';
        }
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#ef4444;">Gagal mengambil data laporan investigasi.</div>';
    }
};

window.updateInvestigasiKPIMetrics = function (data) {
    if (!Array.isArray(data)) return;
    const total = data.length;
    const selesai = data.filter(x => window.isSelesaiAduan(x)).length;
    const urgent = data.filter(x => window.isItemUrgent(x)).length;
    const sistem = data.filter(x => window.isSystemIssue(x)).length;
    const terdaftar = data.filter(x => window.isWargaRegistered(x)).length;
    const belum = total - terdaftar;
    const proses = total - selesai;

    const elTotal = document.getElementById('kpiInvestigasiTotal');
    const elProses = document.getElementById('kpiInvestigasiProses');
    const elUrgent = document.getElementById('kpiInvestigasiUrgent');
    const elSistem = document.getElementById('kpiInvestigasiSistem');
    const elSelesai = document.getElementById('kpiInvestigasiSelesai');

    const elCountSemua = document.getElementById('countPanelSemuaWarga');
    const elCountTerdaftar = document.getElementById('countPanelWargaTerdaftar');
    const elCountBelum = document.getElementById('countPanelWargaBelum');

    if (elTotal) elTotal.innerText = total;
    if (elProses) elProses.innerText = proses;
    if (elUrgent) elUrgent.innerText = urgent;
    if (elSistem) elSistem.innerText = sistem;
    if (elSelesai) elSelesai.innerText = selesai;

    if (elCountSemua) elCountSemua.innerText = total;
    if (elCountTerdaftar) elCountTerdaftar.innerText = terdaftar;
    if (elCountBelum) elCountBelum.innerText = belum;
};

window.bukaChatDariAduan = function (nik) {
    window.closeModal('modalLaporanChat');
    if (typeof window.openAdminChat === 'function') window.openAdminChat();
    setTimeout(() => {
        const search = document.getElementById('searchChatInput');
        if (search) {
            search.value = nik;
            if (typeof window.filterChatList === 'function') window.filterChatList();
        }
        if (typeof window.selectWargaChat === 'function') {
            window.selectWargaChat(nik);
        } else if (typeof window.loadChatMessages === 'function') {
            window.loadChatMessages(nik);
        }
    }, 300);
};

window.panggilWargaDariAduan = function (nik, type = 'audio') {
    window.closeModal('modalLaporanChat');
    if (typeof window.openAdminChat === 'function') window.openAdminChat();
    setTimeout(() => {
        if (typeof window.loadChatMessages === 'function') window.loadChatMessages(nik);
        setTimeout(() => {
            if (typeof window.startCallWarga === 'function') window.startCallWarga(type);
        }, 400);
    }, 300);
};

window.selesaikanLaporanAduan = async function (id, nik, nama) {
    const { value: catatan } = await Swal.fire({
        title: '<i class="fas fa-check-circle text-success"></i> Selesaikan Laporan Pengaduan',
        html: `
            <div style="text-align:left; font-size:0.88rem; color:#475569; margin-bottom:12px;">
                Anda akan menyelesaikan aduan resmi untuk warga:
                <div style="font-weight:800; color:#0f172a; margin-top:4px;">${window.safeHtml(nama)} (${nik})</div>
                <div style="font-size:0.75rem; color:#dc2626; margin-top:2px;">ID: ${id}</div>
            </div>
        `,
        input: 'textarea',
        inputLabel: 'Catatan Hasil Penyelesaian / Rekomendasi Petugas:',
        inputValue: 'Laporan telah diverifikasi keabsahan datanya oleh petugas Dinsos dan bantuan disalurkan sesuai regulasi.',
        showCancelButton: true,
        confirmButtonText: 'Tandai Laporan Selesai',
        confirmButtonColor: '#009846',
        cancelButtonText: 'Batal'
    });

    if (catatan) {
        try {
            const currentHandler = (localStorage.getItem('username') || 'Admin 1').toUpperCase();
            const res = await fetch(`${window.BASE_URL}/api/investigasi/selesaikan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    nik: nik,
                    catatan: catatan,
                    petugas: `Dinsos Sidoarjo (${currentHandler})`
                })
            });

            if (res.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Laporan Ditutup & Selesai!',
                    text: 'Status aduan telah berhasil diperbarui menjadi SELESAI dan warga telah ternotifikasi.',
                    confirmButtonColor: '#009846'
                });
                window.loadLaporanChatData();
                if (typeof window.loadDashboardData === 'function') window.loadDashboardData(false);
                if (typeof window.loadWargaData === 'function') window.loadWargaData();
            } else {
                Swal.fire('Informasi', 'Status laporan telah disimpan.', 'info');
                window.loadLaporanChatData();
                if (typeof window.loadDashboardData === 'function') window.loadDashboardData(false);
                if (typeof window.loadWargaData === 'function') window.loadWargaData();
            }
        } catch (e) {
            Swal.fire('Error', 'Gagal memproses penyelesaian laporan.', 'error');
        }
    }
};

// =========================================================================
// ESKALASI ADUAN KE SUPER ADMIN (MEKANISME TERHUBUNG ADMIN BANSOS <-> SUPER ADMIN)
// =========================================================================
window.eskalasikanKeSuperAdmin = async function (id, nik, nama) {
    const { value: formValues } = await Swal.fire({
        title: '🛡️ Teruskan Aduan ke Super Admin',
        html: `
            <div style="text-align:left; font-size:0.86rem; color:#475569; margin-bottom:12px;">
                Eskalasi investigasi kode & audit data untuk warga:
                <div style="font-weight:800; color:#0f172a; margin-top:2px;">${window.safeHtml(nama)} (${nik})</div>
            </div>
            <div style="text-align:left; margin-bottom:10px;">
                <label style="font-size:0.8rem; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Kategori Alasan Eskalasi:</label>
                <select id="swalAlasanEskalasi" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.85rem;">
                    <option value="Anomali Algoritma / Perhitungan Skor SAW">Anomali Algoritma / Perhitungan Skor SAW</option>
                    <option value="Dugaan Duplikasi / Sengketa NIK & Keluarga">Dugaan Duplikasi / Sengketa NIK & Keluarga</option>
                    <option value="Ketidaksesuaian Kuota Bansos & Rekapitulasi Wilayah">Ketidaksesuaian Kuota Bansos & Rekapitulasi Wilayah</option>
                    <option value="Investigasi Log Keamanan & Audit Siber Data Warga">Investigasi Log Keamanan & Audit Siber Data Warga</option>
                    <option value="Lainnya (Perlu Putusan Tingkat Lanjut Developer)">Lainnya (Perlu Putusan Tingkat Lanjut Developer)</option>
                </select>
            </div>
            <div style="text-align:left; margin-bottom:10px;">
                <label style="font-size:0.8rem; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Tingkat Urgensi Masalah:</label>
                <select id="swalUrgensiEskalasi" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.85rem;">
                    <option value="Tinggi" selected>Tinggi (Butuh Investigasi Cepat)</option>
                    <option value="Kritis">Kritis (Mendesak / Sengketa Penyaluran)</option>
                    <option value="Sedang">Sedang (Audit Rutin Kode & Aturan)</option>
                </select>
            </div>
            <div style="text-align:left;">
                <label style="font-size:0.8rem; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Catatan Analisis Awal Admin Bansos:</label>
                <textarea id="swalCatatanAdminEskalasi" placeholder="Jelaskan temuan awal atau alasan membutuhkan audit Super Admin..." style="width:100%; height:75px; padding:8px 12px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.85rem; font-family:inherit;">Mohon dilakukan audit kode pada formula perhitungan SAW dan verifikasi status kelayakan NIK ini.</textarea>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Kirim Eskalasi ke Super Admin',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const alasan = document.getElementById('swalAlasanEskalasi')?.value;
            const urgensi = document.getElementById('swalUrgensiEskalasi')?.value;
            const catatan = document.getElementById('swalCatatanAdminEskalasi')?.value.trim();
            if (!catatan) {
                Swal.showValidationMessage('Mohon isi catatan analisis awal sebelum meneruskan.');
                return false;
            }
            return { alasan, urgensi, catatan };
        }
    });

    if (formValues) {
        try {
            const currentHandler = (localStorage.getItem('username') || 'Admin Bansos').toUpperCase();
            const res = await fetch(`${window.BASE_URL}/api/investigasi/eskalasikan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    nik: nik,
                    alasan_eskalasi: formValues.alasan,
                    urgensi_eskalasi: formValues.urgensi,
                    catatan_admin: formValues.catatan,
                    petugas: `Admin Bansos (${currentHandler})`
                })
            });

            if (res.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Aduan Berhasil Diteruskan!',
                    html: `Tiket aduan <b>${window.safeHtml(nama)}</b> telah diteruskan ke <b>Super Admin (Developer)</b>.<br><br>Super Admin akan meneliti kode SPK, log basis data, dan memberikan rekomendasi teknis yang akan langsung muncul di panel ini.`,
                    confirmButtonColor: '#009846'
                });
                window.loadLaporanChatData();
            } else {
                Swal.fire('Error', 'Gagal meneruskan laporan ke Super Admin.', 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Koneksi terputus saat eskalasi.', 'error');
        }
    }
};

window.ubahTahapAduan = async function (id, nik) {
    const cleanId = String(id || '').replace(/\D/g, '');
    let item = (window.allLaporanChatData || []).find(x => 
        String(x.id) === String(id) || 
        String(x.id).replace(/\D/g, '') === cleanId
    ) || (window.allLaporanChatData || []).find(x => String(x.nik) === String(nik));

    // Ambil data aduan paling mutakhir langsung dari server agar tahapan dan catatan selalu presisi sesuai perubahan terakhir
    try {
        const resAduan = await fetch(`${window.BASE_URL}/api/publik/cek-aduan?nik=${encodeURIComponent(nik)}`);
        if (resAduan.ok) {
            const jsonAduan = await resAduan.json();
            if (jsonAduan.data) {
                item = { ...(item || {}), ...jsonAduan.data };
            }
        }
    } catch (e) {}

    const currentStepNum = item ? (Number(item.status_step) || 2) : 2;
    const currentStepCode = `step${currentStepNum}`;
    const defaultCatatan = (item && item.catatan_petugas) ? item.catatan_petugas : 'Petugas sedang melakukan tindak lanjut investigasi.';

    const { value: formValues } = await Swal.fire({
        title: 'Ubah Tahapan Investigasi & Mediasi',
        html: `
            <div style="text-align:left; font-size:0.85rem; color:#475569; margin-bottom:12px;">
                Pilih status tahapan investigasi terkini untuk NIK: <b>${nik}</b>:
            </div>
            <div style="text-align:left; margin-bottom:12px;">
                <label style="font-size:0.8rem; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Tahapan Pelaporan:</label>
                <select id="swalPilihTahap" style="width:100%; padding:9px 12px; border-radius:10px; border:1.5px solid #cbd5e1; font-size:0.85rem;">
                    <option value="step1" ${currentStepCode === 'step1' ? 'selected' : ''}>Step 1: Laporan Diterima & Masuk Antrean</option>
                    <option value="step2" ${currentStepCode === 'step2' ? 'selected' : ''}>Step 2: Peninjauan Bukti & Dokumen</option>
                    <option value="step3" ${currentStepCode === 'step3' ? 'selected' : ''}>Step 3: Investigasi Lapangan & Klarifikasi</option>
                    <option value="step4" ${currentStepCode === 'step4' ? 'selected' : ''}>Step 4: Mediasi & Musyawarah Dinsos</option>
                    <option value="step5" ${currentStepCode === 'step5' ? 'selected' : ''}>Step 5: Putusan Akhir & Selesai</option>
                </select>
            </div>
            <div style="text-align:left;">
                <label style="font-size:0.8rem; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Catatan Perkembangan Petugas:</label>
                <textarea id="swalCatatanTahap" placeholder="Tulis catatan tindak lanjut..." style="width:100%; height:70px; padding:8px 12px; border-radius:10px; border:1.5px solid #cbd5e1; font-size:0.84rem; font-family:inherit;">${window.escapeInlineJS(defaultCatatan)}</textarea>
            </div>
        `,
        didOpen: () => {
            const sel = document.getElementById('swalPilihTahap');
            if (sel) sel.value = currentStepCode;
            const cat = document.getElementById('swalCatatanTahap');
            if (cat && defaultCatatan) cat.value = defaultCatatan;
        },
        showCancelButton: true,
        confirmButtonText: 'Perbarui Tahap',
        confirmButtonColor: '#009846',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const tahap = document.getElementById('swalPilihTahap')?.value;
            const catatan = document.getElementById('swalCatatanTahap')?.value.trim();
            return { tahap, catatan };
        }
    });

    if (formValues && formValues.tahap) {
        try {
            const currentHandler = (localStorage.getItem('username') || 'Petugas Lapangan').toUpperCase();
            await fetch(`${window.BASE_URL}/api/investigasi/tindak-lanjut`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    nik,
                    aksi: formValues.tahap,
                    tanggapan: formValues.catatan || `Tahapan investigasi diperbarui oleh ${currentHandler}.`,
                    petugas: `Dinsos (${currentHandler})`
                })
            });
            Swal.fire({
                icon: 'success',
                title: 'Tahapan Diperbarui!',
                text: 'Perubahan tahapan laporan telah disimpan dan langsung tersinkronkan ke dasbor warga.',
                timer: 1500,
                showConfirmButton: false
            });
            window.loadLaporanChatData();
            if (typeof window.loadDashboardData === 'function') window.loadDashboardData(false);
        } catch (e) {
            Swal.fire('Error', 'Gagal memperbarui tahapan investigasi.', 'error');
        }
    }
};

function renderLaporanChat(data) {
    const container = document.getElementById('laporanChatList');
    if (!container) return;

    const prevScrollTop = container.scrollTop;

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8; font-size:0.9rem;"><i class="fas fa-clipboard-check fa-3x" style="opacity:0.3; margin-bottom:10px; display:block;"></i>Tidak ada laporan yang sesuai kriteria pencarian.</div>';
        return;
    }

    container.innerHTML = data.map(item => {
        const currentStep = Number(item.status_step) || (item.status === 'Selesai' ? 5 : 2);
        const isSelesai = window.isSelesaiAduan(item);
        const isUrgent = window.isItemUrgent(item);
        const isSistem = window.isSystemIssue(item);
        const isTerdaftar = window.isWargaRegistered(item);
        
        let statusBadge = '';
        if (isSelesai) {
            statusBadge = `<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:800; padding:4px 12px; border-radius:14px;"><i class="fas fa-check-circle"></i> SELESAI & DITUTUP</span>`;
        } else if (currentStep === 4) {
            statusBadge = `<span class="badge" style="background:#f3e8ff; color:#7e22ce; border:1px solid #d8b4fe; font-weight:800; padding:4px 12px; border-radius:14px;"><i class="fas fa-comments"></i> MEDIASI & MUSYAWARAH</span>`;
        } else if (currentStep === 3) {
            statusBadge = `<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:800; padding:4px 12px; border-radius:14px;"><i class="fas fa-walking"></i> INVESTIGASI LAPANGAN</span>`;
        } else if (currentStep === 2) {
            statusBadge = `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:800; padding:4px 12px; border-radius:14px;"><i class="fas fa-search"></i> PENINJAUAN BUKTI</span>`;
        } else {
            statusBadge = `<span class="badge" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; font-weight:800; padding:4px 12px; border-radius:14px;"><i class="fas fa-file-invoice"></i> LAPORAN DITERIMA</span>`;
        }

        return `
            <div class="card" style="padding:18px 22px; margin-bottom:16px; border:1.5px solid ${isSelesai ? '#bbf7d0' : (isUrgent ? '#fca5a5' : '#e2e8f0')}; ${isUrgent && !isSelesai ? 'border-left:5px solid #dc2626;' : ''} border-radius:20px; background:${isSelesai ? '#ffffff' : '#ffffff'}; box-shadow:0 4px 16px rgba(15,23,42,0.04); transition:transform 0.15s ease;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span style="font-weight:800; font-size:0.85rem; color:#dc2626;"><i class="fas fa-shield-virus"></i> ${item.id}</span>
                        <span style="background:#f1f5f9; color:#475569; padding:2px 10px; border-radius:10px; font-weight:700; font-size:0.75rem;">${item.kategori || 'Sengketa Penyaluran'}</span>
                        ${isTerdaftar ? `<span class="badge" style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-weight:800; font-size:0.72rem; padding:2px 8px; border-radius:8px;"><i class="fas fa-user-check"></i> Terdaftar</span>` : `<span class="badge" style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; font-weight:800; font-size:0.72rem; padding:2px 8px; border-radius:8px;"><i class="fas fa-user-plus"></i> Belum Terdaftar</span>`}
                        ${isSistem ? `<span class="badge" style="background:#f5f3ff; color:#7c3aed; border:1px solid #ddd6fe; font-weight:800; font-size:0.72rem; padding:2px 8px; border-radius:8px;"><i class="fas fa-laptop-code"></i> Kendala Sistem</span>` : ''}
                        ${isUrgent ? `<span class="badge" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; font-weight:800; font-size:0.68rem; padding:1px 6px; border-radius:6px;"><i class="fas fa-exclamation-triangle"></i> URGENT</span>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${statusBadge}
                        <span style="font-size:0.75rem; color:#94a3b8; font-weight:600;"><i class="far fa-clock"></i> ${item.waktu || 'Hari ini'}</span>
                    </div>
                </div>

                <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-bottom:8px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span><i class="fas fa-user text-muted" style="font-size:0.85rem;"></i> Pelapor: <b>${window.safeHtml(item.nama)}</b></span>
                    <span style="color:#cbd5e1;">&bull;</span>
                    <span class="font-mono" style="font-size:0.85rem; color:#0284c7; background:#e0f2fe; padding:2px 8px; border-radius:8px;"><i class="fas fa-id-card"></i> ${item.nik}</span>
                </div>

                <div style="background:#f8fafc; padding:12px 16px; border-radius:14px; font-size:0.88rem; color:#334155; margin-bottom:12px; border:1px solid #e2e8f0; line-height:1.5;">
                    <i class="fas fa-quote-left text-muted" style="margin-right:6px; opacity:0.6;"></i>${window.safeHtml(item.uraian || item.deskripsi || '-')}
                </div>

                ${item.catatan_petugas ? `
                    <div style="background:#eff6ff; padding:10px 14px; border-radius:12px; font-size:0.82rem; color:#1e40af; margin-bottom:12px; border-left:4px solid #3b82f6;">
                        <b><i class="fas fa-user-shield"></i> Tindak Lanjut Petugas:</b> ${window.safeHtml(item.catatan_petugas)}
                    </div>
                ` : ''}

                <!-- KOTAK ESKALASI DAN PUTUSAN SUPER ADMIN (TERHUBUNG LANGSUNG) -->
                ${item.eskalasi_ke_superadmin ? `
                    <div style="background:#fef2f2; border:1.5px solid #fecaca; border-radius:14px; padding:12px 14px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                            <span style="font-weight:800; color:#b91c1c; font-size:0.82rem;">
                                <i class="fas fa-shield-alt"></i> DITERUSKAN KE SUPER ADMIN (DEVELOPER)
                            </span>
                            <span style="background:#fee2e2; color:#dc2626; font-weight:800; font-size:0.72rem; padding:2px 8px; border-radius:6px; border:1px solid #fca5a5;">
                                Urgensi: ${item.urgensi_eskalasi || 'Tinggi'}
                            </span>
                        </div>
                        <div style="font-size:0.8rem; color:#475569; margin-top:4px;">
                            <b>Alasan:</b> ${window.safeHtml(item.alasan_eskalasi || '-')}
                            <span style="color:#94a3b8; font-size:0.75rem;">&bull; Diteruskan oleh: ${window.safeHtml(item.diteruskan_oleh || 'Admin Bansos')} (${item.waktu_eskalasi || ''})</span>
                        </div>
                        ${item.putusan_superadmin ? `
                            <div style="background:#ffffff; border:1.5px solid #86efac; border-radius:10px; padding:10px 12px; margin-top:8px; box-shadow:0 2px 6px rgba(22,101,52,0.06);">
                                <div style="font-weight:800; color:#166534; font-size:0.82rem; display:flex; align-items:center; gap:6px;">
                                    <i class="fas fa-check-circle text-emerald-600"></i> Rekomendasi & Putusan Super Admin:
                                </div>
                                <div style="font-size:0.84rem; color:#1e293b; margin-top:4px; font-weight:600; line-height:1.4;">
                                    ${window.safeHtml(item.putusan_superadmin)}
                                </div>
                                <div style="font-size:0.72rem; color:#64748b; margin-top:4px;">
                                    <i class="fas fa-code"></i> Audit Teknis: ${window.safeHtml(item.audit_kode_terkait || '-')} &bull; ${item.waktu_putusan_superadmin || ''}
                                </div>
                            </div>
                        ` : `
                            <div style="font-size:0.76rem; color:#dc2626; margin-top:6px; font-weight:600; display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-spinner fa-spin"></i> Menunggu audit kode dan investigasi dari Super Admin...
                            </div>
                        `}
                    </div>
                ` : ''}

                <!-- ACTIONS DOCK RESMI -->
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:12px; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" onclick="window.ubahTahapAduan('${item.id}', '${item.nik}')" class="btn btn-sm btn-secondary" style="border-radius:14px; font-weight:700; font-size:0.75rem; padding:6px 12px;" title="Ubah Tahapan Penanganan">
                            <i class="fas fa-tasks text-primary"></i> Ubah Tahapan
                        </button>
                        ${!isSelesai && !item.eskalasi_ke_superadmin ? `
                            <button type="button" onclick="window.eskalasikanKeSuperAdmin('${item.id}', '${item.nik}', '${window.escapeInlineJS(item.nama)}')" class="btn btn-sm" style="background:#fef2f2; color:#dc2626; border:1px solid #fca5a5; border-radius:14px; font-weight:800; font-size:0.75rem; padding:6px 12px;" title="Teruskan ke Super Admin untuk audit kode & data">
                                <i class="fas fa-share text-red-600"></i> Teruskan ke Super Admin 🛡️
                            </button>
                        ` : ''}
                        <button type="button" onclick="window.panggilWargaDariAduan('${item.nik}', 'audio')" class="btn btn-sm" style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; border-radius:14px; font-weight:700; font-size:0.75rem; padding:6px 12px;">
                            <i class="fas fa-phone-alt"></i> Telepon
                        </button>
                        <button type="button" onclick="window.panggilWargaDariAduan('${item.nik}', 'video')" class="btn btn-sm" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd; border-radius:14px; font-weight:700; font-size:0.75rem; padding:6px 12px;">
                            <i class="fas fa-video"></i> Video Call
                        </button>
                    </div>

                    <div style="display:flex; gap:8px;">
                        ${!isSelesai ? `
                            <button type="button" onclick="window.selesaikanLaporanAduan('${item.id}', '${item.nik}', '${window.escapeInlineJS(item.nama)}')" class="btn btn-sm" style="background:linear-gradient(135deg, #009846, #047857); color:white; border:none; border-radius:20px; font-weight:800; font-size:0.8rem; padding:7px 18px; box-shadow:0 3px 8px rgba(0,152,70,0.25);">
                                <i class="fas fa-check-circle"></i> Selesaikan Laporan
                            </button>
                        ` : `
                            <span style="color:#16a34a; font-weight:800; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px;">
                                <i class="fas fa-check-double"></i> Telah Diselesaikan
                            </span>
                        `}
                        <button onclick="window.bukaChatDariAduan('${item.nik}')" class="btn btn-primary btn-sm" style="border-radius:20px; padding:7px 16px; font-weight:700; font-size:0.8rem;">
                            <i class="fas fa-comments"></i> Buka Chat Mediasi
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = prevScrollTop;
}

window.switchPanelWargaInvestigasi = function (panelType, btn) {
    window.activePanelWargaFilter = panelType || 'all';

    const btnAll = document.getElementById('btnPanelWarga_all');
    const btnTerdaftar = document.getElementById('btnPanelWarga_terdaftar');
    const btnBelum = document.getElementById('btnPanelWarga_belum');

    [btnAll, btnTerdaftar, btnBelum].forEach(b => {
        if (b) {
            b.style.background = 'transparent';
            b.style.boxShadow = 'none';
            b.style.fontWeight = '700';
        }
    });

    if (btnAll) btnAll.style.color = '#64748b';
    if (btnTerdaftar) btnTerdaftar.style.color = '#047857';
    if (btnBelum) btnBelum.style.color = '#c2410c';

    const activeBtn = (panelType === 'terdaftar') ? btnTerdaftar : ((panelType === 'belum') ? btnBelum : btnAll);
    if (activeBtn) {
        activeBtn.style.background = '#ffffff';
        activeBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
        activeBtn.style.fontWeight = '800';
        if (panelType === 'all') activeBtn.style.color = '#0f172a';
    }

    const badge = document.getElementById('panelWargaInfoBadge');
    if (badge) {
        if (panelType === 'terdaftar') {
            badge.innerHTML = '<i class="fas fa-user-check text-success"></i> Panel Khusus: Menampilkan aduan warga yang telah terdaftar dalam database bansos (KPM).';
        } else if (panelType === 'belum') {
            badge.innerHTML = '<i class="fas fa-user-plus text-warning"></i> Panel Khusus: Menampilkan aduan kendala dari warga yang belum mendaftar / pemohon baru.';
        } else {
            badge.innerHTML = '<i class="fas fa-info-circle text-primary"></i> Menampilkan semua aduan warga terdata maupun pemohon baru.';
        }
    }

    window.applyCombinedInvestigasiFilter();
};

window.filterInvestigasi = function (filterType, btn) {
    window.activeInvestigasiFilter = filterType || 'all';

    const filterBtns = [
        { id: 'btnFilterInv_all', color: '' },
        { id: 'btnFilterInv_proses', color: '#d97706' },
        { id: 'btnFilterInv_urgent', color: '#dc2626' },
        { id: 'btnFilterInv_sistem', color: '#7c3aed' },
        { id: 'btnFilterInv_sengketa', color: '' },
        { id: 'btnFilterInv_selesai', color: '#16a34a' }
    ];

    filterBtns.forEach(item => {
        const b = document.getElementById(item.id);
        if (b) {
            b.className = 'btn btn-secondary btn-sm';
            b.style.color = item.color;
            b.style.borderRadius = '20px';
            b.style.fontWeight = '700';
            b.style.borderColor = '';
        }
    });

    const curBtn = btn || document.getElementById('btnFilterInv_' + filterType);
    if (curBtn) {
        curBtn.className = 'btn btn-primary btn-sm';
        curBtn.style.color = '#ffffff';
        curBtn.style.borderRadius = '20px';
        curBtn.style.fontWeight = '800';
    }

    window.applyCombinedInvestigasiFilter();
};

window.filterInvestigasiSearch = function (query) {
    window.activeSearchInvestigasiQuery = query || '';
    window.applyCombinedInvestigasiFilter();
};

window.applyCombinedInvestigasiFilter = function () {
    let list = window.allLaporanChatData || [];

    // 1. Filter Panel Status Kepesertaan Warga
    if (window.activePanelWargaFilter === 'terdaftar') {
        list = list.filter(x => window.isWargaRegistered(x));
    } else if (window.activePanelWargaFilter === 'belum') {
        list = list.filter(x => !window.isWargaRegistered(x));
    }

    // 2. Filter Kategori Aduan
    if (window.activeInvestigasiFilter === 'urgent') {
        list = list.filter(x => window.isItemUrgent(x));
    } else if (window.activeInvestigasiFilter === 'sistem') {
        list = list.filter(x => window.isSystemIssue(x));
    } else if (window.activeInvestigasiFilter === 'sengketa') {
        list = list.filter(x => (String(x.kategori || '').toLowerCase().includes('sengketa')) || (String(x.kategori || '').toLowerCase().includes('salur')));
    } else if (window.activeInvestigasiFilter === 'selesai') {
        list = list.filter(x => window.isSelesaiAduan(x));
    } else if (window.activeInvestigasiFilter === 'proses') {
        list = list.filter(x => !window.isSelesaiAduan(x));
    }

    // 3. Filter Search Input
    const q = (window.activeSearchInvestigasiQuery || '').toLowerCase().trim();
    if (q) {
        list = list.filter(item => 
            String(item.nik || '').includes(q) ||
            String(item.nama || '').toLowerCase().includes(q) ||
            String(item.uraian || '').toLowerCase().includes(q) ||
            String(item.kategori || '').toLowerCase().includes(q) ||
            String(item.id || '').toLowerCase().includes(q)
        );
    }

    renderLaporanChat(list);
};

window.bukaMediaLightbox = function (url) {
    const modal = document.getElementById('mediaLightbox');
    const container = document.getElementById('lightboxContent');
    if (!modal || !container) return;
    container.innerHTML = `<img src="${url}" style="max-width:90vw; max-height:80vh; border-radius:12px; object-fit:contain;" />`;
    modal.style.display = 'flex';
};

window.closeLightbox = function (e) {
    if (!e || e.target.id === 'mediaLightbox' || e.target.classList.contains('close-lightbox-btn')) {
        const modal = document.getElementById('mediaLightbox');
        const container = document.getElementById('lightboxContent');
        if (container) container.innerHTML = '';
        if (modal) modal.style.display = 'none';
    }
};

window.bukaWilayahDetail = function (kecamatanNama) {
    if (typeof window.bukaRincianWilayah === 'function') {
        window.bukaRincianWilayah(kecamatanNama || 'Sidoarjo');
        return;
    }
    const modal = document.getElementById('modalWilayahDetail');
    const titleEl = document.getElementById('modalWilayahTitle');
    const tbody = document.getElementById('wilayahDetailTbody');
    if (!modal || !tbody) return;

    if (titleEl) titleEl.innerText = kecamatanNama || 'Kabupaten Sidoarjo';
    const dataList = window.globalDataWarga || [];
    const filtered = dataList.filter(w => String(w.alamat || '').toLowerCase().includes(String(kecamatanNama || '').toLowerCase()));

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#94a3b8;">Tidak ada data warga terdaftar di wilayah ini.</td></tr>';
    } else {
        tbody.innerHTML = filtered.map((w, idx) => `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><b>${window.safeHtml(w.nama)}</b><br><small class="text-muted font-mono">${w.nik}</small></td>
                <td>${window.safeHtml(w.alamat || '-')}</td>
                <td style="text-align:center;"><span class="badge badge-blue">Desil ${w.desil || 5}</span></td>
                <td>Awal: Tahap I (Rp 750.000) &rarr; Akhir: Tahap IV (${(w.desil || 5) <= 4 ? 'Rp 750.000' : 'Rp 0'})</td>
                <td>Total: ${(w.desil || 5) <= 4 ? 'Rp 3.000.000' : 'Rp 2.250.000'} &bull; Tunai PKH/BLT &amp; Sembako Beras 10 Kg</td>
                <td style="text-align:center;">${w.bukti_salur ? '<i class="fas fa-check text-success"></i>' : '-'}</td>
                <td style="text-align:center;">${w.lat && w.lng ? `${Number(w.lat).toFixed(4)},${Number(w.lng).toFixed(4)}` : '-'}</td>
            </tr>
        `).join('');
    }

    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
};

// =========================================================================
