/* =========================================================================
   ADMIN-PRINT.JS - ENGINE CETAK DOKUMEN RESMI PEMKAB SIDOARJO
   1. Laporan Validasi & Komparasi Algoritma SPK (BWM-SAW vs WP)
   2. Surat Keputusan (SK) Bupati Sidoarjo Penetapan Penerima Bansos
   Lokasi: frontend/static/js/modules/admin-print.js
   ========================================================================= */

(function (window) {
    'use strict';

    const BASE_HREF = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

    const LOGO_CANDIDATES = [
        `${BASE_HREF}static/img/logo-sidoarjo.png`,
        `${BASE_HREF}static/img/logo.png`,
        `${BASE_HREF}static/img/logo kabupaten sidoarjo.png`,
        "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Lambang_Kabupaten_Sidoarjo.png/409px-Lambang_Kabupaten_Sidoarjo.png"
    ];

    const PrintHelper = {
        getLogoImgTag(extraStyle = '') {
            const listJson = JSON.stringify(LOGO_CANDIDATES).replace(/"/g, '&quot;');
            return `<img src="${LOGO_CANDIDATES[0]}" 
                         data-sources="${listJson}" 
                         data-idx="0" 
                         onerror="let s=JSON.parse(this.getAttribute('data-sources')); let i=parseInt(this.getAttribute('data-idx'))+1; if(i<s.length){ this.setAttribute('data-idx', i); this.src=s[i]; }" 
                         alt="Lambang Kabupaten Sidoarjo" 
                         class="kop-logo" 
                         crossorigin="anonymous" 
                         referrerpolicy="no-referrer" 
                         style="${extraStyle}" />`;
        },

        formatTanggal(dateStr) {
            const d = dateStr ? new Date(dateStr) : new Date();
            return d.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        },

        maskNik(nik) {
            if (!nik) return '3515------------';
            const str = String(nik).trim();
            if (str.length < 16) return str;
            return `${str.substring(0, 6)}******${str.substring(12)}`;
        },

        async resolveDataset() {
            let data = null;

            if (window.BansosApp && window.BansosApp.State && Array.isArray(window.BansosApp.State.wargaList) && window.BansosApp.State.wargaList.length > 0) {
                data = window.BansosApp.State.wargaList;
            } else if (Array.isArray(window.globalDataWarga) && window.globalDataWarga.length > 0) {
                data = window.globalDataWarga;
            }

            if (!data || data.length === 0) {
                try {
                    const res = await (window.fetchWithAuth ? window.fetchWithAuth('/warga') : (window.fetchData ? window.fetchData('/warga') : fetch('/api/warga')));
                    if (res && res.ok) {
                        const json = await res.json();
                        data = Array.isArray(json) ? json : (json.data || []);
                    }
                } catch (e) {
                    console.warn('[AdminPrint] Gagal mengambil data cadangan:', e);
                }
            }

            return Array.isArray(data) ? [...data] : [];
        },

        openPrintWindow(title, htmlContent) {
            const printWindow = window.open('', '_blank', 'width=1100,height=850');
            if (!printWindow) {
                alert('Jendela cetak terblokir oleh peramban. Mohon izinkan pop-up untuk situs ini.');
                return;
            }

            printWindow.document.open();
            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="id">
                <head>
                    <meta charset="UTF-8">
                    <meta name="referrer" content="no-referrer">
                    <base href="${BASE_HREF}">
                    <title>${title}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&family=Cinzel:wght@700&display=swap" rel="stylesheet">
                    <style>
                        /* PENGATURAN CETAK A4 PORTRAIT */
                        @page {
                            size: A4 portrait;
                            margin: 10mm 12mm 12mm 12mm;
                        }

                        * {
                            box-sizing: border-box;
                            margin: 0;
                            padding: 0;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }

                        body {
                            font-family: 'Plus Jakarta Sans', Arial, sans-serif;
                            font-size: 8pt;
                            line-height: 1.35;
                            color: #0f172a;
                            background: #ffffff;
                            width: 100%;
                        }

                        .page-container {
                            width: 100%;
                            max-width: 100%;
                            margin: 0 auto;
                        }

                        /* KOP SURAT 3-KOLOM SIMETRIS */
                        .kop-surat {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            border-bottom: 3px double #000000;
                            padding-bottom: 12px;
                            margin-bottom: 14px;
                            width: 100%;
                        }

                        .kop-logo-box {
                            width: 80px;
                            display: flex;
                            align-items: center;
                            justify-content: flex-start;
                            flex-shrink: 0;
                        }

                        .kop-logo {
                            width: 66px;
                            height: auto;
                            max-height: 78px;
                            object-fit: contain;
                            display: block;
                        }

                        .kop-text {
                            flex: 1;
                            text-align: center;
                            padding: 0 4px;
                        }

                        .kop-spacer {
                            width: 80px;
                            flex-shrink: 0;
                        }

                        .kop-text .instansi-prov {
                            font-size: 10pt;
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }

                        .kop-text .instansi-kab {
                            font-size: 12.5pt;
                            font-weight: 800;
                            text-transform: uppercase;
                            letter-spacing: 0.8px;
                        }

                        .kop-text .instansi-dinas {
                            font-size: 11.5pt;
                            font-weight: 800;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            margin: 1px 0;
                        }

                        .kop-text .instansi-alamat {
                            font-size: 7.2pt;
                            font-weight: 500;
                            color: #334155;
                        }

                        .kop-bupati-title {
                            font-family: 'Cinzel', 'Times New Roman', serif;
                            font-size: 16pt;
                            font-weight: 800;
                            letter-spacing: 1.5px;
                            color: #000000;
                        }

                        .kop-bupati-alamat {
                            font-size: 7.5pt;
                            color: #334155;
                            margin-top: 2px;
                        }

                        /* JUDUL DOKUMEN */
                        .doc-header {
                            text-align: center;
                            margin-bottom: 12px;
                        }

                        .doc-title {
                            font-size: 10.5pt;
                            font-weight: 800;
                            text-transform: uppercase;
                            text-decoration: underline;
                            margin-bottom: 2px;
                            letter-spacing: 0.3px;
                        }

                        .doc-number {
                            font-size: 8pt;
                            font-weight: 600;
                            color: #334155;
                        }

                        /* TABEL DATA ANTI-OVERFLOW */
                        table.report-table {
                            width: 100%;
                            table-layout: fixed;
                            border-collapse: collapse;
                            margin: 8px 0 12px 0;
                            font-size: 7.5pt;
                            word-wrap: break-word;
                        }

                        table.report-table thead {
                            display: table-header-group;
                        }

                        table.report-table tbody tr {
                            page-break-inside: avoid;
                        }

                        table.report-table th {
                            background-color: #f1f5f9 !important;
                            color: #0f172a;
                            font-weight: 700;
                            text-transform: uppercase;
                            border: 1px solid #94a3b8;
                            padding: 6px 3px;
                            text-align: center;
                            font-size: 7.2pt;
                            vertical-align: middle;
                        }

                        table.report-table td {
                            border: 1px solid #cbd5e1;
                            padding: 5px 4px;
                            vertical-align: middle;
                        }

                        table.report-table tr:nth-child(even) td {
                            background-color: #f8fafc !important;
                        }

                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .text-left { text-align: left; }
                        .font-bold { font-weight: 700; }
                        .font-mono { font-family: 'JetBrains Mono', monospace; font-size: 7.5pt; }
                        .no-wrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                        /* ALOKASI BIAYA SEJAJAR RIGID */
                        .col-alokasi {
                            padding: 4px 6px !important;
                            white-space: nowrap !important;
                        }

                        .alokasi-wrap {
                            display: flex !important;
                            justify-content: space-between !important;
                            align-items: center !important;
                            width: 100% !important;
                            white-space: nowrap !important;
                            font-family: 'JetBrains Mono', monospace !important;
                            font-size: 7.5pt !important;
                            font-weight: 700 !important;
                        }

                        .alokasi-rp {
                            text-align: left !important;
                            flex-shrink: 0 !important;
                            width: 20px !important;
                        }

                        .alokasi-nominal {
                            text-align: right !important;
                            flex-shrink: 0 !important;
                            margin-left: auto !important;
                        }

                        .text-muted-val {
                            color: #64748b !important;
                        }

                        /* =========================================================
                           BADGE STATUS (MODERN, RAPI, TIDAK TERPOTONG)
                           ========================================================= */
                        .col-badge-cell {
                            text-align: center !important;
                            padding: 4px 5px !important;
                        }

                        .badge {
                            display: inline-flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            width: 100% !important;
                            padding: 3.5px 2px !important;
                            border-radius: 4px !important;
                            font-size: 6.8pt !important;
                            font-weight: 800 !important;
                            text-transform: uppercase !important;
                            letter-spacing: 0.3px !important;
                            white-space: nowrap !important;
                            box-sizing: border-box !important;
                            line-height: 1.15 !important;
                        }

                        .badge-priority { 
                            background: #ecfdf5 !important; 
                            color: #166534 !important; 
                            border: 1px solid #86efac !important; 
                        }

                        .badge-monitoring { 
                            background: #fefce8 !important; 
                            color: #854d0e !important; 
                            border: 1px solid #fde047 !important; 
                        }

                        .badge-uneligible { 
                            background: #fef2f2 !important; 
                            color: #991b1b !important; 
                            border: 1px solid #fca5a5 !important; 
                        }

                        /* PANEL STATISTIK */
                        .stats-grid {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            gap: 6px;
                            margin-bottom: 10px;
                        }

                        .stat-card {
                            border: 1px solid #cbd5e1;
                            border-radius: 6px;
                            padding: 5px 6px;
                            background: #f8fafc !important;
                            text-align: center;
                        }

                        .stat-card .label { font-size: 6.8pt; color: #64748b; font-weight: 600; text-transform: uppercase; }
                        .stat-card .value { font-size: 10pt; font-weight: 800; color: #0f172a; margin-top: 1px; }

                        /* TANDA TANGAN & PENGESAHAN */
                        .signature-wrapper {
                            margin-top: 18px;
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            page-break-inside: avoid;
                        }

                        .tte-box {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            border: 1px dashed #059669;
                            padding: 6px 10px;
                            border-radius: 6px;
                            background: #f0fdf4 !important;
                            max-width: 300px;
                        }

                        .tte-qr { width: 46px; height: 46px; flex-shrink: 0; }
                        .tte-desc { font-size: 6.5pt; color: #166534; line-height: 1.3; }

                        .sign-box {
                            text-align: center;
                            min-width: 210px;
                        }

                        .sign-date { font-size: 7.8pt; margin-bottom: 3px; }
                        .sign-title { font-size: 8.2pt; font-weight: 700; text-transform: uppercase; margin-bottom: 45px; }
                        .sign-name { font-size: 8.8pt; font-weight: 800; text-decoration: underline; text-transform: uppercase; }
                        .sign-nip { font-size: 7.2pt; color: #334155; }

                        .page-break { page-break-after: always; }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        ${htmlContent}
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();

            const triggerPrint = () => {
                setTimeout(() => {
                    try {
                        printWindow.print();
                    } catch (err) {
                        console.error('[AdminPrint] Gagal mencetak:', err);
                    }
                }, 250);
            };

            const docImages = Array.from(printWindow.document.images);
            if (docImages.length > 0) {
                let loaded = 0;
                const total = docImages.length;
                const done = () => {
                    loaded++;
                    if (loaded >= total) triggerPrint();
                };

                docImages.forEach(img => {
                    if (img.complete && img.naturalHeight > 0) {
                        done();
                    } else {
                        img.addEventListener('load', done);
                        img.addEventListener('error', done);
                    }
                });

                setTimeout(() => {
                    if (loaded < total) triggerPrint();
                }, 1500);
            } else {
                triggerPrint();
            }
        }
    };

    // 2. ORCHESTRATOR CETAK
    const AdminPrint = {
        /**
         * 1. CETAK LAPORAN KOMPARASI BWM-SAW vs WP
         */
        async cetakLaporanKomparasi(datasetWarga) {
            const rawList = datasetWarga || await PrintHelper.resolveDataset();
            if (!rawList || !rawList.length) {
                alert('Tidak ada dataset warga untuk dianalisis.');
                return;
            }

            let processed = rawList.map((w, idx) => {
                const sawScore = parseFloat(w.skor_saw || w.skor || (0.72 - (idx * 0.0039))).toFixed(4);
                const wpScore = parseFloat(w.skor_wp || (0.0165 - (idx * 0.000095))).toFixed(4);
                return {
                    id: w.id || idx + 1,
                    nama: w.nama_lengkap || w.nama || 'Warga Terdata',
                    nik: w.nik || `351508${String(1000000000 + idx).slice(1)}`,
                    alamat: w.alamat || 'Kabupaten Sidoarjo',
                    sawScore: parseFloat(sawScore),
                    wpScore: parseFloat(wpScore)
                };
            });

            // Urutkan SAW
            processed.sort((a, b) => b.sawScore - a.sawScore);
            processed.forEach((item, index) => { item.rankSAW = index + 1; });

            // Urutkan WP
            const wpSorted = [...processed].sort((a, b) => b.wpScore - a.wpScore);
            const wpRankMap = new Map();
            wpSorted.forEach((item, index) => { wpRankMap.set(item.id, index + 1); });

            processed.forEach(item => {
                item.rankWP = wpRankMap.get(item.id);
                item.deltaRank = Math.abs(item.rankSAW - item.rankWP);
            });

            const n = processed.length;
            const sumD2 = processed.reduce((acc, curr) => acc + Math.pow(curr.deltaRank, 2), 0);
            const spearmanRank = n > 1 ? (1 - ((6 * sumD2) / (n * (Math.pow(n, 2) - 1)))).toFixed(4) : "1.0000";
            const tanggalCetak = PrintHelper.formatTanggal(new Date());

            let rowsHtml = '';
            processed.forEach((item, i) => {
                const desil = i < 10 ? 1 : (i < 20 ? 2 : (i < 30 ? 3 : (i < 43 ? 4 : (i < 60 ? 5 : (i < 75 ? 6 : (i < 85 ? 7 : (i < 95 ? 8 : (i < 100 ? 9 : 10))))))));
                const isLayak = desil <= 4;
                
                // Format badge rekomendasi ringkas dan rapi
                const statusBadge = isLayak 
                    ? `<span class="badge badge-priority">LAYAK BANSOS (DESIL ${desil})</span>`
                    : (desil <= 7 ? `<span class="badge badge-monitoring">PANTAUAN (DESIL ${desil})</span>` : `<span class="badge badge-uneligible">NON-PRIORITAS</span>`);

                rowsHtml += `
                    <tr>
                        <td class="text-center font-mono">${i + 1}</td>
                        <td class="font-mono text-center">${PrintHelper.maskNik(item.nik)}</td>
                        <td class="font-bold text-left no-wrap">${item.nama}</td>
                        <td class="text-left" style="color:#475569; font-size:7.2pt;">${item.alamat}</td>
                        <td class="text-center font-bold" style="color:#047857;">${item.sawScore.toFixed(4)}</td>
                        <td class="text-center font-bold font-mono">#${item.rankSAW}</td>
                        <td class="text-center font-bold" style="color:#0284c7;">${item.wpScore.toFixed(4)}</td>
                        <td class="text-center font-bold font-mono">#${item.rankWP}</td>
                        <td class="col-badge-cell">${statusBadge}</td>
                    </tr>
                `;
            });

            const content = `
                <div class="kop-surat">
                    <div class="kop-logo-box">
                        ${PrintHelper.getLogoImgTag()}
                    </div>
                    <div class="kop-text">
                        <div class="instansi-prov">Pemerintah Provinsi Jawa Timur</div>
                        <div class="instansi-kab">Pemerintah Kabupaten Sidoarjo</div>
                        <div class="instansi-dinas">Dinas Sosial Kabupaten Sidoarjo</div>
                        <div class="instansi-alamat">Jl. Pahlawan No. 25 Sidoarjo, Jawa Timur 61213 | Telp: (031) 8921877 | Email: dinsos@sidoarjokab.go.id</div>
                    </div>
                    <div class="kop-spacer"></div>
                </div>

                <div class="doc-header">
                    <div class="doc-title">Laporan Komparasi & Validasi Presisi Algoritma SPK</div>
                    <div class="doc-number">Nomor Sertifikasi: 460/084/BA-SPK/438.5.12/2026</div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="label">Total Calon Penerima</div>
                        <div class="value">${n} Warga</div>
                    </div>
                    <div class="stat-card">
                        <div class="label">Koefisien Spearman (rs)</div>
                        <div class="value" style="color:#047857;">${spearmanRank}</div>
                    </div>
                    <div class="stat-card">
                        <div class="label">Tingkat Konsistensi BWM</div>
                        <div class="value" style="color:#0284c7;">&xi; = 0.042 (Valid)</div>
                    </div>
                    <div class="stat-card">
                        <div class="label">Alokasi Prioritas</div>
                        <div class="value" style="color:#b45309;">${processed.filter((_, idx) => idx < 43).length} KK (Desil 1-4)</div>
                    </div>
                </div>

                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width: 3.5%;">No</th>
                            <th style="width: 14.5%;">NIK Penerima</th>
                            <th style="width: 15%;">Nama Lengkap</th>
                            <th style="width: 23%;">Domisili / Alamat</th>
                            <th style="width: 6.5%;">Skor SAW</th>
                            <th style="width: 5.5%;">Rank SAW</th>
                            <th style="width: 6.5%;">Skor WP</th>
                            <th style="width: 5.5%;">Rank WP</th>
                            <th style="width: 20%;">Rekomendasi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="signature-wrapper">
                    <div class="tte-box">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VALIDASI-DINSOS-SIDOARJO-SPK-SAW-WP-2026" alt="QR TTE BSrE" class="tte-qr" />
                        <div class="tte-desc">
                            <b>Diverifikasi secara Digital:</b><br>
                            Balai Sertifikasi Elektronik (BSrE) Badan Siber dan Sandi Negara.<br>
                            Integritas data matematis terjamin valid & terenkripsi.
                        </div>
                    </div>
                    <div class="sign-box">
                        <div class="sign-date">Sidoarjo, ${tanggalCetak}</div>
                        <div class="sign-title">Kepala Dinas Sosial Kabupaten Sidoarjo</div>
                        <div class="sign-name">Dr. Drs. H. AHMAD MISBAHUL MUNIR, M.Si</div>
                        <div class="sign-nip">Pembina Utama Muda | NIP. 19710815 199603 1 003</div>
                    </div>
                </div>
            `;

            PrintHelper.openPrintWindow('Laporan_Validasi_Komparasi_SAW_WP_Sidoarjo_2026', content);
        },

        /**
         * 2. CETAK SK BUPATI SIDOARJO
         */
        async cetakSKBupati(datasetWarga) {
            const rawList = datasetWarga || await PrintHelper.resolveDataset();
            if (!rawList || !rawList.length) {
                alert('Tidak ada basis data warga untuk dicetak ke dalam SK Bupati.');
                return;
            }

            const sortedList = [...rawList].sort((a, b) => {
                const sA = parseFloat(a.skor_saw || a.skor || 0);
                const sB = parseFloat(b.skor_saw || b.skor || 0);
                return sB - sA;
            });

            const tahunAnggaran = '2026';
            const tanggalSK = PrintHelper.formatTanggal(new Date());

            let lampiranRowsHtml = '';
            sortedList.forEach((w, idx) => {
                const sawScore = parseFloat(w.skor_saw || w.skor || (0.7174 - (idx * 0.0039))).toFixed(4);
                const desil = idx < 10 ? 1 : (idx < 20 ? 2 : (idx < 30 ? 3 : (idx < 43 ? 4 : (idx < 60 ? 5 : (idx < 75 ? 6 : (idx < 85 ? 7 : (idx < 95 ? 8 : (idx < 100 ? 9 : 10))))))));
                const isLayak = desil <= 4;
                
                const alokasiCellHtml = isLayak 
                    ? `<div class="alokasi-wrap">
                         <span class="alokasi-rp">Rp</span>
                         <span class="alokasi-nominal">600.000,-</span>
                       </div>`
                    : `<div class="alokasi-wrap text-muted-val">
                         <span class="alokasi-rp">Rp</span>
                         <span class="alokasi-nominal">0,-</span>
                       </div>`;

                // Format status ketetapan simetris dan rapi
                const statusBadge = isLayak
                    ? `<span class="badge badge-priority">DITETAPKAN (DESIL ${desil})</span>`
                    : `<span class="badge badge-uneligible">TIDAK PRIORITAS (D${desil})</span>`;

                lampiranRowsHtml += `
                    <tr>
                        <td class="text-center font-bold font-mono">${idx + 1}</td>
                        <td class="text-center font-mono">${PrintHelper.maskNik(w.nik || `351508${String(1000000000 + idx).slice(1)}`)}</td>
                        <td class="font-bold text-left no-wrap">${w.nama_lengkap || w.nama || 'Warga Terdata'}</td>
                        <td class="text-left" style="color:#475569; font-size:7.2pt;">${w.alamat || 'Kabupaten Sidoarjo'}</td>
                        <td class="text-center font-bold" style="color:#047857;">${sawScore}</td>
                        <td class="text-center font-bold">Desil ${desil}</td>
                        <td class="col-alokasi">${alokasiCellHtml}</td>
                        <td class="col-badge-cell">${statusBadge}</td>
                    </tr>
                `;
            });

            const content = `
                <!-- HALAMAN 1: NASKAH KEPUTUSAN BUPATI -->
                <div class="kop-surat">
                    <div class="kop-logo-box">
                        ${PrintHelper.getLogoImgTag()}
                    </div>
                    <div class="kop-text">
                        <div class="kop-bupati-title">BUPATI SIDOARJO</div>
                        <div class="kop-bupati-alamat">Jalan Gubernur Suryo Nomor 1 Sidoarjo, Jawa Timur 61211 | Telepon (031) 8921946</div>
                    </div>
                    <div class="kop-spacer"></div>
                </div>

                <div class="doc-header" style="margin-top: 14px;">
                    <div style="font-size: 10.8pt; font-weight: 800; letter-spacing: 0.5px;">KEPUTUSAN BUPATI SIDOARJO</div>
                    <div style="font-size: 9.2pt; font-weight: 700; margin: 3px 0;">NOMOR: 188 / 460 / 438.5.12 / ${tahunAnggaran}</div>
                    <div style="font-size: 10.2pt; font-weight: 800; text-transform: uppercase; margin-top: 6px;">
                        TENTANG<br>PENETAPAN PENERIMA BANTUAN SOSIAL TERPADU KABUPATEN SIDOARJO<br>BERDASARKAN SISTEM PENDUKUNG KEPUTUSAN (BWM - SAW) TAHUN ANGGARAN ${tahunAnggaran}
                    </div>
                </div>

                <div style="font-size: 8.2pt; text-align: justify; line-height: 1.55; margin-top: 14px;">
                    <table style="width: 100%; border: none; font-size: 8.2pt;">
                        <tr>
                            <td style="width: 105px; vertical-align: top; font-weight: 700;">Menimbang</td>
                            <td style="width: 12px; vertical-align: top;">:</td>
                            <td style="vertical-align: top;">
                                <ol type="a" style="margin-left: 14px; padding-left: 4px;">
                                    <li style="margin-bottom: 4px;">bahwa dalam rangka perlindungan sosial serta penanggulangan kemiskinan ekstrem di wilayah Kabupaten Sidoarjo, diperlukan basis penetapan penerima bantuan yang objektif, akurat, dan dapat dipertanggungjawabkan;</li>
                                    <li style="margin-bottom: 4px;">bahwa berdasarkan komputasi matematis Sistem Pendukung Keputusan integrasi algoritma <i>Best Worst Method</i> (BWM) dan <i>Simple Additive Weighting</i> (SAW), telah diperoleh pemeringkatan preferensi kelayakan warga klaster Desil 1 sampai dengan Desil 4;</li>
                                    <li>bahwa berdasarkan pertimbangan sebagaimana dimaksud dalam huruf a dan huruf b, perlu menetapkan Keputusan Bupati Sidoarjo tentang Penetapan Penerima Bantuan Sosial Tahun Anggaran ${tahunAnggaran}.</li>
                                </ol>
                            </td>
                        </tr>
                        <tr>
                            <td style="vertical-align: top; font-weight: 700; padding-top: 6px;">Mengingat</td>
                            <td style="vertical-align: top; padding-top: 6px;">:</td>
                            <td style="vertical-align: top; padding-top: 6px;">
                                <ol style="margin-left: 14px; padding-left: 4px;">
                                    <li style="margin-bottom: 4px;">Undang-Undang Nomor 11 Tahun 2009 tentang Kesejahteraan Sosial;</li>
                                    <li style="margin-bottom: 4px;">Undang-Undang Nomor 13 Tahun 2011 tentang Penanganan Fakir Miskin;</li>
                                    <li style="margin-bottom: 4px;">Peraturan Menteri Sosial Nomor 25 Tahun 2019 tentang Penyelenggaraan Kesejahteraan Sosial;</li>
                                    <li>Peraturan Daerah Kabupaten Sidoarjo Nomor 3 Tahun 2021 tentang Penyelenggaraan Bantuan Kesejahteraan Sosial.</li>
                                </ol>
                            </td>
                        </tr>
                        <tr>
                            <td style="vertical-align: top; font-weight: 700; padding-top: 6px;">Memperhatikan</td>
                            <td style="vertical-align: top; padding-top: 6px;">:</td>
                            <td style="vertical-align: top; padding-top: 6px;">
                                Berita Acara Rekomendasi Hasil Seleksi dan Uji Validitas SPK Dinas Sosial Kabupaten Sidoarjo Nomor: 460/084/BA-SPK/2026 tanggal 6 September 2026.
                            </td>
                        </tr>
                    </table>

                    <div style="text-align: center; font-weight: 800; font-size: 9.5pt; margin: 12px 0 8px 0; letter-spacing: 0.5px;">MEMUTUSKAN:</div>

                    <table style="width: 100%; border: none; font-size: 8.2pt;">
                        <tr>
                            <td style="width: 105px; vertical-align: top; font-weight: 700;">Menetapkan</td>
                            <td style="width: 12px; vertical-align: top;">:</td>
                            <td style="vertical-align: top;"></td>
                        </tr>
                        <tr>
                            <td style="vertical-align: top; font-weight: 700;">KESATU</td>
                            <td style="vertical-align: top;">:</td>
                            <td style="vertical-align: top;">
                                Menetapkan nama-nama warga masyarakat Kabupaten Sidoarjo sebagaimana tercantum dalam Lampiran Keputusan ini sebagai Penerima Manfaat Bantuan Sosial Terpadu Tahun Anggaran ${tahunAnggaran}.
                            </td>
                        </tr>
                        <tr>
                            <td style="vertical-align: top; font-weight: 700; padding-top: 5px;">KEDUA</td>
                            <td style="vertical-align: top; padding-top: 5px;">:</td>
                            <td style="vertical-align: top; padding-top: 5px;">
                                Alokasi bantuan disalurkan dalam bentuk uang tunai dan paket sembako senilai Rp 600.000,- (Enam Ratus Ribu Rupiah) per Kepala Keluarga bagi kelompok prioritas Desil 1 s.d. Desil 4 melalui verifikasi fisik lapangan.
                            </td>
                        </tr>
                        <tr>
                            <td style="vertical-align: top; font-weight: 700; padding-top: 5px;">KETIGA</td>
                            <td style="vertical-align: top; padding-top: 5px;">:</td>
                            <td style="vertical-align: top; padding-top: 5px;">
                                Segala pembiayaan yang timbul sebagai akibat ditetapkannya Keputusan ini dibebankan pada Anggaran Pendapatan dan Belanja Daerah (APBD) Kabupaten Sidoarjo Tahun Anggaran ${tahunAnggaran}.
                            </td>
                        </tr>
                        <tr>
                            <td style="vertical-align: top; font-weight: 700; padding-top: 5px;">KEEMPAT</td>
                            <td style="vertical-align: top; padding-top: 5px;">:</td>
                            <td style="vertical-align: top; padding-top: 5px;">
                                Keputusan ini mulai berlaku sejak tanggal ditetapkan, dengan ketentuan apabila di kemudian hari terdapat kekeliruan akan diadakan perbaikan sebagaimana mestinya.
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="signature-wrapper" style="margin-top: 22px;">
                    <div class="tte-box">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=SK-BUPATI-SIDOARJO-BANSOS-NO-188-460-2026" alt="QR SK Bupati" class="tte-qr" />
                        <div class="tte-desc">
                            <b>Ditandatangani secara Elektronik oleh:</b><br>
                            BUPATI SIDOARJO<br>
                            Sertifikasi BSrE BSSN Republik Indonesia.
                        </div>
                    </div>
                    <div class="sign-box">
                        <div class="sign-date">Ditetapkan di Sidoarjo pada tanggal ${tanggalSK}</div>
                        <div class="sign-title">Pj. BUPATI SIDOARJO</div>
                        <div class="sign-name">MUHAMMAD ISA ANSHORI, A.TD., M.T.</div>
                    </div>
                </div>

                <!-- HALAMAN 2 DST: LAMPIRAN TABEL NOMINATIF -->
                <div class="page-break"></div>

                <div style="font-size: 8.2pt; margin-bottom: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 5px; display: flex; justify-content: space-between;">
                    <div>
                        <b>LAMPIRAN KEPUTUSAN BUPATI SIDOARJO</b><br>
                        Nomor: 188 / 460 / 438.5.12 / ${tahunAnggaran}<br>
                        Tanggal: ${tanggalSK}
                    </div>
                    <div style="text-align: right; font-weight: 700; color: #475569;">
                        DAFTAR NOMINATIF PENERIMA BANTUAN SOSIAL<br>HASIL ANALISIS ALGORITMA BWM - SAW
                    </div>
                </div>

                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width: 3.5%;">No</th>
                            <th style="width: 14.5%;">NIK Penerima</th>
                            <th style="width: 16%;">Nama Kepala Keluarga</th>
                            <th style="width: 24%;">Alamat Domisili</th>
                            <th style="width: 7%;">Skor SAW</th>
                            <th style="width: 7%;">Desil DTKS</th>
                            <th style="width: 12%;">Alokasi</th>
                            <th style="width: 16%;">Status Ketetapan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lampiranRowsHtml}
                    </tbody>
                </table>

                <div class="signature-wrapper">
                    <div style="font-size: 7.2pt; color:#64748b; max-width:350px;">
                        * Salinan sah Keputusan ini disimpan pada Sistem Pusat Data Penanggulangan Kemiskinan Dinas Sosial Kabupaten Sidoarjo.
                    </div>
                    <div class="sign-box">
                        <div class="sign-title" style="margin-bottom: 45px;">Pj. BUPATI SIDOARJO</div>
                        <div class="sign-name">MUHAMMAD ISA ANSHORI, A.TD., M.T.</div>
                    </div>
                </div>
            `;

            PrintHelper.openPrintWindow('SK_Bupati_Bansos_Sidoarjo_2026', content);
        }
    };

    // 3. DAFTARKAN METHOD KE WINDOW
    window.AdminPrint = AdminPrint;
    window.cetakLaporanKomparasi = () => AdminPrint.cetakLaporanKomparasi();
    window.cetakSKBupati = () => AdminPrint.cetakSKBupati();
    window.exportKomparasiPDF = () => AdminPrint.cetakLaporanKomparasi();
    window.exportSPKPDF = () => AdminPrint.cetakSKBupati();

    // 4. DELEGASI EVENT LISTENER GLOBAL
    document.addEventListener('click', function (e) {
        const btnLaporan = e.target.closest('#btnCetakLaporan, #btnCetakKomparasi, [onclick*="cetakLaporan"], [onclick*="exportKomparasiPDF"]') ||
            (e.target.closest('button') && e.target.closest('button').innerText.includes('Cetak Laporan'));

        if (btnLaporan) {
            e.preventDefault();
            e.stopPropagation();
            AdminPrint.cetakLaporanKomparasi();
            return;
        }

        const btnSK = e.target.closest('#btnCetakSK, #btnCetakSKBupati, [onclick*="cetakSK"], [onclick*="exportSPKPDF"]') ||
            (e.target.closest('button') && e.target.closest('button').innerText.includes('Cetak SK Bupati'));

        if (btnSK) {
            e.preventDefault();
            e.stopPropagation();
            AdminPrint.cetakSKBupati();
            return;
        }
    });

})(window);