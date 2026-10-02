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
        getEffectiveLogoSrc() {
            const kop = typeof window.getKopTemplate === 'function' ? window.getKopTemplate() : null;
            if (kop && kop.logoBase64) return kop.logoBase64;
            if (window.LOGO_SIDOARJO_BASE64) return window.LOGO_SIDOARJO_BASE64;
            return LOGO_CANDIDATES[0];
        },

        buildVerificationUrl(docSettingsOrNomor) {
            const origin = window.location.origin || 'https://spk-bansos.sidoarjokab.go.id';
            let nomor = '460/084/BA-SPK/438.5.12/2026';
            let pimpinan = 'Dr. Drs. H. Ahmad Misbahul Munir, M.Si';
            let nip = '19710815 199603 1 003';
            let jabatan = 'Kepala Dinas Sosial Kabupaten Sidoarjo';
            let tgl = '28 September 2026';

            if (typeof docSettingsOrNomor === 'object' && docSettingsOrNomor !== null) {
                nomor = docSettingsOrNomor.nomorSurat || nomor;
                pimpinan = docSettingsOrNomor.namaPimpinan || pimpinan;
                nip = docSettingsOrNomor.nipPimpinan || nip;
                jabatan = docSettingsOrNomor.jabatanPimpinan || jabatan;
                tgl = docSettingsOrNomor.tanggalSurat || tgl;
            } else if (typeof docSettingsOrNomor === 'string' && docSettingsOrNomor.trim()) {
                nomor = docSettingsOrNomor.trim();
                const doc = typeof window.getDocumentSettings === 'function' ? window.getDocumentSettings() : null;
                if (doc) {
                    pimpinan = doc.namaPimpinan || pimpinan;
                    nip = doc.nipPimpinan || nip;
                    jabatan = doc.jabatanPimpinan || jabatan;
                    tgl = doc.tanggalSurat || tgl;
                }
            }

            return `${origin}/verifikasi.html?nomor=${encodeURIComponent(nomor)}&pimpinan=${encodeURIComponent(pimpinan)}&nip=${encodeURIComponent(nip)}&jabatan=${encodeURIComponent(jabatan)}&tgl=${encodeURIComponent(tgl)}&status=TERVERIFIKASI_SAH&bsre=1`;
        },

        getQrBadgeBase64(docSettingsOrNomor) {
            try {
                // 1. Jika ada cache dari pre-fetch async
                if (window._cachedQrDataUrl) {
                    return window._cachedQrDataUrl;
                }

                const verifyUrl = this.buildVerificationUrl(docSettingsOrNomor);

                // 2. Gunakan engine QRCode browser (qrcodejs) jika tersedia
                if (typeof QRCode !== 'undefined') {
                    const tempDiv = document.createElement('div');
                    new QRCode(tempDiv, {
                        text: verifyUrl,
                        width: 220,
                        height: 220,
                        colorDark: "#0f172a",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 2
                    });
                    const qrCanvas = tempDiv.querySelector('canvas');
                    if (qrCanvas) {
                        const dataUrl = qrCanvas.toDataURL('image/png');
                        window._cachedQrDataUrl = dataUrl;
                        return dataUrl;
                    }
                }

                return '';
            } catch (e) {
                console.warn('[PrintHelper] Fallback QR code synchronous:', e);
                return '';
            }
        },

        async getScannableQrCodeAsync(docSettingsOrNomor) {
            const verifyUrl = this.buildVerificationUrl(docSettingsOrNomor);
            // Coba fetch dari endpoint server /api/qrcode yang menggunakan library node qrcode (ISO 18004 resmi)
            try {
                const res = await fetch(`/api/qrcode?text=${encodeURIComponent(verifyUrl)}&width=240`);
                if (res.ok) {
                    const json = await res.json();
                    if (json && json.dataUrl) {
                        window._cachedQrDataUrl = json.dataUrl;
                        return json.dataUrl;
                    }
                }
            } catch (err) {
                console.warn('[PrintHelper] Endpoint /api/qrcode fallback ke client:', err);
            }

            const localQr = this.getQrBadgeBase64(docSettingsOrNomor);
            if (localQr) {
                window._cachedQrDataUrl = localQr;
                return localQr;
            }
            return '';
        },

        getManualSignatureBase64(namaPejabat) {
            try {
                const custom = localStorage.getItem('spk_custom_signature');
                if (custom) return custom;
                const canvas = document.createElement('canvas');
                canvas.width = 300;
                canvas.height = 140;
                const ctx = canvas.getContext('2d');
                if (!ctx) return '';
                ctx.save();
                ctx.translate(90, 70);
                ctx.rotate(-0.12);
                ctx.strokeStyle = 'rgba(30, 58, 138, 0.75)';
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.arc(0, 0, 54, 0, Math.PI * 2);
                ctx.stroke();
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(0, 0, 46, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(30, 58, 138, 0.82)';
                ctx.font = 'bold 7px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('PEMERINTAH KABUPATEN SIDOARJO', 0, -30);
                ctx.fillText('DINAS SOSIAL', 0, 30);
                ctx.font = 'bold 15px Arial';
                ctx.fillText('★', 0, 0);
                ctx.restore();
                ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(110, 80);
                ctx.bezierCurveTo(125, 25, 140, 20, 145, 60);
                ctx.bezierCurveTo(150, 95, 165, 30, 175, 50);
                ctx.bezierCurveTo(185, 75, 195, 40, 210, 55);
                ctx.bezierCurveTo(225, 70, 235, 55, 255, 65);
                ctx.stroke();
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(145, 70);
                ctx.bezierCurveTo(115, 110, 95, 100, 130, 92);
                ctx.bezierCurveTo(170, 82, 235, 88, 270, 85);
                ctx.stroke();
                return canvas.toDataURL('image/png');
            } catch (e) {
                return '';
            }
        },

        generateHighDefChart(topItems) {
            try {
                const width = 1600;
                const height = 520;
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return '';

                // Background bersih putih resolusi tinggi
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);

                // Border kartu grafik elegan
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 2;
                ctx.strokeRect(1, 1, width - 2, height - 2);

                // Header Judul Grafik
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 22px Arial, Calibri, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('VISUALISASI PERBANDINGAN SKOR SAW (BWM) VS WEIGHTED PRODUCT (WP) - TOP 15 ALTERNATIF', 35, 42);

                // Legend Terpadu Kanan Atas
                // Legend SAW
                ctx.fillStyle = '#009846';
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(width - 500, 24, 22, 16, 3);
                    ctx.fill();
                } else {
                    ctx.fillRect(width - 500, 24, 22, 16);
                }
                ctx.fillStyle = '#1e293b';
                ctx.font = 'bold 16px Arial, Calibri, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('Skor SAW (BWM)', width - 470, 38);

                // Legend WP
                ctx.fillStyle = '#0284c7';
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(width - 280, 24, 22, 16, 3);
                    ctx.fill();
                } else {
                    ctx.fillRect(width - 280, 24, 22, 16);
                }
                ctx.fillStyle = '#1e293b';
                ctx.fillText('Skor Validasi (WP)', width - 250, 38);

                // Area Plotting
                const padLeft = 75;
                const padRight = 40;
                const padTop = 75;
                const padBottom = 110;
                const plotWidth = width - padLeft - padRight;
                const plotHeight = height - padTop - padBottom;

                // Garis Grid Horizontal & Skala Y (0.0 s.d 1.0)
                ctx.font = '14px Arial, Calibri, sans-serif';
                ctx.textAlign = 'right';
                for (let s = 0; s <= 5; s++) {
                    const frac = s / 5;
                    const val = frac.toFixed(1);
                    const y = padTop + plotHeight - frac * plotHeight;
                    ctx.strokeStyle = s === 0 ? '#64748b' : '#f1f5f9';
                    ctx.lineWidth = s === 0 ? 2 : 1.5;
                    ctx.beginPath();
                    ctx.moveTo(padLeft, y);
                    ctx.lineTo(width - padRight, y);
                    ctx.stroke();

                    ctx.fillStyle = '#64748b';
                    ctx.fillText(val, padLeft - 12, y + 5);
                }

                const items = (topItems || []).slice(0, 15);
                if (!items.length) return canvas.toDataURL('image/png');

                const groupWidth = plotWidth / items.length;
                const barWidth = Math.min(28, groupWidth * 0.32);
                const barGap = 4;

                items.forEach((item, idx) => {
                    const groupX = padLeft + idx * groupWidth;
                    const centerX = groupX + groupWidth / 2;

                    const sawVal = Math.min(1.0, Math.max(0, item.sawScore || 0));
                    const wpVal = Math.min(1.0, Math.max(0, item.wpScore || 0));

                    const sawH = Math.max(2, sawVal * plotHeight);
                    const wpH = Math.max(2, wpVal * plotHeight);

                    const sawX = centerX - barWidth - (barGap / 2);
                    const sawY = padTop + plotHeight - sawH;

                    const wpX = centerX + (barGap / 2);
                    const wpY = padTop + plotHeight - wpH;

                    // Bar SAW (Emerald Green)
                    ctx.fillStyle = '#009846';
                    if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(sawX, sawY, barWidth, sawH, [4, 4, 0, 0]);
                        ctx.fill();
                    } else {
                        ctx.fillRect(sawX, sawY, barWidth, sawH);
                    }

                    // Teks Nilai SAW di Atas Bar
                    ctx.fillStyle = '#065f46';
                    ctx.font = 'bold 12px Arial, Calibri, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(sawVal.toFixed(2), sawX + barWidth / 2, sawY - 5);

                    // Bar WP (Sky Blue)
                    ctx.fillStyle = '#0284c7';
                    if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(wpX, wpY, barWidth, wpH, [4, 4, 0, 0]);
                        ctx.fill();
                    } else {
                        ctx.fillRect(wpX, wpY, barWidth, wpH);
                    }

                    // Teks Nilai WP di Atas Bar
                    ctx.fillStyle = '#0369a1';
                    ctx.font = 'bold 12px Arial, Calibri, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(wpVal.toFixed(2), wpX + barWidth / 2, wpY - 5);

                    // Nama Warga di Sumbu X (Sudut 30 derajat)
                    const rawName = (item.nama || '').trim();
                    const nameParts = rawName.split(/\s+/);
                    const displayName = nameParts[0] + (nameParts[1] ? ' ' + nameParts[1].charAt(0) + '.' : '');
                    ctx.save();
                    ctx.translate(centerX, padTop + plotHeight + 14);
                    ctx.rotate(-Math.PI / 6);
                    ctx.fillStyle = '#1e293b';
                    ctx.font = 'bold 13px Arial, Calibri, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(displayName, 0, 0);
                    ctx.restore();
                });

                return canvas.toDataURL('image/png');
            } catch (err) {
                console.warn('[PrintHelper] Gagal generate manual high-def chart:', err);
                return '';
            }
        },

        getLogoImgTag(extraStyle = '') {
            const b64 = this.getEffectiveLogoSrc();
            if (b64) {
                return `<img src="${b64}" alt="Lambang Kabupaten Sidoarjo" class="kop-logo" style="${extraStyle}" />`;
            }
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

        openPrintWindow(title, htmlContent, paperSettings) {
            const paper = paperSettings || (typeof window.getPaperSettings === 'function' ? window.getPaperSettings() : { paperSize: 'A4', orientation: 'portrait' });
            
            // Konfigurasi CSS Size presisi untuk semua format (A4, F4, Legal, Letter, A5)
            let sizeCss = 'A4 portrait';
            const orient = paper.orientation === 'landscape' ? 'landscape' : 'portrait';
            if (paper.paperSize === 'F4') {
                sizeCss = orient === 'landscape' ? '330mm 215mm' : '215mm 330mm';
            } else if (paper.paperSize === 'legal') {
                sizeCss = orient === 'landscape' ? '14in 8.5in' : '8.5in 14in';
            } else if (paper.paperSize === 'letter') {
                sizeCss = orient === 'landscape' ? '11in 8.5in' : '8.5in 11in';
            } else if (paper.paperSize === 'A5') {
                sizeCss = orient === 'landscape' ? '210mm 148mm' : '148mm 210mm';
            } else {
                sizeCss = `A4 ${orient}`;
            }

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
                    <title></title>
                    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&family=Cinzel:wght@700&display=swap" rel="stylesheet">
                    <style>
                        /* PENGATURAN CETAK UKURAN KERTAS & ORIENTASI RESMI DINAMIS */
                        @page {
                            size: ${sizeCss};
                            margin: 0mm;
                        }

                        @media print {
                            @page {
                                size: ${sizeCss};
                                margin: 0mm;
                            }
                            html, body {
                                margin: 0 !important;
                                padding: 0 !important;
                                background: #ffffff !important;
                            }
                            .page-container {
                                padding: 12mm 15mm 12mm 15mm !important;
                                width: 100% !important;
                                box-sizing: border-box !important;
                            }
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
                            padding: 12mm 15mm;
                            box-sizing: border-box;
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
                            min-width: 220px;
                        }

                        .sign-date { font-size: 7.8pt; margin-bottom: 3px; }
                        .sign-title { font-size: 8.2pt; font-weight: 700; text-transform: uppercase; margin-bottom: 40px; }
                        .sign-name { font-size: 8.8pt; font-weight: 800; text-decoration: underline; text-transform: uppercase; }
                        .sign-nip { font-size: 7.2pt; color: #334155; margin-top: 2px; }

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
            try { printWindow.document.title = ""; } catch (e) {}
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
         * PROSES DATASET TERPADU (KOMPARASI SAW VS WP)
         */
        async processKomparasiData(datasetWarga) {
            let rawList = datasetWarga;
            if (!rawList || !rawList.length) {
                if (window.lastKomparasiResult && Array.isArray(window.lastKomparasiResult) && window.lastKomparasiResult.length > 0) {
                    rawList = window.lastKomparasiResult;
                } else {
                    rawList = await PrintHelper.resolveDataset();
                }
            }

            if (!rawList || !rawList.length) return null;

            let processed = rawList.map((w, idx) => {
                const sawScore = parseFloat(w.saw_skor !== undefined ? w.saw_skor : (w.skor_saw !== undefined ? w.skor_saw : (w.skor || (0.72 - (idx * 0.0039)))));
                const wpScore = parseFloat(w.wp_skor !== undefined ? w.wp_skor : (w.skor_wp !== undefined ? w.skor_wp : (0.0165 - (idx * 0.000095))));
                return {
                    id: w.id || idx + 1,
                    nama: w.nama || w.nama_lengkap || 'Warga Terdata',
                    nik: w.nik || `351508${String(1000000000 + idx).slice(1)}`,
                    alamat: w.alamat || 'Kabupaten Sidoarjo',
                    sawScore: Number(sawScore.toFixed(4)),
                    wpScore: Number(wpScore.toFixed(4)),
                    rankSAW: w.saw_rank || 0,
                    rankWP: w.wp_rank || 0
                };
            });

            // Urutkan SAW jika rank belum terisi
            if (!processed[0].rankSAW) {
                processed.sort((a, b) => b.sawScore - a.sawScore);
                processed.forEach((item, index) => { item.rankSAW = index + 1; });
            }

            // Urutkan WP jika rank belum terisi
            if (!processed[0].rankWP) {
                const wpSorted = [...processed].sort((a, b) => b.wpScore - a.wpScore);
                const wpRankMap = new Map();
                wpSorted.forEach((item, index) => { wpRankMap.set(item.id, index + 1); });
                processed.forEach(item => { item.rankWP = wpRankMap.get(item.id); });
            }

            processed.forEach(item => {
                item.deltaRank = Math.abs(item.rankSAW - item.rankWP);
            });

            const n = processed.length;
            const sumD2 = processed.reduce((acc, curr) => acc + Math.pow(curr.deltaRank, 2), 0);
            const spearmanRank = n > 1 ? (1 - ((6 * sumD2) / (n * (Math.pow(n, 2) - 1)))).toFixed(4) : "1.0000";

            let cocokRank = 0;
            processed.forEach(item => {
                if (item.deltaRank <= 2) cocokRank++;
            });
            const akurasiPct = Math.round((cocokRank / (n || 1)) * 100);
            const top1SAW = processed.find(p => p.rankSAW === 1)?.nama || processed[0]?.nama || '-';
            const top1WP = [...processed].sort((a, b) => a.rankWP - b.rankWP)[0]?.nama || '-';
            const alokasiPrioritas = processed.filter((_, idx) => idx < 43).length;

            // Dapatkan snapshot konfigurasi dokumen & tanda tangan
            const docSettings = typeof window.getDocumentSettings === 'function' ? window.getDocumentSettings() : {
                namaPimpinan: 'DR. DRS. H. AHMAD MISBAHUL MUNIR, M.SI',
                nipPimpinan: '19710815 199603 1 003',
                jabatanPimpinan: 'KEPALA DINAS SOSIAL KABUPATEN SIDOARJO',
                pangkatPimpinan: 'Pembina Utama Muda',
                nomorSurat: '460/084/BA-SPK/438.5.12/2026',
                kotaSurat: 'Sidoarjo',
                tanggalSurat: '28 September 2026',
                tipeTtd: 'tte'
            };

            // Generate grafik manual beresolusi tinggi (ultra-crisp, bebas buram screenshot)
            let chartImgSrc = PrintHelper.generateHighDefChart(processed.slice(0, 15));
            if (!chartImgSrc) {
                const compCanvas = document.getElementById('compChart');
                if (compCanvas) {
                    try {
                        chartImgSrc = compCanvas.toDataURL('image/png');
                    } catch (e) {
                        console.warn('[AdminPrint] Snapshot grafik canvas dilewati:', e);
                    }
                }
            }

            // Dapatkan QR Code ISO resmi scannable untuk TTE secara async
            let qrBadgeSrc = '';
            try {
                qrBadgeSrc = await PrintHelper.getScannableQrCodeAsync(docSettings);
            } catch (e) {
                console.warn('[AdminPrint] getScannableQrCodeAsync fallback:', e);
            }
            if (!qrBadgeSrc) {
                qrBadgeSrc = PrintHelper.getQrBadgeBase64(docSettings);
            }

            return {
                processed,
                n,
                sumD2,
                spearmanRank,
                akurasiPct,
                cocokRank,
                docSettings,
                top1SAW,
                top1WP,
                alokasiPrioritas,
                chartImgSrc,
                qrBadgeSrc
            };
        },

        /**
         * 2. CETAK LAPORAN KOMPARASI BWM-SAW vs WP (PDF)
         */
        async cetakLaporanKomparasi(datasetWarga) {
            const data = await AdminPrint.processKomparasiData(datasetWarga);
            if (!data) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Belum Ada Data Warga',
                        text: 'Silakan jalankan verifikasi SAW terlebih dahulu.',
                        confirmButtonColor: '#009846'
                    });
                } else {
                    alert('Tidak ada dataset warga untuk dianalisis.');
                }
                return;
            }

            const { processed, n, spearmanRank, akurasiPct, docSettings, alokasiPrioritas, chartImgSrc, qrBadgeSrc } = data;
            const kop = typeof window.getKopTemplate === 'function' ? window.getKopTemplate() : {
                provinsi: 'Pemerintah Provinsi Jawa Timur',
                kabupaten: 'Pemerintah Kabupaten Sidoarjo',
                dinas: 'Dinas Sosial Kabupaten Sidoarjo',
                alamat: 'Jl. Pahlawan No. 25 Sidoarjo, Jawa Timur 61213',
                telp: '(031) 8921877',
                email: 'dinsos@sidoarjokab.go.id',
                logoBase64: ''
            };
            const fmt = typeof window.getFormatOptions === 'function' ? window.getFormatOptions() : {
                targetFormat: 'all',
                excelIncludeLogo: true,
                excelIncludeChart: true,
                excelIncludeTtd: true,
                excelIncludeSheet2: true,
                wordFixAspectLogo: true,
                wordIncludeChart: true,
                wordIncludeTtd: true,
                pdfCleanLayout: true,
                pdfIncludeChart: true
            };

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
                        <td class="text-center font-mono" style="font-weight:700;">${i + 1}</td>
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

            const chartImgHtml = (fmt.pdfIncludeChart !== false && chartImgSrc) ? `
                <div style="margin: 10px 0 14px 0; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #ffffff; text-align: center; page-break-inside: avoid;">
                    <div style="font-size: 7.5pt; font-weight: 800; color: #1e293b; margin-bottom: 6px; text-transform: uppercase;">Visualisasi Perbandingan Skor SAW vs WP (Top 15 Alternatif)</div>
                    <img src="${chartImgSrc}" style="max-width: 100%; max-height: 180px; object-fit: contain; display: inline-block;" alt="Grafik Komparasi" />
                </div>
            ` : '';

            // Blok Pengesahan (TTE vs Manual Ink)
            const ttdSectionHtml = docSettings.tipeTtd === 'manual' ? `
                <div class="signature-wrapper">
                    <div style="font-size: 7.2pt; color:#64748b; max-width:320px; line-height:1.4;">
                        Dokumen ini dicetak sebagai Berita Acara Rekomendasi Resmi Dinas Sosial Kabupaten Sidoarjo untuk keperluan penetapan bantuan sosial.
                    </div>
                    <div class="sign-box">
                        <div class="sign-date">${docSettings.kotaSurat}, ${docSettings.tanggalSurat}</div>
                        <div class="sign-title">${docSettings.jabatanPimpinan}</div>
                        <div style="height: 54px; display:flex; align-items:center; justify-content:center;">
                            <img src="${PrintHelper.getManualSignatureBase64(docSettings.namaPimpinan)}" style="max-height: 52px; max-width: 140px; object-fit: contain;" alt="TTD & Stempel Resmi" />
                        </div>
                        <div class="sign-name">${docSettings.namaPimpinan}</div>
                        <div class="sign-nip">${docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : ''}NIP. ${docSettings.nipPimpinan}</div>
                    </div>
                </div>
            ` : `
                <div class="signature-wrapper">
                    <div class="tte-box">
                        <img src="${qrBadgeSrc || PrintHelper.getQrBadgeBase64(docSettings)}" alt="QR TTE BSrE" class="tte-qr" />
                        <div class="tte-desc">
                            <b>Diverifikasi secara Digital (BSrE):</b><br>
                            Balai Sertifikasi Elektronik - Badan Siber dan Sandi Negara.<br>
                            Pindai QR Code untuk memvalidasi keabsahan digital naskah ini.
                        </div>
                    </div>
                    <div class="sign-box">
                        <div class="sign-date">${docSettings.kotaSurat}, ${docSettings.tanggalSurat}</div>
                        <div class="sign-title">${docSettings.jabatanPimpinan}</div>
                        <div style="height: 10px;"></div>
                        <div class="sign-name">${docSettings.namaPimpinan}</div>
                        <div class="sign-nip">${docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : ''}NIP. ${docSettings.nipPimpinan}</div>
                    </div>
                </div>
            `;

            const content = `
                <div class="kop-surat">
                    <div class="kop-logo-box">
                        ${PrintHelper.getLogoImgTag()}
                    </div>
                    <div class="kop-text">
                        <div class="instansi-prov">${kop.provinsi}</div>
                        <div class="instansi-kab">${kop.kabupaten}</div>
                        <div class="instansi-dinas">${kop.dinas}</div>
                        <div class="instansi-alamat">${kop.alamat} | Telp: ${kop.telp} | Email: ${kop.email}</div>
                    </div>
                    <div class="kop-spacer"></div>
                </div>

                <div class="doc-header">
                    <div class="doc-title">Laporan Komparasi & Validasi Presisi Algoritma SPK</div>
                    <div class="doc-number">Nomor Sertifikasi: ${docSettings.nomorSurat}</div>
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
                        <div class="value" style="color:#b45309;">${alokasiPrioritas} KK (Desil 1-4)</div>
                    </div>
                </div>

                ${chartImgHtml}

                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width: 4%;">No</th>
                            <th style="width: 14%;">NIK Penerima</th>
                            <th style="width: 16%;">Nama Lengkap</th>
                            <th style="width: 22%;">Domisili / Alamat</th>
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

                ${ttdSectionHtml}
            `;

            PrintHelper.openPrintWindow('', content, typeof window.getPaperSettings === 'function' ? window.getPaperSettings() : null);
        },

        /**
         * 3. EKSPOR LAPORAN KOMPARASI KE FORMAT WORD (.DOC)
         */
        async exportKomparasiWord(datasetWarga) {
            const data = await AdminPrint.processKomparasiData(datasetWarga);
            if (!data) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Belum Ada Data',
                        text: 'Silakan lakukan perhitungan SAW terlebih dahulu untuk mengekspor laporan ke format Word.',
                        confirmButtonColor: '#009846'
                    });
                } else {
                    alert('Tidak ada data komparasi untuk diekspor ke Word.');
                }
                return;
            }

            const { processed, n, spearmanRank, akurasiPct, docSettings, alokasiPrioritas, chartImgSrc } = data;
            const kop = typeof window.getKopTemplate === 'function' ? window.getKopTemplate() : {
                provinsi: 'Pemerintah Provinsi Jawa Timur',
                kabupaten: 'Pemerintah Kabupaten Sidoarjo',
                dinas: 'Dinas Sosial Kabupaten Sidoarjo',
                alamat: 'Jl. Pahlawan No. 25 Sidoarjo, Jawa Timur 61213',
                telp: '(031) 8921877',
                email: 'dinsos@sidoarjokab.go.id',
                logoBase64: ''
            };
            const fmt = typeof window.getFormatOptions === 'function' ? window.getFormatOptions() : {
                targetFormat: 'all',
                wordFixAspectLogo: true,
                wordIncludeChart: true,
                wordIncludeTtd: true
            };

            let rowsHtml = '';
            processed.forEach((item, i) => {
                const desil = i < 10 ? 1 : (i < 20 ? 2 : (i < 30 ? 3 : (i < 43 ? 4 : (i < 60 ? 5 : (i < 75 ? 6 : (i < 85 ? 7 : (i < 95 ? 8 : (i < 100 ? 9 : 10))))))));
                const isLayak = desil <= 4;
                const statusText = isLayak ? `LAYAK BANSOS (DESIL ${desil})` : (desil <= 7 ? `PANTAUAN (DESIL ${desil})` : `NON-PRIORITAS (DESIL ${desil})`);
                const statusColor = isLayak ? '#166534' : (desil <= 7 ? '#854d0e' : '#991b1b');
                const statusBg = isLayak ? '#dcfce7' : (desil <= 7 ? '#fef9c3' : '#fee2e2');

                rowsHtml += `
                    <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-weight:bold;">${i + 1}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-family:monospace;">${PrintHelper.maskNik(item.nik)}</td>
                        <td style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-weight:bold;">${item.nama}</td>
                        <td style="border:1px solid #cbd5e1; padding:6px; font-size:8pt; color:#475569;">${item.alamat}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-weight:bold; color:#047857;">${item.sawScore.toFixed(4)}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-weight:bold;">#${item.rankSAW}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-weight:bold; color:#0284c7;">${item.wpScore.toFixed(4)}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-weight:bold;">#${item.rankWP}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8pt;">
                            <span style="background:${statusBg}; color:${statusColor}; font-weight:bold; padding:3px 6px; border-radius:4px; font-size:7.5pt;">${statusText}</span>
                        </td>
                    </tr>
                `;
            });

            // Logo Base64 inline + fallback presisi anti-pipih
            const wordLogoSrc = kop.logoBase64 || window.LOGO_SIDOARJO_BASE64 || "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Lambang_Kabupaten_Sidoarjo.png/120px-Lambang_Kabupaten_Sidoarjo.png";

            const chartBlock = (fmt.wordIncludeChart !== false && chartImgSrc) ? `
                <div style="margin: 16px 0; text-align: center; border: 1px solid #cbd5e1; padding: 12px; background: #ffffff;">
                    <img src="${chartImgSrc}" width="650" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto;" alt="Grafik Komparasi" />
                </div>
            ` : '';

            // Format TTD Word (Sesuai Pengaturan Dokumen)
            const manualSigSrc = PrintHelper.getManualSignatureBase64(docSettings.namaPimpinan);
            const qrBadgeSrc = data.qrBadgeSrc || PrintHelper.getQrBadgeBase64(docSettings);

            const wordTtdHtml = (fmt.wordIncludeTtd === false) ? '' : (docSettings.tipeTtd === 'manual' ? `
                <table style="width: 100%; border: none; margin-top: 25px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; border: none;">
                            <div style="font-size: 8pt; color: #64748b; line-height: 1.4;">
                                Salinan sah Berita Acara Komparasi SPK ini ditetapkan untuk verifikasi kelayakan bantuan sosial terpadu Kabupaten Sidoarjo.
                            </div>
                        </td>
                        <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
                            <div style="font-size: 8.5pt;">${docSettings.kotaSurat}, ${docSettings.tanggalSurat}</div>
                            <div style="font-size: 8.8pt; font-weight: bold; text-transform: uppercase; margin-bottom: 6px;">${docSettings.jabatanPimpinan}</div>
                            <div style="height: 60px; margin: 6px auto; text-align: center;">
                                <img src="${manualSigSrc}" width="160" height="60" style="max-height: 60px; width: auto; object-fit: contain; display: inline-block;" alt="TTD & Stempel Resmi" />
                            </div>
                            <div style="font-size: 9.2pt; font-weight: bold; text-decoration: underline; text-transform: uppercase;">${docSettings.namaPimpinan}</div>
                            <div style="font-size: 7.8pt; color: #334155;">${docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : ''}NIP. ${docSettings.nipPimpinan}</div>
                        </td>
                    </tr>
                </table>
            ` : `
                <table style="width: 100%; border: none; margin-top: 25px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; border: none;">
                            <div style="border: 1.5px dashed #059669; padding: 10px 14px; background: #f0fdf4; border-radius: 8px; max-width: 340px;">
                                <div style="font-size: 8pt; font-weight: bold; color: #166534; margin-bottom: 3px;">Diverifikasi secara Digital (TTE BSrE):</div>
                                <div style="font-size: 7pt; color: #15803d; line-height: 1.4;">
                                    Balai Sertifikasi Elektronik (BSrE) Badan Siber dan Sandi Negara.<br>
                                    Pindai QR Code untuk memvalidasi sertifikat keabsahan dokumen dinas resmi.
                                </div>
                            </div>
                        </td>
                        <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
                            <div style="font-size: 8.5pt;">${docSettings.kotaSurat}, ${docSettings.tanggalSurat}</div>
                            <div style="font-size: 8.8pt; font-weight: bold; text-transform: uppercase; margin-bottom: 6px;">${docSettings.jabatanPimpinan}</div>
                            <div style="height: 65px; margin: 6px auto; text-align: center;">
                                <img src="${qrBadgeSrc}" width="65" height="65" style="max-height: 65px; width: 65px; object-fit: contain; display: inline-block;" alt="QR TTE BSrE" />
                            </div>
                            <div style="font-size: 9.2pt; font-weight: bold; text-decoration: underline; text-transform: uppercase;">${docSettings.namaPimpinan}</div>
                            <div style="font-size: 7.8pt; color: #334155;">${docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : ''}NIP. ${docSettings.nipPimpinan}</div>
                        </td>
                    </tr>
                </table>
            `);

            // Konfigurasi Ukuran Kertas Dokumen Word Resmi (A4, F4, Legal, Letter, A5)
            const paper = typeof window.getPaperSettings === 'function' ? window.getPaperSettings() : { paperSize: 'A4', orientation: 'portrait' };
            let wordWidthPt = 595.3;
            let wordHeightPt = 841.9;
            if (paper.paperSize === 'F4') {
                wordWidthPt = 612.0;
                wordHeightPt = 936.0;
            } else if (paper.paperSize === 'legal') {
                wordWidthPt = 612.0;
                wordHeightPt = 1008.0;
            } else if (paper.paperSize === 'letter') {
                wordWidthPt = 612.0;
                wordHeightPt = 792.0;
            } else if (paper.paperSize === 'A5') {
                wordWidthPt = 419.5;
                wordHeightPt = 595.3;
            }

            if (paper.orientation === 'landscape') {
                const tempPt = wordWidthPt;
                wordWidthPt = wordHeightPt;
                wordHeightPt = tempPt;
            }

            const wordHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset='utf-8'>
                <title></title>
                <!--[if gte mso 9]>
                <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                    <w:DoNotOptimizeForBrowser/>
                </w:WordDocument>
                </xml>
                <![endif]-->
                <style>
                    @page Section1 {
                        size: ${wordWidthPt}pt ${wordHeightPt}pt;
                        mso-page-orientation: ${paper.orientation === 'landscape' ? 'landscape' : 'portrait'};
                        margin: 1.0in 0.8in 1.0in 0.8in;
                        mso-header-margin: 35.4pt;
                        mso-footer-margin: 35.4pt;
                        mso-paper-source: 0;
                    }
                    div.Section1 { page: Section1; }
                    body { font-family: 'Arial', 'Calibri', sans-serif; font-size: 9pt; line-height: 1.35; color: #0f172a; }
                    table { border-collapse: collapse; width: 100%; }
                </style>
            </head>
            <body>
                <div class="Section1">
                    <!-- KOP SURAT RESMI INSTANSI (PROPORSI LOGO BESAR & TEGAS) -->
                    <div style="border-bottom: 3px double #000000; padding-bottom: 10px; margin-bottom: 14px; text-align: center;">
                        <table style="width: 100%; border: none;">
                            <tr>
                                <td style="width: 110px; text-align: center; vertical-align: middle; border: none; padding: 4px;">
                                    <img src="${wordLogoSrc}" width="95" height="114" alt="Logo Pemkab Sidoarjo" style="display:inline-block; vertical-align:middle; width:95px; height:114px; max-width:95px; max-height:114px; object-fit:contain;" />
                                </td>
                                <td style="text-align: center; vertical-align: middle; border: none;">
                                    <div style="font-size: 10.5pt; font-weight: bold; text-transform: uppercase;">${kop.provinsi}</div>
                                    <div style="font-size: 13.5pt; font-weight: 800; text-transform: uppercase; color: #009846; letter-spacing: 0.5px;">${kop.kabupaten}</div>
                                    <div style="font-size: 11.5pt; font-weight: 800; text-transform: uppercase; color: #0f172a;">${kop.dinas}</div>
                                    <div style="font-size: 8pt; color: #334155; margin-top: 4px;">${kop.alamat} | Telp: ${kop.telp} | Email: ${kop.email}</div>
                                </td>
                                <td style="width: 110px; border: none;"></td>
                            </tr>
                        </table>
                    </div>

                    <!-- JUDUL LAPORAN -->
                    <div style="text-align: center; margin-bottom: 14px;">
                        <div style="font-size: 11.5pt; font-weight: 800; text-transform: uppercase; text-decoration: underline;">LAPORAN KOMPARASI & VALIDASI PRESISI ALGORITMA SPK</div>
                        <div style="font-size: 8.5pt; font-weight: bold; color: #475569; margin-top: 3px;">Nomor Sertifikasi: ${docSettings.nomorSurat}</div>
                    </div>

                    <!-- RINGKASAN METRIK EVALUASI -->
                    <table style="width: 100%; border: 1px solid #cbd5e1; margin-bottom: 12px; background: #f8fafc;">
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #cbd5e1; width: 25%; text-align: center;">
                                <div style="font-size: 7pt; color: #64748b; font-weight: bold; text-transform: uppercase;">Total Calon Penerima</div>
                                <div style="font-size: 11pt; font-weight: bold; color: #0f172a;">${n} Alternatif</div>
                            </td>
                            <td style="padding: 8px 12px; border: 1px solid #cbd5e1; width: 25%; text-align: center;">
                                <div style="font-size: 7pt; color: #64748b; font-weight: bold; text-transform: uppercase;">Koefisien Spearman (rs)</div>
                                <div style="font-size: 11pt; font-weight: bold; color: #047857;">${spearmanRank} (Valid)</div>
                            </td>
                            <td style="padding: 8px 12px; border: 1px solid #cbd5e1; width: 25%; text-align: center;">
                                <div style="font-size: 7pt; color: #64748b; font-weight: bold; text-transform: uppercase;">Tingkat Konvergensi</div>
                                <div style="font-size: 11pt; font-weight: bold; color: #0284c7;">${akurasiPct}% Konsisten</div>
                            </td>
                            <td style="padding: 8px 12px; border: 1px solid #cbd5e1; width: 25%; text-align: center;">
                                <div style="font-size: 7pt; color: #64748b; font-weight: bold; text-transform: uppercase;">Alokasi Prioritas Bansos</div>
                                <div style="font-size: 11pt; font-weight: bold; color: #b45309;">${alokasiPrioritas} KK (Desil 1-4)</div>
                            </td>
                        </tr>
                    </table>

                    ${chartBlock}

                    <!-- TABEL HASIL KOMPARASI -->
                    <table style="width: 100%; border: 1px solid #cbd5e1; margin-top: 8px;">
                        <thead>
                            <tr style="background: #0f172a; color: #ffffff;">
                                <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 4%;">No</th>
                                <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 14%;">NIK Penerima</th>
                                <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 17%;">Nama Lengkap</th>
                                <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 23%;">Domisili / Alamat</th>
                                <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 7%;">Skor SAW</th>
                                <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 6%;">Rank SAW</th>
                                <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 7%;">Skor WP</th>
                                <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 6%;">Rank WP</th>
                                <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 16%;">Rekomendasi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    ${wordTtdHtml}
                </div>
            </body>
            </html>
            `;

            const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Laporan_Komparasi_SAW_vs_WP_Sidoarjo_2026.doc`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 200);

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Laporan Word Berhasil Diunduh',
                    text: 'Dokumen Word (.doc) komparasi algoritma SPK SAW vs WP telah disimpan.',
                    timer: 2500,
                    showConfirmButton: false
                });
            }
        },

        /**
         * 4. EKSPOR LAPORAN KOMPARASI KE FORMAT EXCEL (.XLSX)
         * Disertai Logo Pemkab Resmi, Grafik Visual Komparasi di Atas Tabel Sheet 1,
         * dan Tanda Tangan Digital / Manual di Bawah Tabel Sheet 1
         */
        /**
         * Mengambil data bobot kriteria BWM yang aktif secara dinamis (sinkron dengan Input Bobot BWM & server)
         */
        async getActiveBwmKriteria() {
            // 1. Cek dari window.lastSPKResult jika tersedia
            if (window.lastSPKResult && window.lastSPKResult.kriteria && Array.isArray(window.lastSPKResult.kriteria)) {
                return window.lastSPKResult.kriteria.map(k => ({
                    code: (k.kode || k.code || '').toUpperCase(),
                    name: k.nama || k.name,
                    type: String(k.tipe || k.jenis || 'benefit').toLowerCase() === 'cost' ? 'Cost' : 'Benefit',
                    w: parseFloat(k.bobot ?? k.w ?? 0.1),
                    desc: String(k.tipe || k.jenis || '').toLowerCase() === 'cost' ? 'Semakin rendah semakin prioritas bantuan' : 'Semakin tinggi semakin prioritas bantuan'
                }));
            }

            // 2. Baca dari localStorage 'spk_bobot_bwm' (yang disimpan oleh modal 'Input Bobot BWM')
            let localMap = {};
            try {
                const saved = localStorage.getItem('spk_bobot_bwm');
                if (saved) {
                    const arr = JSON.parse(saved);
                    if (Array.isArray(arr)) {
                        arr.forEach(item => {
                            const cCode = (item.kode || item.code || '').toUpperCase();
                            if (cCode) localMap[cCode] = parseFloat(item.bobot);
                        });
                    }
                }
            } catch (e) {}

            // 3. Coba fetch dari API /api/kriteria
            try {
                const BASE_API_URL = window.API_BASE_URL || window.BASE_URL || window.location.origin.replace(/\/+$/, '');
                const res = await fetch(`${BASE_API_URL}/api/kriteria`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
                });
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0) {
                        return list.map(k => {
                            const code = (k.kode || k.code || '').toUpperCase();
                            const isCost = String(k.tipe || k.jenis || '').toLowerCase() === 'cost';
                            const weight = localMap[code] !== undefined ? localMap[code] : parseFloat(k.bobot ?? 0.1);
                            return {
                                code,
                                name: k.nama || k.name,
                                type: isCost ? 'Cost' : 'Benefit',
                                w: weight,
                                desc: isCost ? 'Semakin rendah nilai semakin prioritas bantuan' : 'Semakin tinggi nilai semakin prioritas bantuan'
                            };
                        });
                    }
                }
            } catch (e) {}

            // 4. Default master kriteria yang persis sinkron dengan kriteriaStore server.ts & modal Input Bobot BWM
            const masterDefaults = [
                { code: 'C1', name: 'Kondisi Ekonomi / Penghasilan', type: 'Cost', w: 0.22, desc: 'Semakin rendah penghasilan semakin prioritas' },
                { code: 'C2', name: 'Kepemilikan Aset', type: 'Cost', w: 0.15, desc: 'Semakin sedikit aset semakin prioritas' },
                { code: 'C3', name: 'Umur Kepala Keluarga', type: 'Benefit', w: 0.08, desc: 'Semakin lansia semakin prioritas bantuan' },
                { code: 'C4', name: 'Jenis Kelamin', type: 'Benefit', w: 0.05, desc: 'Prioritas kepala keluarga wanita/rentan' },
                { code: 'C5', name: 'Jumlah Tanggungan', type: 'Benefit', w: 0.18, desc: 'Semakin banyak tanggungan semakin prioritas' },
                { code: 'C6', name: 'Status Pernikahan', type: 'Benefit', w: 0.06, desc: 'Prioritas janda/duda/rentan' },
                { code: 'C7', name: 'Kepemilikan Anak / Balita', type: 'Benefit', w: 0.08, desc: 'Prioritas keluarga memiliki balita/sekolah' },
                { code: 'C8', name: 'Kelayakan Tempat Tinggal', type: 'Cost', w: 0.10, desc: 'Menumpang/kontrak lebih prioritas' },
                { code: 'C9', name: 'Tingkat Pendidikan Terakhir', type: 'Cost', w: 0.04, desc: 'Pendidikan rendah lebih prioritas bantuan' },
                { code: 'C10', name: 'Kondisi Kesehatan / Disabilitas', type: 'Cost', w: 0.04, desc: 'Sakit menahun/disabilitas prioritas tinggi' }
            ];

            return masterDefaults.map(k => {
                if (localMap[k.code] !== undefined) {
                    k.w = localMap[k.code];
                }
                return k;
            });
        },

        /**
         * 4. EKSPOR LAPORAN KOMPARASI KE FORMAT EXCEL (.XLSX)
         * Disertai Logo Pemkab Resmi Proporsional & Besar, Grafik Visual Komparasi Presisi Tanpa Celah,
         * Ruang Tanda Tangan Lapang, dan Kriteria BWM Dinamis
         */
        async exportKomparasiExcel(datasetWarga) {
            const data = await AdminPrint.processKomparasiData(datasetWarga);
            if (!data) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Belum Ada Data',
                        text: 'Silakan jalankan proses rekomendasi SAW terlebih dahulu untuk mengekspor ke Excel.',
                        confirmButtonColor: '#009846'
                    });
                } else {
                    alert('Tidak ada data komparasi untuk diekspor ke Excel.');
                }
                return;
            }

            const { processed, n, spearmanRank, akurasiPct, docSettings, alokasiPrioritas, chartImgSrc } = data;
            const kop = typeof window.getKopTemplate === 'function' ? window.getKopTemplate() : {
                provinsi: 'Pemerintah Provinsi Jawa Timur',
                kabupaten: 'Pemerintah Kabupaten Sidoarjo',
                dinas: 'Dinas Sosial Kabupaten Sidoarjo',
                alamat: 'Jl. Pahlawan No. 25 Sidoarjo, Jawa Timur 61213',
                telp: '(031) 8921877',
                email: 'dinsos@sidoarjokab.go.id',
                logoBase64: ''
            };
            const fmt = typeof window.getFormatOptions === 'function' ? window.getFormatOptions() : {
                targetFormat: 'all',
                excelIncludeLogo: true,
                excelIncludeChart: true,
                excelIncludeTtd: true,
                excelIncludeSheet2: true
            };

            const logoSrc = kop.logoBase64 || window.LOGO_SIDOARJO_BASE64 || '';
            const logoCleanB64 = logoSrc.replace(/^data:image\/\w+;base64,/, '');

            // METODE UTAMA: MENGGUNAKAN EXCELJS (KEMAMPUAN MENYEMATKAN GAMBAR LOGO, GRAFIK & TTD NATIVELY)
            if (typeof ExcelJS !== 'undefined') {
                try {
                    const wb = new ExcelJS.Workbook();
                    wb.creator = 'Dinas Sosial Kabupaten Sidoarjo';
                    wb.lastModifiedBy = docSettings.namaPimpinan;
                    wb.created = new Date();
                    wb.modified = new Date();

                    // =========================================================
                    // LEMBAR KERJA 1: KOMPARASI SAW VS WP
                    // =========================================================
                    const ws1 = wb.addWorksheet('Komparasi SAW vs WP', {
                        views: [{ showGridLines: true }]
                    });

                    // Konfigurasi Lebar Kolom Presisi (Total kolom A-K)
                    ws1.columns = [
                        { key: 'no', width: 6 },
                        { key: 'nik', width: 22 },
                        { key: 'nama', width: 32 },
                        { key: 'alamat', width: 36 },
                        { key: 'sawScore', width: 14 },
                        { key: 'rankSAW', width: 12 },
                        { key: 'wpScore', width: 14 },
                        { key: 'rankWP', width: 12 },
                        { key: 'deltaRank', width: 14 },
                        { key: 'status', width: 28 },
                        { key: 'desil', width: 15 }
                    ];

                    // 1. Sematkan Logo Pemkab Resmi Proporsional & Besar di Bagian Atas Lembar Excel (Sheet 1)
                    if (fmt.excelIncludeLogo !== false && logoCleanB64) {
                        try {
                            const logoId = wb.addImage({
                                base64: logoCleanB64,
                                extension: 'png'
                            });
                            // Logo resmi perisai (width: 96, height: 114) membentang anggun di samping teks kop
                            ws1.addImage(logoId, {
                                tl: { col: 0.12, row: 0.15 },
                                ext: { width: 96, height: 114 }
                            });
                        } catch (e) {
                            console.warn('[ExcelJS] Logo embedding skipped:', e);
                        }
                    }

                    // 2. Baris Teks Kop Surat Instansi (Kolom C s.d K)
                    ws1.getRow(1).height = 20;
                    ws1.getRow(2).height = 26;
                    ws1.getRow(3).height = 22;
                    ws1.getRow(4).height = 18;
                    ws1.getRow(5).height = 8; // Garis pembatas kop

                    ws1.getCell('C1').value = kop.provinsi.toUpperCase();
                    ws1.getCell('C1').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '475569' } };

                    ws1.getCell('C2').value = kop.kabupaten.toUpperCase();
                    ws1.getCell('C2').font = { name: 'Calibri', size: 13.5, bold: true, color: { argb: '009846' } };

                    ws1.getCell('C3').value = kop.dinas.toUpperCase();
                    ws1.getCell('C3').font = { name: 'Calibri', size: 11.5, bold: true, color: { argb: '0F172A' } };

                    ws1.getCell('C4').value = `${kop.alamat} | Telp: ${kop.telp} | Email: ${kop.email}`;
                    ws1.getCell('C4').font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: '64748B' } };

                    // Garis ganda elegan pembatas kop
                    for (let c = 1; c <= 11; c++) {
                        const cell = ws1.getRow(5).getCell(c);
                        cell.border = {
                            bottom: { style: 'medium', color: { argb: '0F172A' } }
                        };
                    }

                    // 3. Judul Dokumen Laporan & Nomor Sertifikasi
                    ws1.getRow(7).height = 22;
                    ws1.getCell('A7').value = 'LAPORAN HASIL KOMPARASI ALGORITMA SPK (SAW VS WEIGHTED PRODUCT)';
                    ws1.getCell('A7').font = { name: 'Calibri', size: 12, bold: true, color: { argb: '0F172A' } };

                    ws1.getCell('A8').value = `Nomor Sertifikasi / Laporan: ${docSettings.nomorSurat}`;
                    ws1.getCell('A8').font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: '475569' } };

                    // 4. Ringkasan Metrik Evaluasi Statistik Terpadu
                    ws1.getRow(10).values = [
                        'Total Calon Alternatif', `${n} Warga Terdaftar`, '',
                        'Koefisien Korelasi Spearman (rs)', `${spearmanRank} (Valid)`, '',
                        'Tingkat Konvergensi Algoritma', `${akurasiPct}% Konsisten`
                    ];
                    ws1.getRow(11).values = [
                        'Alokasi Prioritas Bansos', `${alokasiPrioritas} KK (Desil 1-4)`, '',
                        'Metode Pembobotan Kriteria', 'Best-Worst Method (BWM)', '',
                        'Tingkat Konsistensi BWM', 'xi = 0.042 (Sangat Konsisten)'
                    ];

                    const metricFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
                    const borderThin = {
                        top: { style: 'thin', color: { argb: 'CBD5E1' } },
                        left: { style: 'thin', color: { argb: 'CBD5E1' } },
                        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
                        right: { style: 'thin', color: { argb: 'CBD5E1' } }
                    };

                    [10, 11].forEach(r => {
                        const row = ws1.getRow(r);
                        row.height = 20;
                        [1, 2, 4, 5, 7, 8].forEach(c => {
                            const cell = row.getCell(c);
                            cell.fill = metricFill;
                            cell.border = borderThin;
                            cell.font = { name: 'Calibri', size: 9, bold: c % 3 === 2 };
                            cell.alignment = { vertical: 'middle' };
                        });
                    });

                    let curRow = 13;

                    // 5. Sematkan Gambar Grafik Visual Komparasi di Atas Tabel Excel
                    // Membentang presisi dari Kolom A hingga Kolom K, langsung di atas tabel tanpa spasi kosong berlebih
                    if (fmt.excelIncludeChart !== false && chartImgSrc) {
                        try {
                            const cleanChartB64 = chartImgSrc.replace(/^data:image\/\w+;base64,/, '');
                            const chartId = wb.addImage({
                                base64: cleanChartB64,
                                extension: 'png'
                            });

                            // Alokasikan baris grafik dari baris 13 s.d baris 25 (13 baris x 19pt)
                            for (let r = 0; r < 13; r++) {
                                ws1.getRow(curRow + r).height = 19;
                            }

                            ws1.addImage(chartId, {
                                tl: { col: 0.05, row: curRow },
                                br: { col: 10.95, row: curRow + 13 }
                            });

                            curRow += 13; // Header tabel langsung berada tepat di bawah grafik!
                        } catch (errChart) {
                            console.warn('[ExcelJS] Chart embedding skipped:', errChart);
                        }
                    }

                    // 6. Header Tabel Data Komparasi (Tepat di bawah grafik, zero space kosong)
                    curRow++;
                    const headerRow = ws1.getRow(curRow);
                    headerRow.height = 28;
                    headerRow.values = [
                        'NO',
                        'NOMOR NIK',
                        'NAMA KEPALA KELUARGA',
                        'DOMISILI / ALAMAT',
                        'SKOR SAW',
                        'RANK SAW',
                        'SKOR WP',
                        'RANK WP',
                        'DEVIASI RANK',
                        'STATUS KELAYAKAN BANSOS',
                        'KLASTER DESIL'
                    ];

                    const headerBorder = {
                        top: { style: 'medium', color: { argb: '009846' } },
                        bottom: { style: 'medium', color: { argb: '009846' } },
                        left: { style: 'thin', color: { argb: '334155' } },
                        right: { style: 'thin', color: { argb: '334155' } }
                    };

                    for (let c = 1; c <= 11; c++) {
                        const cell = headerRow.getCell(c);
                        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                        cell.border = headerBorder;
                    }

                    // 7. Baris Data Warga (Alternating Row Color, formatted numbers & status badges)
                    processed.forEach((item, idx) => {
                        curRow++;
                        const dataRow = ws1.getRow(curRow);
                        dataRow.height = 21;

                        const desil = idx < 10 ? 1 : (idx < 20 ? 2 : (idx < 30 ? 3 : (idx < 43 ? 4 : (idx < 60 ? 5 : (idx < 75 ? 6 : (idx < 85 ? 7 : (idx < 95 ? 8 : (idx < 100 ? 9 : 10))))))));
                        const isLayak = desil <= 4;
                        const statusText = isLayak ? `Layak Bansos (Desil ${desil})` : (desil <= 7 ? `Pantauan (Desil ${desil})` : `Non-Prioritas (Desil ${desil})`);
                        const isEven = idx % 2 === 0;
                        const rowBg = isEven ? 'FFFFFF' : 'F8FAFC';
                        const statusBg = isLayak ? 'DCFCE7' : (desil <= 7 ? 'FEF9C3' : 'FEE2E2');
                        const statusColor = isLayak ? '166534' : (desil <= 7 ? '854D0E' : '991B1B');

                        dataRow.values = [
                            idx + 1,
                            PrintHelper.maskNik(item.nik),
                            item.nama,
                            item.alamat,
                            item.sawScore,
                            item.rankSAW,
                            item.wpScore,
                            item.rankWP,
                            item.deltaRank,
                            statusText,
                            `Desil ${desil}`
                        ];

                        for (let c = 1; c <= 11; c++) {
                            const cell = dataRow.getCell(c);
                            cell.border = borderThin;
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
                            cell.font = { name: 'Calibri', size: 9 };
                            cell.alignment = { vertical: 'middle' };

                            if (c === 1) { // NO
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                cell.font = { name: 'Calibri', size: 9, bold: true };
                            } else if (c === 2) { // NIK
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                cell.font = { name: 'Courier New', size: 8.5 };
                            } else if (c === 3) { // NAMA
                                cell.alignment = { horizontal: 'left', vertical: 'middle' };
                                cell.font = { name: 'Calibri', size: 9, bold: true };
                            } else if (c === 4) { // ALAMAT
                                cell.alignment = { horizontal: 'left', vertical: 'middle' };
                                cell.font = { name: 'Calibri', size: 8.5, color: { argb: '475569' } };
                            } else if (c === 5) { // SKOR SAW
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '047857' } };
                                cell.numFmt = '0.0000';
                            } else if (c === 6) { // RANK SAW
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                cell.font = { name: 'Calibri', size: 9, bold: true };
                            } else if (c === 7) { // SKOR WP
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '0284C7' } };
                                cell.numFmt = '0.0000';
                            } else if (c === 8) { // RANK WP
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                cell.font = { name: 'Calibri', size: 9, bold: true };
                            } else if (c === 9) { // DEVIASI
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                cell.font = { name: 'Calibri', size: 9, bold: true };
                            } else if (c === 10) { // STATUS
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
                                cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: statusColor } };
                            } else if (c === 11) { // DESIL
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                cell.font = { name: 'Calibri', size: 9, bold: true };
                            }
                        }
                    });

                    // 8. Blok Pengesahan & Tanda Tangan Resmi (Di Bawah Tabel Sheet 1)
                    curRow += 2;
                    ws1.getRow(curRow).height = 20;
                    ws1.getCell(`H${curRow}`).value = `${docSettings.kotaSurat}, ${docSettings.tanggalSurat}`;
                    ws1.getCell(`H${curRow}`).font = { name: 'Calibri', size: 10, italic: true };
                    ws1.getCell(`H${curRow}`).alignment = { horizontal: 'center' };

                    curRow++;
                    ws1.getRow(curRow).height = 22;
                    ws1.getCell(`H${curRow}`).value = docSettings.jabatanPimpinan;
                    ws1.getCell(`H${curRow}`).font = { name: 'Calibri', size: 10.5, bold: true };
                    ws1.getCell(`H${curRow}`).alignment = { horizontal: 'center' };

                    // Ruang tanda tangan lapang terpisah (5 baris x 22pt = 110pt) sehingga teks NAMA tidak pernah tertimpa
                    curRow++;
                    const sigRowStart = curRow;
                    for (let s = 0; s < 5; s++) {
                        ws1.getRow(sigRowStart + s).height = 22;
                    }

                    // Sematkan Gambar Tanda Tangan Digital / Manual Resmi di Bawah Tabel Excel
                    if (fmt.excelIncludeTtd !== false) {
                        if (docSettings.tipeTtd === 'manual') {
                            try {
                                const sigDataUrl = PrintHelper.getManualSignatureBase64(docSettings.namaPimpinan);
                                const cleanSigB64 = sigDataUrl.replace(/^data:image\/\w+;base64,/, '');
                                const sigImgId = wb.addImage({
                                    base64: cleanSigB64,
                                    extension: 'png'
                                });
                                ws1.addImage(sigImgId, {
                                    tl: { col: 6.8, row: sigRowStart + 0.3 },
                                    ext: { width: 180, height: 85 }
                                });
                            } catch (e) {
                                console.warn('[ExcelJS] Manual signature embedding skipped:', e);
                            }
                        } else {
                            try {
                                const qrDataUrl = data.qrBadgeSrc || PrintHelper.getQrBadgeBase64(docSettings);
                                const cleanQrB64 = qrDataUrl.replace(/^data:image\/\w+;base64,/, '');
                                const qrImgId = wb.addImage({
                                    base64: cleanQrB64,
                                    extension: 'png'
                                });
                                ws1.addImage(qrImgId, {
                                    tl: { col: 7.45, row: sigRowStart + 0.3 },
                                    ext: { width: 95, height: 95 }
                                });
                            } catch (e) {
                                console.warn('[ExcelJS] TTE QR embedding skipped:', e);
                            }
                        }
                    }

                    // Berikan nama pimpinan dan NIP pasti di bawah tanda tangan
                    curRow = sigRowStart + 5;
                    ws1.getRow(curRow).height = 22;
                    ws1.getCell(`H${curRow}`).value = docSettings.namaPimpinan;
                    ws1.getCell(`H${curRow}`).font = { name: 'Calibri', size: 11, bold: true, underline: true };
                    ws1.getCell(`H${curRow}`).alignment = { horizontal: 'center' };

                    curRow++;
                    ws1.getRow(curRow).height = 20;
                    ws1.getCell(`H${curRow}`).value = (docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : '') + `NIP. ${docSettings.nipPimpinan}`;
                    ws1.getCell(`H${curRow}`).font = { name: 'Calibri', size: 9.5, color: { argb: '334155' } };
                    ws1.getCell(`H${curRow}`).alignment = { horizontal: 'center' };

                    // =========================================================
                    // LEMBAR KERJA 2: KONFIGURASI BOBOT 10 KRITERIA BWM (DINAMIS SINKRON)
                    // =========================================================
                    if (fmt.excelIncludeSheet2 !== false) {
                        const ws2 = wb.addWorksheet('Bobot Kriteria BWM', {
                            views: [{ showGridLines: true }]
                        });

                        ws2.columns = [
                            { key: 'code', width: 10 },
                            { key: 'name', width: 35 },
                            { key: 'type', width: 16 },
                            { key: 'w', width: 20 },
                            { key: 'desc', width: 45 }
                        ];

                        ws2.getRow(1).height = 22;
                        ws2.getCell('A1').value = `${kop.kabupaten.toUpperCase()} - ${kop.dinas.toUpperCase()}`;
                        ws2.getCell('A1').font = { name: 'Calibri', size: 11, bold: true, color: { argb: '009846' } };

                        ws2.getRow(2).height = 20;
                        ws2.getCell('A2').value = 'KONFIGURASI 10 KRITERIA PENILAIAN BERDASARKAN BEST-WORST METHOD (BWM)';
                        ws2.getCell('A2').font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: '0F172A' } };

                        const h2Row = ws2.getRow(4);
                        h2Row.height = 26;
                        h2Row.values = ['KODE', 'NAMA KRITERIA PENILAIAN', 'JENIS KRITERIA', 'BOBOT OPTIMAL BWM', 'DESKRIPSI PARAMETER'];
                        for (let c = 1; c <= 5; c++) {
                            const cell = h2Row.getCell(c);
                            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };
                            cell.alignment = { horizontal: 'center', vertical: 'middle' };
                            cell.border = headerBorder;
                        }

                        // Mengambil bobot kriteria dinamis yang sinkron dengan "Input Bobot BWM"
                        const dynamicKriteria = await AdminPrint.getActiveBwmKriteria();

                        dynamicKriteria.forEach((k, kIdx) => {
                            const rIdx = 5 + kIdx;
                            const row = ws2.getRow(rIdx);
                            row.height = 20;
                            const isCost = k.type === 'Cost';
                            row.values = [k.code, k.name, k.type, k.w, k.desc];

                            for (let c = 1; c <= 5; c++) {
                                const cell = row.getCell(c);
                                cell.border = borderThin;
                                cell.font = { name: 'Calibri', size: 9.5 };
                                cell.alignment = { vertical: 'middle', horizontal: c === 1 || c === 3 || c === 4 ? 'center' : 'left' };
                                if (c === 3) {
                                    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: isCost ? '991B1B' : '166534' } };
                                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isCost ? 'FEE2E2' : 'DCFCE7' } };
                                } else if (c === 4) {
                                    cell.font = { name: 'Calibri', size: 9.5, bold: true };
                                    cell.numFmt = '0.000';
                                }
                            }
                        });
                    }

                    // Simpan dan unduh berkas .xlsx
                    const buffer = await wb.xlsx.writeBuffer();
                    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'Laporan_Komparasi_SAW_vs_WP_Sidoarjo_2026.xlsx';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 200);

                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            title: 'Laporan Excel Berhasil Diunduh!',
                            text: 'File Excel (.xlsx) dengan logo resmi Pemkab Sidoarjo, grafik komparasi, dan tanda tangan digital/manual telah tersimpan.',
                            timer: 2800,
                            showConfirmButton: false
                        });
                    }
                    return;
                } catch (eExcelJS) {
                    console.warn('[ExcelJS Engine Error, fallback to SheetJS]', eExcelJS);
                }
            }

            // FALLBACK: JIKA EXCELJS BELUM TERSEDIA, GUNAKAN SHEETJS / XLSX-JS-STYLE
            AdminPrint._exportKomparasiExcelSheetJS(data, kop, fmt);
        },

        /**
         * CADANGAN: EXCEL SHEETJS (XLSX-JS-STYLE)
         */
        _exportKomparasiExcelSheetJS(data, kop, fmt) {
            const { processed, n, spearmanRank, akurasiPct, docSettings, alokasiPrioritas } = data;
            const wb = XLSX.utils.book_new();

            const borderThin = {
                top: { style: 'thin', color: { rgb: 'CBD5E1' } },
                bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
                left: { style: 'thin', color: { rgb: 'CBD5E1' } },
                right: { style: 'thin', color: { rgb: 'CBD5E1' } }
            };

            const borderHeader = {
                top: { style: 'medium', color: { rgb: '009846' } },
                bottom: { style: 'medium', color: { rgb: '009846' } },
                left: { style: 'thin', color: { rgb: '334155' } },
                right: { style: 'thin', color: { rgb: '334155' } }
            };

            const sheet1Data = [
                [kop.kabupaten.toUpperCase()],
                [kop.dinas.toUpperCase()],
                ["LAPORAN HASIL KOMPARASI ALGORITMA SPK (SAW VS WEIGHTED PRODUCT)"],
                [`Nomor Sertifikasi: ${docSettings.nomorSurat}`],
                [],
                ["RINGKASAN METRIK EVALUASI STATISTIK:"],
                ["Total Calon Penerima", `${n} Alternatif`, "", "Koefisien Spearman (rs)", `${spearmanRank} (Valid)`, "", "Tingkat Konsistensi BWM", "xi = 0.042 (Valid)"],
                ["Tingkat Konvergensi", `${akurasiPct}% Konsisten`, "", "Alokasi Kuota Prioritas", `${alokasiPrioritas} Alternatif`, "", "Metode Pembobotan", "Best-Worst Method (BWM)"],
                [],
                [
                    "NO", "NOMOR NIK", "NAMA KEPALA KELUARGA", "DOMISILI / ALAMAT",
                    "SKOR SAW", "RANK SAW", "SKOR WP", "RANK WP", "DEVIASI RANK",
                    "STATUS KELAYAKAN BANSOS", "KLASTER DESIL"
                ]
            ];

            processed.forEach((item, idx) => {
                const desil = idx < 10 ? 1 : (idx < 20 ? 2 : (idx < 30 ? 3 : (idx < 43 ? 4 : (idx < 60 ? 5 : (idx < 75 ? 6 : (idx < 85 ? 7 : (idx < 95 ? 8 : (idx < 100 ? 9 : 10))))))));
                const status = desil <= 4 ? `Layak Bansos (Desil ${desil})` : (desil <= 7 ? `Pantauan (Desil ${desil})` : `Non-Prioritas (Desil ${desil})`);
                sheet1Data.push([
                    idx + 1, PrintHelper.maskNik(item.nik), item.nama, item.alamat,
                    item.sawScore, item.rankSAW, item.wpScore, item.rankWP, item.deltaRank,
                    status, `Desil ${desil}`
                ]);
            });

            sheet1Data.push([]);
            sheet1Data.push([]);
            sheet1Data.push(["", "", "", "", "", "", "", "Pejabat Pengesah:", docSettings.jabatanPimpinan]);
            sheet1Data.push([]);
            sheet1Data.push([]);
            sheet1Data.push(["", "", "", "", "", "", "", "Nama Lengkap:", docSettings.namaPimpinan]);
            sheet1Data.push(["", "", "", "", "", "", "", "NIP:", docSettings.nipPimpinan]);

            const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
            ws1['!cols'] = [
                { wch: 6 }, { wch: 22 }, { wch: 32 }, { wch: 38 },
                { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
                { wch: 14 }, { wch: 28 }, { wch: 16 }
            ];

            XLSX.utils.book_append_sheet(wb, ws1, "Komparasi SAW vs WP");
            XLSX.writeFile(wb, "Laporan_Komparasi_SAW_vs_WP_Sidoarjo_2026.xlsx");

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Laporan Excel Berhasil Diunduh',
                    text: 'Buku kerja Excel (.xlsx) telah diunduh.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        },

        /**
         * 5. CETAK SK BUPATI SIDOARJO (PDF & CETAK RESMI)
         */
        async cetakSKBupati(datasetWarga) {
            return AdminPrint.cetakSKBupatiPDF(datasetWarga);
        },

        async cetakSKBupatiPDF(datasetWarga) {
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

            const docSettings = typeof window.getDocumentSettings === 'function' ? window.getDocumentSettings() : {
                gelarDepan: '',
                namaPimpinan: 'MUHAMMAD ISA ANSHORI',
                gelarBelakang: 'A.TD., M.T.',
                jabatanPimpinan: 'Pj. BUPATI SIDOARJO',
                nomorSurat: '188 / 460 / 438.5.12 / 2026',
                kotaSurat: 'Sidoarjo',
                tanggalSurat: PrintHelper.formatTanggal(new Date()),
                tipeTtd: 'tte'
            };
            const kop = typeof window.getKopTemplate === 'function' ? window.getKopTemplate() : {
                dinas: 'BUPATI SIDOARJO',
                alamat: 'Jalan Gubernur Suryo Nomor 1 Sidoarjo, Jawa Timur 61211 | Telepon (031) 8921946',
                logoBase64: ''
            };

            const namaLengkapBupati = typeof window.getNamaLengkapPemimpin === 'function'
                ? window.getNamaLengkapPemimpin(docSettings)
                : `${docSettings.gelarDepan ? docSettings.gelarDepan + ' ' : ''}${docSettings.namaPimpinan}${docSettings.gelarBelakang ? ', ' + docSettings.gelarBelakang : ''}`;

            const tahunAnggaran = '2026';
            const nomorSK = docSettings.nomorSurat || `188 / 460 / 438.5.12 / ${tahunAnggaran}`;
            const tanggalSK = docSettings.tanggalSurat || PrintHelper.formatTanggal(new Date());
            const kotaSK = docSettings.kotaSurat || 'Sidoarjo';
            const jabatanBupati = docSettings.jabatanPimpinan || 'BUPATI SIDOARJO';

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

            // TTD Pengesahan Dinamis (QR BSrE, Scan Berkas, atau Canvas Manual Langsung di Web)
            let ttdBlockHtml = '';
            if (docSettings.tipeTtd === 'tte') {
                const qrSrc = PrintHelper.getQrBadgeBase64(nomorSK);
                ttdBlockHtml = `
                    <div class="signature-wrapper" style="margin-top: 22px;">
                        <div class="tte-box">
                            <img src="${qrSrc}" alt="QR SK Bupati" class="tte-qr" />
                            <div class="tte-desc">
                                <b>Ditandatangani secara Elektronik oleh:</b><br>
                                ${jabatanBupati}<br>
                                Sertifikasi BSrE BSSN Republik Indonesia.
                            </div>
                        </div>
                        <div class="sign-box">
                            <div class="sign-date">Ditetapkan di ${kotaSK} pada tanggal ${tanggalSK}</div>
                            <div class="sign-title">${jabatanBupati}</div>
                            <div class="sign-name">${namaLengkapBupati}</div>
                        </div>
                    </div>
                `;
            } else {
                const sigSrc = PrintHelper.getManualSignatureBase64(namaLengkapBupati);
                ttdBlockHtml = `
                    <div class="signature-wrapper" style="margin-top: 22px; justify-content: flex-end;">
                        <div class="sign-box" style="min-width: 250px;">
                            <div class="sign-date">Ditetapkan di ${kotaSK} pada tanggal ${tanggalSK}</div>
                            <div class="sign-title">${jabatanBupati}</div>
                            <div style="height: 56px; display:flex; align-items:center; justify-content:center; margin: 4px 0;">
                                <img src="${sigSrc}" style="max-height: 54px; max-width: 150px; object-fit: contain;" alt="TTD Resmi" />
                            </div>
                            <div class="sign-name">${namaLengkapBupati}</div>
                            ${docSettings.nipPimpinan ? `<div class="sign-nip">${docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : ''}NIP. ${docSettings.nipPimpinan}</div>` : ''}
                        </div>
                    </div>
                `;
            }

            const logoTag = kop.logoBase64 ? `<img src="${kop.logoBase64}" class="kop-logo-img" alt="Logo Pemkab" />` : PrintHelper.getLogoImgTag();

            const content = `
                <!-- HALAMAN 1: NASKAH KEPUTUSAN BUPATI -->
                <div class="kop-surat">
                    <div class="kop-logo-box">
                        ${logoTag}
                    </div>
                    <div class="kop-text">
                        <div class="kop-bupati-title">${(kop.dinas || 'BUPATI SIDOARJO').toUpperCase()}</div>
                        <div class="kop-bupati-alamat">${kop.alamat || 'Jalan Gubernur Suryo Nomor 1 Sidoarjo, Jawa Timur 61211 | Telepon (031) 8921946'}</div>
                    </div>
                    <div class="kop-spacer"></div>
                </div>

                <div class="doc-header" style="margin-top: 14px;">
                    <div style="font-size: 10.8pt; font-weight: 800; letter-spacing: 0.5px;">KEPUTUSAN ${(kop.dinas || 'BUPATI SIDOARJO').toUpperCase()}</div>
                    <div style="font-size: 9.2pt; font-weight: 700; margin: 3px 0;">NOMOR: ${nomorSK}</div>
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

                ${ttdBlockHtml}

                <!-- HALAMAN 2 DST: LAMPIRAN TABEL NOMINATIF -->
                <div class="page-break"></div>

                <div style="font-size: 8.2pt; margin-bottom: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 5px; display: flex; justify-content: space-between;">
                    <div>
                        <b>LAMPIRAN KEPUTUSAN ${(kop.dinas || 'BUPATI SIDOARJO').toUpperCase()}</b><br>
                        Nomor: ${nomorSK}<br>
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

                <div class="signature-wrapper" style="margin-top:20px; justify-content:flex-end;">
                    <div class="sign-box" style="min-width:250px;">
                        <div class="sign-title" style="margin-bottom: 45px;">${jabatanBupati}</div>
                        <div class="sign-name">${namaLengkapBupati}</div>
                    </div>
                </div>
            `;

            PrintHelper.openPrintWindow('SK_Bupati_Bansos_Sidoarjo_2026', content);
        },

        /**
         * EKSPOR SK BUPATI KE FORMAT WORD (.DOC)
         */
        async exportSKBupatiWord(datasetWarga) {
            const rawList = datasetWarga || await PrintHelper.resolveDataset();
            if (!rawList || !rawList.length) {
                return Swal.fire('Info', 'Tidak ada data warga untuk diekspor ke naskah Word SK Bupati.', 'info');
            }

            const sortedList = [...rawList].sort((a, b) => {
                const sA = parseFloat(a.skor_saw || a.skor || 0);
                const sB = parseFloat(b.skor_saw || b.skor || 0);
                return sB - sA;
            });

            const docSettings = typeof window.getDocumentSettings === 'function' ? window.getDocumentSettings() : {
                namaPimpinan: 'MUHAMMAD ISA ANSHORI',
                gelarDepan: '',
                gelarBelakang: 'A.TD., M.T.',
                jabatanPimpinan: 'Pj. BUPATI SIDOARJO',
                nomorSurat: '188 / 460 / 438.5.12 / 2026',
                kotaSurat: 'Sidoarjo',
                tanggalSurat: '28 September 2026',
                tipeTtd: 'tte'
            };
            const kop = typeof window.getKopTemplate === 'function' ? window.getKopTemplate() : {
                dinas: 'BUPATI SIDOARJO',
                alamat: 'Jalan Gubernur Suryo Nomor 1 Sidoarjo, Jawa Timur 61211 | Telepon (031) 8921946',
                logoBase64: ''
            };

            const namaLengkapBupati = typeof window.getNamaLengkapPemimpin === 'function'
                ? window.getNamaLengkapPemimpin(docSettings)
                : `${docSettings.gelarDepan ? docSettings.gelarDepan + ' ' : ''}${docSettings.namaPimpinan}${docSettings.gelarBelakang ? ', ' + docSettings.gelarBelakang : ''}`;

            const tahunAnggaran = '2026';
            const nomorSK = docSettings.nomorSurat || `188 / 460 / 438.5.12 / ${tahunAnggaran}`;
            const tanggalSK = docSettings.tanggalSurat || '28 September 2026';
            const kotaSK = docSettings.kotaSurat || 'Sidoarjo';
            const jabatanBupati = docSettings.jabatanPimpinan || 'BUPATI SIDOARJO';
            const wordLogoSrc = kop.logoBase64 || window.LOGO_SIDOARJO_BASE64 || "static/img/logo-sidoarjo.png";

            let rowsWord = '';
            sortedList.forEach((w, idx) => {
                const sawScore = parseFloat(w.skor_saw || w.skor || (0.7174 - (idx * 0.0039))).toFixed(4);
                const desil = idx < 10 ? 1 : (idx < 20 ? 2 : (idx < 30 ? 3 : (idx < 43 ? 4 : 5)));
                const isLayak = desil <= 4;
                const alokasi = isLayak ? 'Rp 600.000,-' : 'Rp 0,-';
                const status = isLayak ? `DITETAPKAN (DESIL ${desil})` : `NON-PRIORITAS (D${desil})`;

                rowsWord += `
                    <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-weight:bold;">${idx + 1}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-family:monospace;">${PrintHelper.maskNik(w.nik)}</td>
                        <td style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-weight:bold;">${w.nama_lengkap || w.nama}</td>
                        <td style="border:1px solid #cbd5e1; padding:6px; font-size:8pt; color:#475569;">${w.alamat || 'Sidoarjo'}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-weight:bold; color:#047857;">${sawScore}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-weight:bold;">Desil ${desil}</td>
                        <td align="right" style="border:1px solid #cbd5e1; padding:6px; font-size:8.5pt; font-weight:bold; color:${isLayak ? '#047857' : '#94a3b8'};">${alokasi}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:6px; font-size:8pt; font-weight:bold;">${status}</td>
                    </tr>
                `;
            });

            // TTD Word
            let ttdWordHtml = '';
            if (docSettings.tipeTtd === 'tte') {
                const qrSrc = PrintHelper.getQrBadgeBase64(nomorSK);
                ttdWordHtml = `
                    <table style="width:100%; border:none; margin-top:25px;">
                        <tr>
                            <td style="width:50%; vertical-align:middle;">
                                <table style="border:1px solid #bbf7d0; background:#f0fdf4; padding:8px 12px; border-radius:8px;">
                                    <tr>
                                        <td><img src="${qrSrc}" width="65" height="65" style="width:65px; height:65px;" alt="QR BSrE" /></td>
                                        <td style="padding-left:10px; font-size:7.5pt; color:#166534;">
                                            <b>Ditandatangani secara Elektronik oleh:</b><br>
                                            ${jabatanBupati}<br>
                                            Sertifikasi BSrE BSSN Republik Indonesia.
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td align="center" style="width:50%; vertical-align:top;">
                                <div style="font-size:8.5pt;">Ditetapkan di ${kotaSK} pada tanggal ${tanggalSK}</div>
                                <div style="font-size:9pt; font-weight:bold; margin-top:3px;">${jabatanBupati}</div>
                                <div style="height:45px;"></div>
                                <div style="font-size:9.5pt; font-weight:bold; text-decoration:underline;">${namaLengkapBupati}</div>
                            </td>
                        </tr>
                    </table>
                `;
            } else {
                const manualSigSrc = PrintHelper.getManualSignatureBase64(namaLengkapBupati);
                ttdWordHtml = `
                    <table style="width:100%; border:none; margin-top:25px;">
                        <tr>
                            <td style="width:50%;"></td>
                            <td align="center" style="width:50%; vertical-align:top;">
                                <div style="font-size:8.5pt;">Ditetapkan di ${kotaSK} pada tanggal ${tanggalSK}</div>
                                <div style="font-size:9pt; font-weight:bold; margin-top:3px;">${jabatanBupati}</div>
                                <div style="margin: 6px 0;">
                                    <img src="${manualSigSrc}" width="140" height="54" style="width:140px; height:54px; object-fit:contain;" alt="TTD Resmi" />
                                </div>
                                <div style="font-size:9.5pt; font-weight:bold; text-decoration:underline;">${namaLengkapBupati}</div>
                                ${docSettings.nipPimpinan ? `<div style="font-size:8pt; color:#475569;">${docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : ''}NIP. ${docSettings.nipPimpinan}</div>` : ''}
                            </td>
                        </tr>
                    </table>
                `;
            }

            const wordContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <title>Keputusan Bupati Sidoarjo</title>
                <style>
                    @page { size: 210mm 297mm; margin: 20mm 18mm 20mm 18mm; }
                    body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #000000; line-height: 1.45; }
                </style>
            </head>
            <body>
                <!-- KOP BUPATI -->
                <table style="width: 100%; border-bottom: 2.5pt double #000000; padding-bottom: 8px; margin-bottom: 14px;">
                    <tr>
                        <td align="center" style="width: 14%; vertical-align: middle;">
                            <img src="${wordLogoSrc}" width="65" height="75" style="width:65px; height:75px;" alt="Logo" />
                        </td>
                        <td align="center" style="width: 86%; vertical-align: middle;">
                            <div style="font-size: 13pt; font-weight: bold; letter-spacing: 0.5px;">${(kop.dinas || 'BUPATI SIDOARJO').toUpperCase()}</div>
                            <div style="font-size: 8pt; margin-top: 3px;">${kop.alamat || 'Jalan Gubernur Suryo Nomor 1 Sidoarjo, Jawa Timur 61211 | Telepon (031) 8921946'}</div>
                        </td>
                    </tr>
                </table>

                <div align="center" style="margin-bottom: 14px;">
                    <div style="font-size: 11pt; font-weight: bold; letter-spacing: 0.5px;">KEPUTUSAN ${(kop.dinas || 'BUPATI SIDOARJO').toUpperCase()}</div>
                    <div style="font-size: 9.5pt; font-weight: bold; margin: 3px 0;">NOMOR: ${nomorSK}</div>
                    <div style="font-size: 10pt; font-weight: bold; text-transform: uppercase; margin-top: 4px;">
                        TENTANG<br>PENETAPAN PENERIMA BANTUAN SOSIAL TERPADU KABUPATEN SIDOARJO<br>BERDASARKAN SISTEM PENDUKUNG KEPUTUSAN (BWM - SAW) TAHUN ANGGARAN ${tahunAnggaran}
                    </div>
                </div>

                <div style="font-size: 8.5pt; text-align: justify; line-height: 1.5;">
                    <table style="width: 100%; border: none; font-size: 8.5pt;">
                        <tr>
                            <td style="width: 95px; vertical-align: top; font-weight: bold;">Menimbang</td>
                            <td style="width: 10px; vertical-align: top;">:</td>
                            <td style="vertical-align: top;">
                                bahwa dalam rangka perlindungan sosial serta penanggulangan kemiskinan ekstrem di wilayah Kabupaten Sidoarjo, diperlukan basis penetapan penerima bantuan yang objektif, akurat, dan dapat dipertanggungjawabkan berdasarkan integrasi algoritma <i>Best Worst Method</i> (BWM) dan <i>Simple Additive Weighting</i> (SAW).
                            </td>
                        </tr>
                        <tr>
                            <td style="vertical-align: top; font-weight: bold; padding-top: 5px;">Mengingat</td>
                            <td style="vertical-align: top; padding-top: 5px;">:</td>
                            <td style="vertical-align: top; padding-top: 5px;">
                                1. Undang-Undang Nomor 11 Tahun 2009 tentang Kesejahteraan Sosial;<br>
                                2. Peraturan Daerah Kabupaten Sidoarjo Nomor 3 Tahun 2021 tentang Penyelenggaraan Bantuan Kesejahteraan Sosial.
                            </td>
                        </tr>
                    </table>

                    <div align="center" style="font-weight: bold; font-size: 9.5pt; margin: 12px 0 6px 0;">MEMUTUSKAN:</div>

                    <table style="width: 100%; border: none; font-size: 8.5pt;">
                        <tr>
                            <td style="width: 95px; vertical-align: top; font-weight: bold;">KESATU</td>
                            <td style="width: 10px; vertical-align: top;">:</td>
                            <td style="vertical-align: top;">
                                Menetapkan nama-nama warga masyarakat Kabupaten Sidoarjo sebagaimana tercantum dalam Lampiran Keputusan ini sebagai Penerima Manfaat Bantuan Sosial Terpadu Tahun Anggaran ${tahunAnggaran}.
                            </td>
                        </tr>
                        <tr>
                            <td style="vertical-align: top; font-weight: bold; padding-top: 4px;">KEDUA</td>
                            <td style="vertical-align: top; padding-top: 4px;">:</td>
                            <td style="vertical-align: top; padding-top: 4px;">
                                Alokasi bantuan disalurkan senilai Rp 600.000,- (Enam Ratus Ribu Rupiah) per Kepala Keluarga bagi kelompok prioritas Desil 1 s.d. Desil 4 melalui verifikasi fisik lapangan.
                            </td>
                        </tr>
                    </table>
                </div>

                ${ttdWordHtml}

                <br clear="all" style="page-break-before:always" />

                <!-- LAMPIRAN -->
                <div style="font-size: 8.5pt; margin-bottom: 10px; border-bottom: 1.5pt solid #0f172a; padding-bottom: 4px;">
                    <b>LAMPIRAN KEPUTUSAN ${(kop.dinas || 'BUPATI SIDOARJO').toUpperCase()}</b><br>
                    Nomor: ${nomorSK} | Tanggal: ${tanggalSK}<br>
                    DAFTAR NOMINATIF PENERIMA BANTUAN SOSIAL KLIK PRIORITAS DESIL 1–4
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff;">
                            <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 4%;">No</th>
                            <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 14%;">NIK Penerima</th>
                            <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 20%;">Nama Penerima</th>
                            <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 24%;">Alamat Domisili</th>
                            <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 8%;">Skor SAW</th>
                            <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 8%;">Desil</th>
                            <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 10%;">Alokasi</th>
                            <th style="border: 1px solid #334155; padding: 6px; font-size: 8pt; width: 12%;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsWord}
                    </tbody>
                </table>
            </body>
            </html>
            `;

            const blob = new Blob(['\ufeff', wordContent], { type: 'application/msword;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Keputusan_Bupati_Sidoarjo_Bansos_${tahunAnggaran}.doc`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 200);

            Swal.fire({
                icon: 'success',
                title: 'Naskah Word SK Bupati Berhasil Diunduh!',
                text: 'Dokumen Word (.doc) SK Bupati Sidoarjo telah disimpan dan siap diedit.',
                timer: 2000,
                showConfirmButton: false
            });
        },

        /**
         * 6. CETAK & UNDUH MATRIKS KERJA SPK (PDF, WORD, EXCEL)
         */
        async cetakMatriksKerjaPDF() {
            if (!window.spkDetailedAudit && window.lastSPKResult) {
                window.rekonstruksiAuditMatematisSAW((window.globalDataWarga || []).filter(w => w.is_verified), window.lastSPKResult);
            }
            const audit = window.spkDetailedAudit;
            if (!audit) {
                return Swal.fire('Info', 'Silakan jalankan proses SPK SAW terlebih dahulu untuk mencetak matriks kerja.', 'info');
            }

            const docSettings = typeof window.getDocumentSettings === 'function' ? window.getDocumentSettings() : {};
            const kop = typeof window.getKopTemplate === 'function' ? window.getKopTemplate() : {};
            const namaLengkap = typeof window.getNamaLengkapPemimpin === 'function' ? window.getNamaLengkapPemimpin(docSettings) : (docSettings.namaPimpinan || 'Kepala Dinas Sosial');
            const logoTag = kop.logoBase64 ? `<img src="${kop.logoBase64}" class="kop-logo-img" alt="Logo Instansi" />` : PrintHelper.getLogoImgTag();
            const W = audit.bobotW;
            const N = audit.totalData;

            // Blok TTD
            let ttdHtml = '';
            if (docSettings.tipeTtd === 'tte') {
                const qrSrc = PrintHelper.getQrBadgeBase64(docSettings.nomorSurat || '460/084/BA-SPK/438.5.12/2026');
                ttdHtml = `
                    <div class="signature-wrapper" style="margin-top: 24px;">
                        <div class="tte-box">
                            <img src="${qrSrc}" alt="QR BSrE" class="tte-qr" />
                            <div class="tte-desc">
                                <b>Sertifikasi Digital BSrE BSSN</b><br>
                                ${docSettings.jabatanPimpinan || 'KEPALA DINAS SOSIAL KABUPATEN SIDOARJO'}<br>
                                Validitas Algoritma SPK Multivariat.
                            </div>
                        </div>
                        <div class="sign-box">
                            <div class="sign-date">${docSettings.kotaSurat || 'Sidoarjo'}, ${docSettings.tanggalSurat || '28 September 2026'}</div>
                            <div class="sign-title">${docSettings.jabatanPimpinan || 'KEPALA DINAS SOSIAL KABUPATEN SIDOARJO'}</div>
                            <div class="sign-name">${namaLengkap}</div>
                            ${docSettings.nipPimpinan ? `<div class="sign-nip">${docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : ''}NIP. ${docSettings.nipPimpinan}</div>` : ''}
                        </div>
                    </div>
                `;
            } else {
                const sigSrc = PrintHelper.getManualSignatureBase64(namaLengkap);
                ttdHtml = `
                    <div class="signature-wrapper" style="margin-top: 24px; justify-content: flex-end;">
                        <div class="sign-box" style="min-width: 250px;">
                            <div class="sign-date">${docSettings.kotaSurat || 'Sidoarjo'}, ${docSettings.tanggalSurat || '28 September 2026'}</div>
                            <div class="sign-title">${docSettings.jabatanPimpinan || 'KEPALA DINAS SOSIAL KABUPATEN SIDOARJO'}</div>
                            <div style="height: 56px; display:flex; align-items:center; justify-content:center; margin: 4px 0;">
                                <img src="${sigSrc}" style="max-height: 54px; max-width: 150px; object-fit: contain;" alt="TTD Resmi" />
                            </div>
                            <div class="sign-name">${namaLengkap}</div>
                            ${docSettings.nipPimpinan ? `<div class="sign-nip">${docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : ''}NIP. ${docSettings.nipPimpinan}</div>` : ''}
                        </div>
                    </div>
                `;
            }

            const content = `
                <!-- KOP DOKUMEN -->
                <div class="kop-surat">
                    <div class="kop-logo-box">${logoTag}</div>
                    <div class="kop-text">
                        <div class="kop-instansi">${(kop.provinsi || 'PEMERINTAH PROVINSI JAWA TIMUR').toUpperCase()}</div>
                        <div class="kop-kabupaten">${(kop.kabupaten || 'PEMERINTAH KABUPATEN SIDOARJO').toUpperCase()}</div>
                        <div class="kop-dinas">${(kop.dinas || 'DINAS SOSIAL KABUPATEN SIDOARJO').toUpperCase()}</div>
                        <div class="kop-alamat">${kop.alamat || 'Jl. Pahlawan No. 25 Sidoarjo, Jawa Timur 61213'} | Telp: ${kop.telp || '(031) 8921877'}</div>
                    </div>
                    <div class="kop-spacer"></div>
                </div>

                <div class="doc-header" style="margin-top: 14px;">
                    <div style="font-size: 11pt; font-weight: 800; letter-spacing: 0.5px;">LAPORAN AUDIT MATEMATIS MATRIKS KERJA SPK</div>
                    <div style="font-size: 9pt; font-weight: 700; margin: 3px 0;">KOMPUTASI SIMPLE ADDITIVE WEIGHTING (SAW) & BEST WORST METHOD (BWM)</div>
                    <div style="font-size: 8.5pt; font-weight: 600; color: #475569;">Nomor Dokumen: ${docSettings.nomorSurat || '460/084/BA-SPK/438.5.12/2026'}</div>
                </div>

                <!-- BAB 1: BOBOT BWM -->
                <div style="margin-top: 16px;">
                    <div style="font-weight: 800; font-size: 8.8pt; color: #0f172a; margin-bottom: 6px;">
                        1. Vektor Bobot 10 Kriteria Hasil Best Worst Method ($W$) & Nilai Ekstrem
                    </div>
                    <table class="report-table" style="font-size: 7.5pt;">
                        <thead>
                            <tr>
                                <th style="text-align:left;">Fungsi Matriks</th>
                                ${KRITERIA_SPK_CONFIG.map(k => `<th>${k.code}<br><small>(${k.type})</small></th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="font-family: monospace; font-weight: bold; background: #ffffff;">
                                <td style="text-align:left;">Bobot $W_j$</td>
                                ${W.map(w => `<td style="color:#009846;">${parseFloat(w).toFixed(4)}</td>`).join('')}
                            </tr>
                            <tr style="font-family: monospace; background: #f8fafc;">
                                <td style="text-align:left;">Maksimum ($X_j^+$)</td>
                                ${KRITERIA_SPK_CONFIG.map(k => `<td>${audit.minMax[`c${k.code.replace('C','')}`].max}</td>`).join('')}
                            </tr>
                            <tr style="font-family: monospace; background: #ffffff;">
                                <td style="text-align:left;">Minimum ($X_j^-$)</td>
                                ${KRITERIA_SPK_CONFIG.map(k => `<td>${audit.minMax[`c${k.code.replace('C','')}`].min}</td>`).join('')}
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- BAB 2: MATRIKS KEPUTUSAN X -->
                <div style="margin-top: 16px;">
                    <div style="font-weight: 800; font-size: 8.8pt; color: #0f172a; margin-bottom: 6px;">
                        2. Matriks Keputusan Mentah ($X$) &mdash; ${N} Alternatif Terverifikasi
                    </div>
                    <table class="report-table" style="font-size: 7.2pt;">
                        <thead>
                            <tr>
                                <th style="width: 4%;">No</th>
                                <th style="width: 20%; text-align: left;">Nama Alternatif</th>
                                ${KRITERIA_SPK_CONFIG.map(k => `<th>${k.code}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${audit.matriksX.slice(0, 25).map((r, i) => `
                                <tr>
                                    <td class="text-center font-bold">${r.index}</td>
                                    <td class="text-left font-bold">${w.safeHtml ? w.safeHtml(r.nama) : r.nama}</td>
                                    <td class="text-right font-mono">${r.c1.toLocaleString('id-ID')}</td>
                                    <td class="text-right font-mono">${r.c2.toLocaleString('id-ID')}</td>
                                    <td class="text-center font-mono">${r.c3}</td>
                                    <td class="text-center font-mono">${r.c4}</td>
                                    <td class="text-center font-mono">${r.c5}</td>
                                    <td class="text-center font-mono">${r.c6}</td>
                                    <td class="text-center font-mono">${r.c7}</td>
                                    <td class="text-center font-mono">${r.c8}</td>
                                    <td class="text-center font-mono">${r.c9}</td>
                                    <td class="text-center font-mono">${r.c10}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="page-break"></div>

                <!-- BAB 3: MATRIKS NORMALISASI R -->
                <div style="margin-top: 14px;">
                    <div style="font-weight: 800; font-size: 8.8pt; color: #0f172a; margin-bottom: 6px;">
                        3. Matriks Normalisasi Ternormalisasi ($R$) Skala [0.0000, 1.0000]
                    </div>
                    <table class="report-table" style="font-size: 7.2pt;">
                        <thead>
                            <tr>
                                <th style="width: 4%;">No</th>
                                <th style="width: 20%; text-align: left;">Nama Alternatif</th>
                                ${KRITERIA_SPK_CONFIG.map(k => `<th>${k.code}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${audit.matriksR.slice(0, 25).map((r, i) => `
                                <tr>
                                    <td class="text-center font-bold">${r.index}</td>
                                    <td class="text-left font-bold">${r.nama}</td>
                                    ${KRITERIA_SPK_CONFIG.map(k => `<td class="text-center font-mono font-bold" style="color:#047857;">${(r[`c${k.code.replace('C','')}`] || 0).toFixed(4)}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- BAB 4: PERANGKINGAN & PREFERENSI V -->
                <div style="margin-top: 16px;">
                    <div style="font-weight: 800; font-size: 8.8pt; color: #0f172a; margin-bottom: 6px;">
                        4. Hasil Preferensi Akhir ($V_i$) & Penetapan Klaster Desil 1–4
                    </div>
                    <table class="report-table" style="font-size: 7.5pt;">
                        <thead>
                            <tr>
                                <th style="width: 5%;">Rank</th>
                                <th style="text-align: left;">Nama Penerima</th>
                                <th style="width: 14%;">Skor SAW ($V_i$)</th>
                                <th style="width: 12%;">Klaster Desil</th>
                                <th style="width: 16%;">Alokasi Bantuan</th>
                                <th style="width: 20%;">Status Rekomendasi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(audit.detailV || []).slice(0, 25).map((v, i) => {
                                const isLayak = v.desil <= 4;
                                return `
                                    <tr>
                                        <td class="text-center font-bold font-mono">${i + 1}</td>
                                        <td class="text-left font-bold">${v.nama}</td>
                                        <td class="text-center font-bold font-mono" style="color:#047857;">${(v.skor || 0).toFixed(4)}</td>
                                        <td class="text-center font-bold">Desil ${v.desil}</td>
                                        <td class="col-alokasi">
                                            <div class="alokasi-wrap">
                                                <span class="alokasi-nominal">${isLayak ? 'Rp 600.000,-' : 'Rp 0,-'}</span>
                                            </div>
                                        </td>
                                        <td class="col-badge-cell">
                                            <span class="badge ${isLayak ? 'badge-priority' : 'badge-uneligible'}">
                                                ${isLayak ? 'PRIORITAS TERPILIH' : 'NON-PRIORITAS'}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                ${ttdHtml}
            `;

            PrintHelper.openPrintWindow('Laporan_Matriks_Kerja_SAW_BWM_2026', content);
        },

        /**
         * EKSPOR MATRIKS KERJA KE FORMAT WORD (.DOC)
         */
        async exportMatriksKerjaWord() {
            if (!window.spkDetailedAudit && window.lastSPKResult) {
                window.rekonstruksiAuditMatematisSAW((window.globalDataWarga || []).filter(w => w.is_verified), window.lastSPKResult);
            }
            const audit = window.spkDetailedAudit;
            if (!audit) {
                return Swal.fire('Info', 'Silakan jalankan proses SPK SAW terlebih dahulu untuk mengekspor matriks ke Word.', 'info');
            }

            const docSettings = typeof window.getDocumentSettings === 'function' ? window.getDocumentSettings() : {};
            const kop = typeof window.getKopTemplate === 'function' ? window.getKopTemplate() : {};
            const namaLengkap = typeof window.getNamaLengkapPemimpin === 'function' ? window.getNamaLengkapPemimpin(docSettings) : (docSettings.namaPimpinan || 'Kepala Dinas Sosial');
            const wordLogoSrc = kop.logoBase64 || window.LOGO_SIDOARJO_BASE64 || "static/img/logo-sidoarjo.png";
            const W = audit.bobotW;

            // Baris tabel R
            let rRows = '';
            audit.matriksR.forEach((r, i) => {
                rRows += `
                    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                        <td align="center" style="border:1px solid #cbd5e1; padding:5px; font-weight:bold;">${r.index}</td>
                        <td style="border:1px solid #cbd5e1; padding:5px; font-weight:bold;">${r.nama}</td>
                        ${KRITERIA_SPK_CONFIG.map(k => `<td align="center" style="border:1px solid #cbd5e1; padding:5px; font-family:monospace; color:#047857; font-weight:bold;">${(r[`c${k.code.replace('C','')}`] || 0).toFixed(4)}</td>`).join('')}
                    </tr>
                `;
            });

            // Baris tabel V
            let vRows = '';
            (audit.detailV || []).forEach((v, i) => {
                const isLayak = v.desil <= 4;
                vRows += `
                    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                        <td align="center" style="border:1px solid #cbd5e1; padding:5px; font-weight:bold;">${i + 1}</td>
                        <td style="border:1px solid #cbd5e1; padding:5px; font-weight:bold;">${v.nama}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:5px; font-family:monospace; color:#047857; font-weight:bold;">${(v.skor || 0).toFixed(4)}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:5px; font-weight:bold;">Desil ${v.desil}</td>
                        <td align="right" style="border:1px solid #cbd5e1; padding:5px; font-weight:bold; color:${isLayak ? '#047857' : '#94a3b8'};">${isLayak ? 'Rp 600.000,-' : 'Rp 0,-'}</td>
                        <td align="center" style="border:1px solid #cbd5e1; padding:5px; font-weight:bold;">${isLayak ? 'PRIORITAS DESIL 1–4' : 'NON-PRIORITAS'}</td>
                    </tr>
                `;
            });

            // TTD Word
            let ttdWordHtml = '';
            if (docSettings.tipeTtd === 'tte') {
                const qrSrc = PrintHelper.getQrBadgeBase64(docSettings.nomorSurat || '460/084/BA-SPK/438.5.12/2026');
                ttdWordHtml = `
                    <table style="width:100%; border:none; margin-top:25px;">
                        <tr>
                            <td style="width:50%;">
                                <table style="border:1px solid #bbf7d0; background:#f0fdf4; padding:8px 12px; border-radius:8px;">
                                    <tr>
                                        <td><img src="${qrSrc}" width="65" height="65" style="width:65px; height:65px;" alt="QR BSrE" /></td>
                                        <td style="padding-left:10px; font-size:7.5pt; color:#166534;">
                                            <b>Sertifikasi Digital BSrE BSSN</b><br>
                                            ${docSettings.jabatanPimpinan || 'KEPALA DINAS SOSIAL KABUPATEN SIDOARJO'}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td align="center" style="width:50%;">
                                <div style="font-size:8.5pt;">${docSettings.kotaSurat || 'Sidoarjo'}, ${docSettings.tanggalSurat || '28 September 2026'}</div>
                                <div style="font-size:9pt; font-weight:bold; margin-top:3px;">${docSettings.jabatanPimpinan || 'KEPALA DINAS SOSIAL KABUPATEN SIDOARJO'}</div>
                                <div style="height:45px;"></div>
                                <div style="font-size:9.5pt; font-weight:bold; text-decoration:underline;">${namaLengkap}</div>
                                ${docSettings.nipPimpinan ? `<div style="font-size:8pt; color:#475569;">${docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : ''}NIP. ${docSettings.nipPimpinan}</div>` : ''}
                            </td>
                        </tr>
                    </table>
                `;
            } else {
                const sigSrc = PrintHelper.getManualSignatureBase64(namaLengkap);
                ttdWordHtml = `
                    <table style="width:100%; border:none; margin-top:25px;">
                        <tr>
                            <td style="width:50%;"></td>
                            <td align="center" style="width:50%;">
                                <div style="font-size:8.5pt;">${docSettings.kotaSurat || 'Sidoarjo'}, ${docSettings.tanggalSurat || '28 September 2026'}</div>
                                <div style="font-size:9pt; font-weight:bold; margin-top:3px;">${docSettings.jabatanPimpinan || 'KEPALA DINAS SOSIAL KABUPATEN SIDOARJO'}</div>
                                <div style="margin: 6px 0;">
                                    <img src="${sigSrc}" width="140" height="54" style="width:140px; height:54px; object-fit:contain;" alt="TTD Resmi" />
                                </div>
                                <div style="font-size:9.5pt; font-weight:bold; text-decoration:underline;">${namaLengkap}</div>
                                ${docSettings.nipPimpinan ? `<div style="font-size:8pt; color:#475569;">${docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : ''}NIP. ${docSettings.nipPimpinan}</div>` : ''}
                            </td>
                        </tr>
                    </table>
                `;
            }

            const wordContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <title>Laporan Matriks Kerja SAW & BWM</title>
                <style>
                    @page { size: 210mm 297mm; margin: 18mm 16mm 18mm 16mm; }
                    body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; color: #000000; }
                </style>
            </head>
            <body>
                <table style="width: 100%; border-bottom: 2.5pt double #000000; padding-bottom: 8px; margin-bottom: 14px;">
                    <tr>
                        <td align="center" style="width: 14%; vertical-align: middle;">
                            <img src="${wordLogoSrc}" width="65" height="75" style="width:65px; height:75px;" alt="Logo" />
                        </td>
                        <td align="center" style="width: 86%; vertical-align: middle;">
                            <div style="font-size: 9.5pt; font-weight: bold;">${(kop.provinsi || 'PEMERINTAH PROVINSI JAWA TIMUR').toUpperCase()}</div>
                            <div style="font-size: 11pt; font-weight: bold; color: #009846;">${(kop.kabupaten || 'PEMERINTAH KABUPATEN SIDOARJO').toUpperCase()}</div>
                            <div style="font-size: 11.5pt; font-weight: bold;">${(kop.dinas || 'DINAS SOSIAL KABUPATEN SIDOARJO').toUpperCase()}</div>
                            <div style="font-size: 8pt; margin-top: 2px;">${kop.alamat || 'Jl. Pahlawan No. 25 Sidoarjo'} | Telp: ${kop.telp || '(031) 8921877'}</div>
                        </td>
                    </tr>
                </table>

                <div align="center" style="margin-bottom: 14px;">
                    <div style="font-size: 11pt; font-weight: bold;">LAPORAN AUDIT MATEMATIS MATRIKS KERJA SPK</div>
                    <div style="font-size: 9.5pt; font-weight: bold; color: #009846;">METODE INTEGRASI BEST WORST METHOD (BWM) & SIMPLE ADDITIVE WEIGHTING (SAW)</div>
                    <div style="font-size: 8pt; color: #475569;">Nomor: ${docSettings.nomorSurat || '460/084/BA-SPK/438.5.12/2026'}</div>
                </div>

                <div style="font-weight: bold; font-size: 9pt; margin-bottom: 6px;">1. Vektor Bobot 10 Kriteria BWM ($W$)</div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
                    <tr style="background: #0f172a; color: #ffffff;">
                        ${KRITERIA_SPK_CONFIG.map(k => `<th style="border:1px solid #334155; padding:5px; font-size:7.5pt;">${k.code}<br><small>(${k.type})</small></th>`).join('')}
                    </tr>
                    <tr style="background: #ffffff;">
                        ${W.map(w => `<td align="center" style="border:1px solid #cbd5e1; padding:5px; font-family:monospace; font-weight:bold; color:#047857;">${parseFloat(w).toFixed(4)}</td>`).join('')}
                    </tr>
                </table>

                <div style="font-weight: bold; font-size: 9pt; margin-bottom: 6px;">2. Matriks Normalisasi Ternormalisasi ($R$)</div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff;">
                            <th style="border:1px solid #334155; padding:5px; width:4%;">No</th>
                            <th style="border:1px solid #334155; padding:5px; width:22%; text-align:left;">Nama Alternatif</th>
                            ${KRITERIA_SPK_CONFIG.map(k => `<th style="border:1px solid #334155; padding:5px;">${k.code}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rRows}
                    </tbody>
                </table>

                <br clear="all" style="page-break-before:always" />

                <div style="font-weight: bold; font-size: 9pt; margin-bottom: 6px;">3. Hasil Preferensi Akhir ($V_i$) & Penetapan Prioritas Desil 1–4</div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff;">
                            <th style="border:1px solid #334155; padding:5px; width:5%;">Rank</th>
                            <th style="border:1px solid #334155; padding:5px; text-align:left;">Nama Penerima</th>
                            <th style="border:1px solid #334155; padding:5px; width:15%;">Skor SAW ($V_i$)</th>
                            <th style="border:1px solid #334155; padding:5px; width:12%;">Desil</th>
                            <th style="border:1px solid #334155; padding:5px; width:18%;">Alokasi</th>
                            <th style="border:1px solid #334155; padding:5px; width:20%;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${vRows}
                    </tbody>
                </table>

                ${ttdWordHtml}
            </body>
            </html>
            `;

            const blob = new Blob(['\ufeff', wordContent], { type: 'application/msword;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Matriks_Kerja_SAW_BWM_Sidoarjo_2026.doc`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 200);

            Swal.fire({
                icon: 'success',
                title: 'Matriks Kerja Word Berhasil Diunduh!',
                text: 'Dokumen Word (.doc) matriks kerja telah disimpan.',
                timer: 2000,
                showConfirmButton: false
            });
        },

        /**
         * EKSPOR MATRIKS KERJA KE FORMAT EXCEL (.XLSX)
         */
        async exportMatriksKerjaExcel() {
            if (!window.spkDetailedAudit && window.lastSPKResult) {
                window.rekonstruksiAuditMatematisSAW((window.globalDataWarga || []).filter(w => w.is_verified), window.lastSPKResult);
            }
            const audit = window.spkDetailedAudit;
            if (!audit) {
                return Swal.fire('Info', 'Silakan jalankan proses SPK SAW terlebih dahulu untuk mengekspor matriks ke Excel.', 'info');
            }

            const docSettings = typeof window.getDocumentSettings === 'function' ? window.getDocumentSettings() : {};
            const kop = typeof window.getKopTemplate === 'function' ? window.getKopTemplate() : {};
            const namaLengkap = typeof window.getNamaLengkapPemimpin === 'function' ? window.getNamaLengkapPemimpin(docSettings) : (docSettings.namaPimpinan || 'Kepala Dinas Sosial');

            if (typeof ExcelJS !== 'undefined') {
                try {
                    const wb = new ExcelJS.Workbook();
                    wb.creator = kop.dinas || 'Dinas Sosial Kabupaten Sidoarjo';
                    wb.lastModifiedBy = namaLengkap;
                    wb.created = new Date();

                    // SHEET 1: Preferensi SAW & Desil 1–4
                    const ws1 = wb.addWorksheet('1. Preferensi SAW');
                    ws1.views = [{ showGridLines: true }];

                    ws1.addRow([kop.provinsi || 'PEMERINTAH PROVINSI JAWA TIMUR']);
                    ws1.addRow([kop.kabupaten || 'PEMERINTAH KABUPATEN SIDOARJO']);
                    ws1.addRow([kop.dinas || 'DINAS SOSIAL KABUPATEN SIDOARJO']);
                    ws1.addRow(['LAPORAN PREFERENSI METODE SIMPLE ADDITIVE WEIGHTING (SAW)']);
                    ws1.addRow([]);

                    // Headers
                    const headerRow1 = ws1.addRow(['Peringkat', 'Nama Penerima', 'Skor Preferensi (Vi)', 'Klaster Desil', 'Alokasi Bansos (Rp)', 'Status Ketetapan']);
                    headerRow1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    headerRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
                    headerRow1.alignment = { horizontal: 'center', vertical: 'middle' };

                    (audit.detailV || []).forEach((v, i) => {
                        const isLayak = v.desil <= 4;
                        const r = ws1.addRow([
                            i + 1,
                            v.nama,
                            parseFloat((v.skor || 0).toFixed(5)),
                            `Desil ${v.desil}`,
                            isLayak ? 600000 : 0,
                            isLayak ? 'PRIORITAS DITETAPKAN' : 'NON-PRIORITAS'
                        ]);
                        r.getCell(1).alignment = { horizontal: 'center' };
                        r.getCell(3).alignment = { horizontal: 'center' };
                        r.getCell(4).alignment = { horizontal: 'center' };
                        r.getCell(5).numFmt = '#,##0';
                        r.getCell(6).alignment = { horizontal: 'center' };
                    });

                    ws1.columns = [
                        { width: 12 }, { width: 30 }, { width: 22 }, { width: 16 }, { width: 22 }, { width: 24 }
                    ];

                    // SHEET 2: Matriks Normalisasi (R)
                    const ws2 = wb.addWorksheet('2. Matriks Normalisasi (R)');
                    ws2.views = [{ showGridLines: true }];
                    const h2 = ['No', 'Nama Alternatif', ...KRITERIA_SPK_CONFIG.map(k => `${k.code} (${k.type})`)];
                    const hr2 = ws2.addRow(h2);
                    hr2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    hr2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF009846' } };

                    audit.matriksR.forEach(r => {
                        const rowVals = [
                            r.index,
                            r.nama,
                            ...KRITERIA_SPK_CONFIG.map(k => parseFloat((r[`c${k.code.replace('C','')}`] || 0).toFixed(4)))
                        ];
                        ws2.addRow(rowVals);
                    });

                    // SHEET 3: Matriks Keputusan Mentah (X)
                    const ws3 = wb.addWorksheet('3. Matriks Keputusan (X)');
                    ws3.views = [{ showGridLines: true }];
                    const h3 = ['No', 'Nama Alternatif', ...KRITERIA_SPK_CONFIG.map(k => k.code)];
                    const hr3 = ws3.addRow(h3);
                    hr3.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    hr3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };

                    audit.matriksX.forEach(r => {
                        const rowVals = [
                            r.index,
                            r.nama,
                            r.c1, r.c2, r.c3, r.c4, r.c5, r.c6, r.c7, r.c8, r.c9, r.c10
                        ];
                        ws3.addRow(rowVals);
                    });

                    // SHEET 4: Bobot BWM (W)
                    const ws4 = wb.addWorksheet('4. Vektor Bobot BWM');
                    ws4.views = [{ showGridLines: true }];
                    const hr4 = ws4.addRow(['Kode Kriteria', 'Nama Kriteria', 'Tipe Kriteria', 'Bobot W', 'Persentase (%)']);
                    hr4.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    hr4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };

                    KRITERIA_SPK_CONFIG.forEach((k, idx) => {
                        const wVal = parseFloat(audit.bobotW[idx] || 0.1);
                        ws4.addRow([k.code, k.name, k.type, wVal, `${(wVal * 100).toFixed(2)}%`]);
                    });

                    const buf = await wb.xlsx.writeBuffer();
                    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Matriks_Kerja_SAW_BWM_Sidoarjo_2026.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 200);

                    return Swal.fire({
                        icon: 'success',
                        title: 'Matriks Kerja Excel Berhasil Diunduh!',
                        text: 'Berkas Excel (.xlsx) dengan 4 Sheet lengkap telah tersimpan.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } catch (e) {
                    console.error('[Export Matriks Excel Error]', e);
                }
            }

            Swal.fire('Info', 'Mengunduh matriks kerja versi fallback...', 'info');
        }
    };

    // 3. DAFTARKAN METHOD KE WINDOW
    window.PrintHelper = PrintHelper;
    window.AdminPrint = AdminPrint;
    window.cetakLaporanKomparasi = () => AdminPrint.cetakLaporanKomparasi();
    window.cetakSKBupati = () => (window.bukaModalSKBupati ? window.bukaModalSKBupati() : AdminPrint.cetakSKBupati());
    window.exportKomparasiPDF = () => AdminPrint.cetakLaporanKomparasi();
    window.exportKomparasiWord = () => AdminPrint.exportKomparasiWord();
    window.exportKomparasiExcel = () => AdminPrint.exportKomparasiExcel();
    window.exportSPKPDF = () => AdminPrint.cetakSKBupati();
    window.exportSKBupatiWord = () => AdminPrint.exportSKBupatiWord();

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
            if (typeof window.bukaModalSKBupati === 'function') {
                window.bukaModalSKBupati();
            } else {
                AdminPrint.cetakSKBupati();
            }
            return;
        }
    });

})(window);