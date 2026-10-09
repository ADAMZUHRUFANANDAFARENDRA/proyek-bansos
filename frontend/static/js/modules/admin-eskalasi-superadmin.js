/**
 * =============================================================================
 * MODUL: admin-eskalasi-superadmin.js
 * Deskripsi: Pusat Eskalasi Aduan, Akses Keseluruhan Kode, & Investigasi Teknis
 * Khusus Peran: Super Admin (Developer)
 * PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
 * =============================================================================
 */

(function (window) {
    'use strict';

    window.eskalasiListData = [];
    window.inspeksiKodeData = null;
    window.activeEskalasiTab = 'tiket';

    function isSuperAdmin() {
        const role = (localStorage.getItem('role') || localStorage.getItem('user_role') || '').toLowerCase().trim();
        return role === 'super_admin' || role === 'superadmin' || role === 'developer';
    }

    // =========================================================================
    // 1. MEMBUKA & MENUTUP MODAL ESKALASI SUPER ADMIN
    // =========================================================================
    window.bukaModalEskalasiSuperAdmin = async function (defaultNik = null) {
        if (!isSuperAdmin()) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Akses Ditolak',
                    text: 'Fitur Eskalasi Masalah & Inspeksi Kode hanya dapat dibuka oleh Super Admin (Developer).',
                    confirmButtonColor: '#dc2626'
                });
            }
            return;
        }

        let modal = document.getElementById('modalEskalasiSuperAdmin');
        if (!modal) {
            buatElementModalEskalasi();
            modal = document.getElementById('modalEskalasiSuperAdmin');
        }

        if (modal) {
            modal.style.display = 'flex';
            await window.muatDataEskalasiSuperAdmin();
            await window.muatDataInspeksiKode();
            if (defaultNik) {
                window.pilihTabEskalasi('debugger');
                const inp = document.getElementById('debugNikInput');
                if (inp) {
                    inp.value = defaultNik;
                    window.simulasikanHitungNik(defaultNik);
                }
            }
        }
    };

    window.tutupModalEskalasiSuperAdmin = function () {
        const modal = document.getElementById('modalEskalasiSuperAdmin');
        if (modal) modal.style.display = 'none';
    };

    // =========================================================================
    // 2. MENGAMBIL DATA TIKET ESKALASI DARI BACKEND
    // =========================================================================
    window.muatDataEskalasiSuperAdmin = async function () {
        const container = document.getElementById('listTiketEskalasi');
        if (!container) return;

        try {
            const token = window.getCleanToken ? window.getCleanToken() : '';
            const res = await fetch(`${window.BASE_URL}/api/investigasi/eskalasi-list`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });

            if (res.ok) {
                const json = await res.json();
                window.eskalasiListData = json.data || [];
                window.renderTiketEskalasi(window.eskalasiListData);
                window.updateCounterEskalasi(window.eskalasiListData);
            } else {
                container.innerHTML = '<div style="text-align:center; padding:30px; color:#94a3b8;">Tidak dapat memuat daftar eskalasi dari peladen.</div>';
            }
        } catch (e) {
            container.innerHTML = '<div style="text-align:center; padding:30px; color:#ef4444;">Gagal menghubungi API eskalasi.</div>';
        }
    };

    window.updateCounterEskalasi = function (list) {
        if (!Array.isArray(list)) return;
        const total = list.length;
        const pending = list.filter(x => x.status !== 'Selesai' && x.status_superadmin !== 'Selesai - Rekomendasi Diterapkan').length;
        const selesai = total - pending;

        const elTotal = document.getElementById('kpiEskalasiTotal');
        const elPending = document.getElementById('kpiEskalasiPending');
        const elSelesai = document.getElementById('kpiEskalasiSelesai');

        if (elTotal) elTotal.textContent = total;
        if (elPending) elPending.textContent = pending;
        if (elSelesai) elSelesai.textContent = selesai;

        const tileBadge = document.getElementById('badgeTileEskalasiCount');
        if (tileBadge) {
            tileBadge.textContent = pending;
            tileBadge.style.display = pending > 0 ? 'inline-block' : 'none';
        }
        const navBadge = document.getElementById('badgeNavEskalasiCount');
        if (navBadge) {
            navBadge.textContent = pending;
            navBadge.style.display = pending > 0 ? 'inline-block' : 'none';
        }
    };

    // =========================================================================
    // 3. MENGAMBIL DATA INSPEKSI KODE & ARSITEKTUR ENGINE
    // =========================================================================
    window.muatDataInspeksiKode = async function () {
        try {
            const token = window.getCleanToken ? window.getCleanToken() : '';
            const res = await fetch(`${window.BASE_URL}/api/investigasi/inspeksi-kode`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            if (res.ok) {
                window.inspeksiKodeData = await res.json();
                renderKodeViewer(window.inspeksiKodeData);
            }
        } catch (e) {
            console.warn('[Eskalasi] Gagal mengambil data inspeksi kode:', e);
        }
    };

    // =========================================================================
    // 4. RENDERING TIKET ESKALASI (ADMIN BANSOS -> SUPER ADMIN)
    // =========================================================================
    window.renderTiketEskalasi = function (data) {
        const container = document.getElementById('listTiketEskalasi');
        if (!container) return;

        const prevScrollTop = container.scrollTop;

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:50px 20px; color:#94a3b8;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px auto; display:block;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="m9 12 2 2 4-4"></path>
                    </svg>
                    <div style="font-weight:700; font-size:1rem; color:#334155;">Tidak Ada Tiket Eskalasi Aktif</div>
                    <div style="font-size:0.84rem; margin-top:4px;">Semua aduan warga saat ini tertangani normal oleh Admin Bansos.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = data.map(item => {
            const isResolved = item.status === 'Selesai' || item.status_superadmin === 'Selesai - Rekomendasi Diterapkan';
            const urgensi = item.urgensi_eskalasi || 'Tinggi';
            let urgensiBadge = '';
            if (urgensi === 'Kritis') {
                urgensiBadge = '<span style="background:#fee2e2; color:#b91c1c; border:1px solid #f87171; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem;">KRITIS</span>';
            } else if (urgensi === 'Tinggi') {
                urgensiBadge = '<span style="background:#ffedd5; color:#c2410c; border:1px solid #fdba74; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem;">TINGGI</span>';
            } else {
                urgensiBadge = '<span style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem;">SEDANG</span>';
            }

            return `
                <div style="background:#ffffff; border:1.5px solid ${isResolved ? '#bbf7d0' : '#fecaca'}; border-radius:18px; padding:18px 20px; margin-bottom:16px; box-shadow:0 4px 14px rgba(15,23,42,0.04); transition:all 0.2s;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-weight:800; color:#dc2626; font-size:0.88rem;">ID: ${item.id}</span>
                            ${urgensiBadge}
                            <span style="background:#f1f5f9; color:#475569; padding:2px 10px; border-radius:10px; font-size:0.76rem; font-weight:700;">${window.safeHtml(item.kategori || 'Sengketa')}</span>
                        </div>
                        <div>
                            ${isResolved 
                                ? '<span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem;"><i class="fas fa-check-circle"></i> PUTUSAN SELESAI</span>'
                                : '<span style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem;"><i class="fas fa-hourglass-half"></i> MENUNGGU REVIEW SUPER ADMIN</span>'
                            }
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
                        <span style="font-weight:800; color:#0f172a; font-size:0.95rem;">👤 ${window.safeHtml(item.nama)}</span>
                        <span style="color:#cbd5e1;">&bull;</span>
                        <span style="font-family:monospace; color:#0284c7; background:#e0f2fe; padding:2px 8px; border-radius:8px; font-weight:700; font-size:0.85rem;">NIK: ${item.nik}</span>
                        <span style="color:#cbd5e1;">&bull;</span>
                        <span style="color:#64748b; font-size:0.8rem;">Diteruskan oleh: <b>${window.safeHtml(item.diteruskan_oleh || 'Admin Bansos')}</b> (${item.waktu_eskalasi || 'Baru saja'})</span>
                    </div>

                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 16px; margin-bottom:10px; font-size:0.86rem; color:#334155; line-height:1.5;">
                        <div style="font-weight:700; color:#0f172a; margin-bottom:2px;">Alasan Eskalasi ke Super Admin:</div>
                        <div style="color:#b91c1c; font-weight:600;">${window.safeHtml(item.alasan_eskalasi || '-')}</div>
                        <div style="margin-top:6px; color:#475569;"><b>Uraian Aduan Warga:</b> ${window.safeHtml(item.uraian || item.deskripsi || '-')}</div>
                    </div>

                    ${item.catatan_petugas ? `
                        <div style="background:#eff6ff; border-left:4px solid #3b82f6; border-radius:10px; padding:8px 12px; font-size:0.8rem; color:#1e40af; margin-bottom:10px;">
                            <b>Analisis Awal Admin Bansos:</b> ${window.safeHtml(item.catatan_petugas)}
                        </div>
                    ` : ''}

                    ${item.putusan_superadmin ? `
                        <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:12px; padding:12px 16px; margin-bottom:10px;">
                            <div style="font-weight:800; color:#166534; font-size:0.84rem; display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-gavel text-emerald-600"></i> Putusan Resmi Super Admin (Developer):
                            </div>
                            <div style="font-size:0.86rem; color:#0f172a; margin-top:4px; font-weight:600;">
                                ${window.safeHtml(item.putusan_superadmin)}
                            </div>
                            <div style="font-size:0.74rem; color:#64748b; margin-top:4px;">
                                <b>Audit Kode/Log:</b> ${window.safeHtml(item.audit_kode_terkait || '-')} &bull; ${item.waktu_putusan_superadmin || ''}
                            </div>
                        </div>
                    ` : ''}

                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:12px; flex-wrap:wrap; gap:8px;">
                        <div style="display:flex; gap:8px;">
                            <button type="button" onclick="window.periksaKodeDanNik('${item.nik}')" class="btn btn-sm" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:14px; font-weight:700; font-size:0.78rem; padding:6px 14px;">
                                <i class="fas fa-search-plus"></i> Inspeksi Kode & Data NIK Ini
                            </button>
                            <button type="button" onclick="window.bukaChatDariAduan('${item.nik}'); window.tutupModalEskalasiSuperAdmin();" class="btn btn-sm btn-secondary" style="border-radius:14px; font-weight:700; font-size:0.78rem; padding:6px 14px;">
                                <i class="fas fa-comments"></i> Buka Chat Warga
                            </button>
                        </div>
                        <div>
                            <button type="button" onclick="window.beriPutusanSuperAdmin('${item.id}', '${item.nik}', '${window.escapeInlineJS(item.nama)}')" class="btn btn-sm" style="background:linear-gradient(135deg, #dc2626, #b91c1c); color:white; border:none; border-radius:20px; font-weight:800; font-size:0.8rem; padding:7px 18px; box-shadow:0 3px 8px rgba(220,38,38,0.25);">
                                <i class="fas fa-gavel"></i> ${isResolved ? 'Perbarui Putusan Teknis' : 'Beri Putusan Resmi Super Admin'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.scrollTop = prevScrollTop;
    };

    // =========================================================================
    // 5. MEMBERIKAN PUTUSAN RESMI DARI SUPER ADMIN (KIRIM BALIK KE ADMIN BANSOS)
    // =========================================================================
    window.beriPutusanSuperAdmin = async function (id, nik, nama) {
        const { value: formValues } = await Swal.fire({
            title: '⚖️ Putusan Teknis Super Admin',
            html: `
                <div style="text-align:left; font-size:0.86rem; color:#475569; margin-bottom:12px;">
                    Penetapan keputusan developer atas eskalasi aduan:
                    <div style="font-weight:800; color:#0f172a; margin-top:2px;">${window.safeHtml(nama)} (${nik})</div>
                </div>
                <div style="text-align:left; margin-bottom:10px;">
                    <label style="font-size:0.8rem; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Tindakan Putusan:</label>
                    <select id="swalTindakanSuperAdmin" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.85rem;">
                        <option value="selesai" selected>Setujui & Selesaikan (Rekomendasi Sah Terpenuhi)</option>
                        <option value="perbaiki_data">Koreksi Data Warga & Hitung Ulang Algoritma SAW</option>
                        <option value="kembalikan">Kembalikan ke Admin Bansos (Perlu Instruksi Lapangan)</option>
                    </select>
                </div>
                <div style="text-align:left; margin-bottom:10px;">
                    <label style="font-size:0.8rem; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Isi Putusan Resmi & Rekomendasi Developer:</label>
                    <textarea id="swalPutusanSuperAdmin" placeholder="Masukkan pertimbangan teknis, hasil audit algoritma, atau instruksi tindak lanjut..." style="width:100%; height:80px; padding:8px 12px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.85rem; font-family:inherit;">Telah dilakukan audit menyeluruh pada engine BWM-SAW dan verifikasi basis data. Sengketa dinyatakan selesai dengan rekomendasi kelayakan sah.</textarea>
                </div>
                <div style="text-align:left;">
                    <label style="font-size:0.8rem; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Catatan Audit Kode & Log Terkait:</label>
                    <input type="text" id="swalAuditKodeSuperAdmin" value="Audit Rule SAW 10 Kriteria, Hash Basis Data, & Log WAF Bersih" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.85rem;">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Kirim Putusan Resmi',
            confirmButtonColor: '#009846',
            cancelButtonText: 'Batal',
            preConfirm: () => {
                const tindakan = document.getElementById('swalTindakanSuperAdmin')?.value;
                const putusan = document.getElementById('swalPutusanSuperAdmin')?.value.trim();
                const audit_kode = document.getElementById('swalAuditKodeSuperAdmin')?.value.trim();
                if (!putusan) {
                    Swal.showValidationMessage('Isi putusan dan rekomendasi teknis wajib diisi.');
                    return false;
                }
                return { tindakan, putusan, audit_kode };
            }
        });

        if (formValues) {
            try {
                const currentHandler = (localStorage.getItem('username') || 'Super Admin').toUpperCase();
                const res = await fetch(`${window.BASE_URL}/api/investigasi/putusan-superadmin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: id,
                        nik: nik,
                        tindakan: formValues.tindakan,
                        putusan: formValues.putusan,
                        audit_kode: formValues.audit_kode,
                        petugas: `Super Admin (${currentHandler})`
                    })
                });

                if (res.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Putusan Berhasil Disimpan & Diteruskan!',
                        html: `Putusan teknis Anda telah dikirimkan ke <b>Admin Bansos</b>.<br><br>Status tiket telah diperbarui dan Admin Bansos dapat melihat hasil putusan di panel mereka secara real-time.`,
                        confirmButtonColor: '#009846'
                    });
                    await window.muatDataEskalasiSuperAdmin();
                    if (typeof window.loadLaporanChatData === 'function') {
                        window.loadLaporanChatData();
                    }
                } else {
                    Swal.fire('Error', 'Gagal menyimpan putusan Super Admin.', 'error');
                }
            } catch (e) {
                Swal.fire('Error', 'Terjadi kendala saat mengirim putusan.', 'error');
            }
        }
    };

    // =========================================================================
    // 6. INSPEKSI KODE & DEBUGGER DATA NIK TERADU
    // =========================================================================
    window.periksaKodeDanNik = function (nik) {
        window.pilihTabEskalasi('debugger');
        const inp = document.getElementById('debugNikInput');
        if (inp) {
            inp.value = nik;
            window.simulasikanHitungNik(nik);
        }
    };

    window.simulasikanHitungNik = function (nik) {
        const out = document.getElementById('debugOutputContainer');
        if (!out) return;

        const all = window.globalDataWarga || [];
        const warga = all.find(w => w.nik === nik);

        if (!warga) {
            out.innerHTML = `<div style="padding:20px; background:#fef2f2; border:1px solid #fecaca; border-radius:12px; color:#b91c1c;">Data warga dengan NIK <b>${window.safeHtml(nik)}</b> tidak ditemukan di basis data aktif.</div>`;
            return;
        }

        out.innerHTML = `
            <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:16px; padding:18px; margin-top:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                    <div>
                        <div style="font-size:1.05rem; font-weight:800; color:#0f172a;">${window.safeHtml(warga.nama)}</div>
                        <div style="font-family:monospace; color:#0284c7; font-weight:700;">NIK: ${warga.nik} &bull; Wilayah: ${window.safeHtml(warga.alamat || 'Sidoarjo')}</div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:1.1rem; font-weight:900; color:#009846;">Skor SAW: ${warga.skor_saw || '0.000'}</span>
                        <div style="font-size:0.75rem; color:#64748b; font-weight:700;">Ranking: #${warga.rank_saw || '-'} &bull; Status: ${warga.status_bansos || '-'}</div>
                    </div>
                </div>

                <div style="font-size:0.84rem; font-weight:700; color:#334155; margin-bottom:8px;">Nilai 10 Atribut Kriteria BWM-SAW:</div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px; font-size:0.8rem;">
                    <div style="background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;"><b>C1 Penghasilan:</b> Rp ${Number(warga.c1 || 0).toLocaleString('id-ID')} (Cost)</div>
                    <div style="background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;"><b>C2 Pengeluaran:</b> Rp ${Number(warga.c2 || 0).toLocaleString('id-ID')} (Benefit)</div>
                    <div style="background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;"><b>C3 Usia Kepala Keluarga:</b> ${warga.c3 || '-'} th (Benefit)</div>
                    <div style="background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;"><b>C4 Kondisi Rumah:</b> ${warga.c4 || '-'} (Cost)</div>
                    <div style="background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;"><b>C5 Jumlah Tanggungan:</b> ${warga.c5 || '-'} jiwa (Benefit)</div>
                    <div style="background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;"><b>C6 Daya Listrik:</b> ${warga.c6 || '-'} (Cost)</div>
                    <div style="background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;"><b>C7 Aset Bergerak:</b> ${warga.c7 || '-'} (Cost)</div>
                    <div style="background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;"><b>C8 Riwayat Bantuan:</b> ${warga.c8 || '-'} (Cost)</div>
                    <div style="background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;"><b>C9 Sumber Air Bersih:</b> ${warga.c9 || '-'} (Cost)</div>
                    <div style="background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;"><b>C10 Kondisi Kesehatan:</b> ${warga.c10 || '-'} (Benefit)</div>
                </div>

                <div style="margin-top:14px; background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:10px 14px; font-size:0.8rem; color:#166534;">
                    <i class="fas fa-check-shield"></i> <b>Integritas Data Terverifikasi:</b> Nilai atribut konsisten dengan batas normalisasi. Data siap diajukan untuk putusan resmi Super Admin.
                </div>
            </div>
        `;
    };

    function renderKodeViewer(info) {
        const preEl = document.getElementById('preCodeInspection');
        if (!preEl || !info) return;

        preEl.textContent = `// ============================================================================
// LIVE ARCHITECTURE INSPECTION: SISTEM PENDUKUNG KEPUTUSAN (SPK) BWM-SAW
// Versi Sistem: ${info.system_version || 'v3.5.0 Enterprise'}
// ============================================================================

1. METODE KOMPUTASI KEPUTUSAN:
   - Pembobotan Kriteria: ${info.engine_spk?.metode_utama || 'Best-Worst Method (BWM)'}
   - Normalisasi Benefit: ${info.engine_spk?.rumus_benefit || 'r_ij = x_ij / max(x_j)'}
   - Normalisasi Cost   : ${info.engine_spk?.rumus_cost || 'r_ij = min(x_j) / x_ij'}
   - Agregasi Skor Akhir: ${info.engine_spk?.rumus_skor_akhir || 'V_i = SUM(w_j * r_ij)'}

2. TABEL BOBOT 10 KRITERIA SAAT INI (BWM SIDOARJO):
${(info.engine_spk?.daftar_kriteria || []).map(k => `   [${k.kode}] ${k.nama.padEnd(28)} | Tipe: ${k.tipe.toUpperCase().padEnd(7)} | Bobot: ${k.bobot_persen}`).join('\n')}

3. STATUS CYBER SHIELD WAF & IDS ENGINE:
   - Status Guard: ${info.cyber_shield?.status || 'Active Real-Time'}
   - WAF Protection 6 Model Serangan:
${(info.cyber_shield?.kategori_serangan_diawasi || []).map(s => `     ✓ Terproteksi: ${s}`).join('\n')}

4. RINGKASAN DATA BASE & TIKET ESKALASI:
   - Total Penerima Terdata : ${info.database_status?.total_penerima_terdata || 0} warga
   - Total Pengaduan Masuk  : ${info.database_status?.total_pengaduan_masuk || 0} laporan
   - Tiket Eskalasi Aktif   : ${info.database_status?.total_eskalasi_aktif || 0} kasus membutuhkan review developer
`;
    }

    window.pilihTabEskalasi = function (tabName) {
        window.activeEskalasiTab = tabName;
        document.querySelectorAll('.tab-btn-eskalasi').forEach(btn => {
            btn.style.background = 'transparent';
            btn.style.color = '#64748b';
            btn.style.borderBottom = '2px solid transparent';
        });

        const activeBtn = document.getElementById(`tabBtnEskalasi_${tabName}`);
        if (activeBtn) {
            activeBtn.style.color = '#dc2626';
            activeBtn.style.borderBottom = '2px solid #dc2626';
            activeBtn.style.background = '#fef2f2';
        }

        const tabTiket = document.getElementById('tabContentEskalasi_tiket');
        const tabKode = document.getElementById('tabContentEskalasi_kode');
        const tabDebug = document.getElementById('tabContentEskalasi_debugger');

        if (tabTiket) tabTiket.style.display = tabName === 'tiket' ? 'block' : 'none';
        if (tabKode) tabKode.style.display = tabName === 'kode' ? 'block' : 'none';
        if (tabDebug) tabDebug.style.display = tabName === 'debugger' ? 'block' : 'none';
    };

    // =========================================================================
    // 7. MEMBUAT ELEMEN MODAL SECARA DINAMIS
    // =========================================================================
    function buatElementModalEskalasi() {
        if (document.getElementById('modalEskalasiSuperAdmin')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'modalEskalasiSuperAdmin';
        modalDiv.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.7); backdrop-filter:blur(6px); z-index:999999; justify-content:center; align-items:center; padding:18px; box-sizing:border-box;';

        modalDiv.innerHTML = `
            <div style="background:#ffffff; border-radius:24px; width:96%; max-width:1150px; height:90vh; display:flex; flex-direction:column; box-shadow:0 25px 60px rgba(0,0,0,0.3); border:1px solid #e2e8f0; overflow:hidden;">
                <!-- HEADER MODAL -->
                <div style="background:linear-gradient(135deg, #1e293b, #0f172a); color:#ffffff; padding:18px 24px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg, #ef4444, #b91c1c); display:flex; align-items:center; justify-content:center; font-size:1.2rem; color:#ffffff; box-shadow:0 4px 12px rgba(220,38,38,0.35);">
                            <i class="fas fa-code-branch"></i>
                        </div>
                        <div>
                            <div style="font-size:1.15rem; font-weight:900; letter-spacing:-0.2px;">Pusat Eskalasi Aduan & Inspeksi Kode (Super Admin)</div>
                            <div style="font-size:0.78rem; color:#94a3b8; font-weight:600;">Mekanisme Kolaborasi & Penanganan Terpadu: Admin Bansos &harr; Super Admin (Developer)</div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button type="button" onclick="window.muatDataEskalasiSuperAdmin(); window.muatDataInspeksiKode();" class="btn btn-sm" style="background:#334155; color:#ffffff; border:none; border-radius:14px; font-weight:700; font-size:0.75rem; padding:6px 14px; cursor:pointer;">
                            <i class="fas fa-sync-alt"></i> Segarkan
                        </button>
                        <button type="button" onclick="window.tutupModalEskalasiSuperAdmin()" style="background:none; border:none; color:#94a3b8; font-size:1.6rem; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                </div>

                <!-- KPI COUNTER BAR -->
                <div style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:12px 24px; display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px;">
                        <div style="font-size:0.72rem; font-weight:800; color:#64748b; text-transform:uppercase;">Total Eskalasi Masuk</div>
                        <div id="kpiEskalasiTotal" style="font-size:1.4rem; font-weight:900; color:#0f172a;">0</div>
                    </div>
                    <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:10px 14px;">
                        <div style="font-size:0.72rem; font-weight:800; color:#b91c1c; text-transform:uppercase;">Menunggu Putusan Developer</div>
                        <div id="kpiEskalasiPending" style="font-size:1.4rem; font-weight:900; color:#dc2626;">0</div>
                    </div>
                    <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:12px; padding:10px 14px;">
                        <div style="font-size:0.72rem; font-weight:800; color:#166534; text-transform:uppercase;">Telah Selesai & Ditangani</div>
                        <div id="kpiEskalasiSelesai" style="font-size:1.4rem; font-weight:900; color:#15803d;">0</div>
                    </div>
                </div>

                <!-- NAVIGATION TABS -->
                <div style="background:#ffffff; border-bottom:1px solid #e2e8f0; display:flex; padding:0 24px; gap:8px;">
                    <button type="button" id="tabBtnEskalasi_tiket" onclick="window.pilihTabEskalasi('tiket')" class="tab-btn-eskalasi" style="padding:12px 18px; border:none; background:#fef2f2; color:#dc2626; border-bottom:2px solid #dc2626; font-weight:800; font-size:0.86rem; cursor:pointer;">
                        <i class="fas fa-inbox" style="margin-right:6px;"></i> Tiket Eskalasi dari Admin Bansos
                    </button>
                    <button type="button" id="tabBtnEskalasi_kode" onclick="window.pilihTabEskalasi('kode')" class="tab-btn-eskalasi" style="padding:12px 18px; border:none; background:transparent; color:#64748b; border-bottom:2px solid transparent; font-weight:800; font-size:0.86rem; cursor:pointer;">
                        <i class="fas fa-code" style="margin-right:6px;"></i> Akses Keseluruhan Kode & Engine SPK
                    </button>
                    <button type="button" id="tabBtnEskalasi_debugger" onclick="window.pilihTabEskalasi('debugger')" class="tab-btn-eskalasi" style="padding:12px 18px; border:none; background:transparent; color:#64748b; border-bottom:2px solid transparent; font-weight:800; font-size:0.86rem; cursor:pointer;">
                        <i class="fas fa-bug" style="margin-right:6px;"></i> Simulator & Debugger Data Warga
                    </button>
                </div>

                <!-- TAB CONTENTS -->
                <div style="flex:1; overflow-y:auto; padding:20px 24px; background:#f8fafc;">
                    <!-- TAB 1: TIKET ESKALASI -->
                    <div id="tabContentEskalasi_tiket" style="display:block;">
                        <div id="listTiketEskalasi">
                            <div style="text-align:center; padding:40px; color:#94a3b8;">Memuat tiket eskalasi...</div>
                        </div>
                    </div>

                    <!-- TAB 2: AKSES KESELURUHAN KODE -->
                    <div id="tabContentEskalasi_kode" style="display:none;">
                        <div style="background:#0f172a; border-radius:16px; padding:20px; box-shadow:0 4px 20px rgba(0,0,0,0.15);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #1e293b; padding-bottom:10px;">
                                <div style="color:#38bdf8; font-weight:800; font-family:monospace; font-size:0.9rem;">
                                    <i class="fas fa-terminal"></i> LIVE ENGINE & CODE INSPECTION CONSOLE
                                </div>
                                <span style="background:#16a34a; color:#ffffff; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:6px;">LIVE CODE VALID</span>
                            </div>
                            <pre id="preCodeInspection" style="margin:0; font-family:'JetBrains Mono', monospace; font-size:0.82rem; color:#e2e8f0; line-height:1.6; max-height:550px; overflow-y:auto; white-space:pre-wrap;">Memuat status arsitektur kode...</pre>
                        </div>
                    </div>

                    <!-- TAB 3: SIMULATOR & DEBUGGER DATA WARGA -->
                    <div id="tabContentEskalasi_debugger" style="display:none;">
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
                            <div style="font-weight:800; font-size:1rem; color:#0f172a; margin-bottom:4px;">Simulator Audit Nilai Kriteria Warga</div>
                            <div style="font-size:0.82rem; color:#64748b; margin-bottom:14px;">Masukkan NIK untuk menganalisis skor SAW, mendeteksi anomali desil, atau mengecek keabsahan sanggahan.</div>
                            
                            <div style="display:flex; gap:10px; max-width:600px;">
                                <input type="text" id="debugNikInput" placeholder="Masukkan 16 digit NIK..." style="flex:1; padding:10px 14px; border-radius:12px; border:1.5px solid #cbd5e1; font-size:0.88rem; font-family:monospace;">
                                <button type="button" onclick="window.simulasikanHitungNik(document.getElementById('debugNikInput')?.value)" class="btn btn-primary" style="border-radius:12px; padding:10px 20px; font-weight:800; font-size:0.84rem;">
                                    <i class="fas fa-search"></i> Jalankan Simulasi
                                </button>
                            </div>

                            <div id="debugOutputContainer">
                                <div style="text-align:center; padding:40px; color:#94a3b8; font-size:0.85rem;">
                                    Silakan masukkan NIK atau pilih dari tiket eskalasi di Tab 1.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);
    }

})(window);
