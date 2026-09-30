/**
 * Modul: publik-lacak.js
 * Deskripsi: Pelacakan status bansos real-time, cetak bukti penetapan, dan kartu bansos
 */

// 6. LACAK STATUS BANSOS REAL-TIME
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
                    <div style="grid-column: span 2; background:${(d.status_salur === 'Telah Menerima' || d.konfirmasi_warga) ? '#eff6ff' : ((d.status_salur === 'Disalurkan' || d.bukti_salur) ? '#ecfdf5' : '#f8fafc')}; padding:14px 18px; border-radius:14px; border:1.5px solid ${(d.status_salur === 'Telah Menerima' || d.konfirmasi_warga) ? '#93c5fd' : ((d.status_salur === 'Disalurkan' || d.bukti_salur) ? '#6ee7b7' : '#e2e8f0')};">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <div>
                                <small style="display:block; color:${(d.status_salur === 'Telah Menerima' || d.konfirmasi_warga) ? '#1e40af' : ((d.status_salur === 'Disalurkan' || d.bukti_salur) ? '#065f46' : '#64748b')}; font-size:0.75rem; font-weight:800; text-transform:uppercase; margin-bottom:3px;">STATUS PENYALURAN FISIK LAPANGAN</small>
                                <span style="font-weight:900; color:${(d.status_salur === 'Telah Menerima' || d.konfirmasi_warga) ? '#1d4ed8' : ((d.status_salur === 'Disalurkan' || d.bukti_salur) ? '#059669' : '#334155')}; font-size:1.05rem;">
                                    <i class="fas ${(d.status_salur === 'Telah Menerima' || d.konfirmasi_warga) ? 'fa-check-double text-blue-600' : ((d.status_salur === 'Disalurkan' || d.bukti_salur) ? 'fa-truck text-emerald-600' : 'fa-clock text-amber-500')}"></i>
                                    ${(d.status_salur === 'Telah Menerima' || d.konfirmasi_warga) ? 'Telah Menerima (Dikonfirmasi Sah)' : (d.status_salur === 'Disalurkan' || d.bukti_salur ? 'Sudah Disalurkan' : (d.status_salur || 'Belum Disalurkan'))}
                                </span>
                            </div>
                            <span class="badge" style="background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; font-size:0.75rem; font-weight:800;">
                                <i class="fas fa-box text-success"></i> ${safeHtml(d.nominal_bantuan || 'Beras 10 Kg & BLT')}
                            </span>
                        </div>

                        ${(d.keterangan_salur || d.bukti_salur || d.tanggal_salur) ? `
                            <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #cbd5e1; font-size:0.84rem; color:#334155;">
                                ${d.keterangan_salur ? `<div style="margin-bottom:4px;"><b>Keterangan Petugas:</b> ${safeHtml(d.keterangan_salur)}</div>` : ''}
                                ${d.tanggal_salur && d.tanggal_salur !== '-' ? `<div style="font-size:0.78rem; color:#64748b;"><i class="fas fa-calendar-alt"></i> Waktu Penyaluran: ${safeHtml(d.tanggal_salur)}</div>` : ''}
                                ${d.bukti_salur ? `
                                    <div style="margin-top:8px;">
                                        <a href="/uploads/${d.bukti_salur}" target="_blank" class="btn btn-sm" style="background:#ffffff; border:1px solid #10b981; color:#065f46; font-size:0.75rem; font-weight:800; border-radius:8px; display:inline-flex; align-items:center; gap:6px; text-decoration:none; padding:4px 10px;">
                                            <i class="fas fa-image text-emerald-600"></i> Lihat Foto Bukti Penyerahan
                                        </a>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}

                        ${(d.status_salur === 'Disalurkan' && !d.konfirmasi_warga) ? `
                            <div style="margin-top:12px; background:#fffbeb; border:1px solid #fde68a; padding:10px 14px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                                <div style="font-size:0.82rem; color:#92400e; font-weight:700;">
                                    <i class="fas fa-exclamation-circle text-amber-600"></i> Bantuan telah diserahkan petugas. Apakah Anda sudah menerima fisik bantuan ini?
                                </div>
                                <button type="button" onclick="window.konfirmasiTerimaMandiri('${d.nik}')" class="btn btn-sm" style="background:#10b981; color:white; border:none; border-radius:8px; font-weight:800; padding:6px 14px; font-size:0.8rem; cursor:pointer;">
                                    <i class="fas fa-check-circle"></i> Konfirmasi Diterima
                                </button>
                            </div>
                        ` : ''}
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


// 15. CETAK BUKTI BANSOS & DOKUMEN PENETAPAN WARGA
// =========================================================================
window.cetakBuktiPendaftaran = function () {
    const data = wargaDataCache || window.lastLacakData || sesiWargaAktif;
    if (!data) {
        return showPortalAlert({ icon: 'warning', title: 'Data Kosong', text: 'Silakan masuk atau lacak NIK Anda terlebih dahulu.' });
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Tanda Bukti Terdaftar - Pemkab Sidoarjo</title>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; line-height: 1.6; }
                .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 25px; }
                .header h2 { margin: 0; font-size: 16pt; }
                .header h3 { margin: 4px 0; font-size: 14pt; }
                .content table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                .content td { padding: 8px 12px; border: 1px solid #333; font-size: 11pt; }
                .content td.label { width: 35%; font-weight: bold; background: #f2f2f2; }
                .footer { margin-top: 40px; display: flex; justify-content: flex-end; text-align: center; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="header">
                <h2>PEMERINTAH KABUPATEN SIDOARJO</h2>
                <h3>DINAS SOSIAL</h3>
                <p style="margin:0; font-size:10pt;">Jl. Pahlawan No. 1 Sidoarjo, Jawa Timur | Telp (031) 8921000</p>
            </div>
            <div class="content">
                <h4 style="text-align:center; text-decoration:underline; margin-bottom:15px;">BUKTI PENDAFTARAN & STATUS VERIFIKASI BANSOS</h4>
                <table>
                    <tr><td class="label">Nomor Induk Kependudukan (NIK)</td><td>${safeHtml(data.nik || '-')}</td></tr>
                    <tr><td class="label">Nama Lengkap</td><td>${safeHtml(data.nama_lengkap || data.nama || '-')}</td></tr>
                    <tr><td class="label">Alamat Domisili</td><td>${safeHtml(data.alamat || 'Kabupaten Sidoarjo')}</td></tr>
                    <tr><td class="label">Klasifikasi Desil</td><td>Desil ${safeHtml(data.desil || '5')}</td></tr>
                    <tr><td class="label">Status Penetapan Bansos</td><td>${safeHtml(data.status_bansos || 'Diproses')}</td></tr>
                    <tr><td class="label">Realisasi Penyaluran</td><td>${safeHtml(data.status_salur || 'Pending')}</td></tr>
                </table>
            </div>
            <div class="footer">
                <div>
                    <p>Sidoarjo, ${new Date().toLocaleDateString('id-ID')}</p>
                    <br><br><br>
                    <p><b>Petugas Verifikator Dinsos</b></p>
                </div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
};
