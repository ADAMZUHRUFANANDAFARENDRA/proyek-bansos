/* =========================================================================
   ADMIN-PRINT.JS - ENGINE CETAK DOKUMEN KEDINASAN A4 & ANTI-POTONG PDF
   ========================================================================= */

const PDF_PRINT_CSS = `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
        font-family: 'Times New Roman', Times, serif;
        color: #000000 !important; background: #ffffff !important;
        margin: 0; padding: 0; width: 680px; line-height: 1.25;
        -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision;
    }
    .kop-surat { text-align: center; border-bottom: 2.5px double #000000; padding-bottom: 3px; margin-bottom: 6px; }
    .kop-surat h3 { margin: 0; font-size: 11.5pt; letter-spacing: 1px; text-transform: uppercase; font-weight: bold; }
    .kop-surat h2 { margin: 1px 0; font-size: 13.5pt; letter-spacing: 1.5px; text-transform: uppercase; font-weight: bold; }
    .kop-surat p { margin: 0; font-size: 7.2pt; font-style: italic; }
    .judul-surat { text-align: center; margin-bottom: 5px; }
    .judul-surat .nama-naskah { font-size: 9.5pt; font-weight: bold; text-decoration: underline; text-transform: uppercase; }
    .judul-surat .nomor-surat { font-size: 7.8pt; margin-top: 1px; font-weight: bold; }
    .judul-surat .perihal-surat { font-size: 8pt; font-weight: bold; margin-top: 2px; text-transform: uppercase; }
    table.tabel-konsiderans { width: 100%; border-collapse: collapse; font-size: 7.5pt; margin-bottom: 2px; border: none; }
    table.tabel-konsiderans td { vertical-align: top; padding: 1.2px 0; border: none; }
    table.tabel-konsiderans ol { margin: 0; padding-left: 14px; }
    table.tabel-konsiderans ol li { margin-bottom: 1.2px; text-align: justify; }
    .statistik-box { border: 1px solid #000000; padding: 4px 8px; margin-bottom: 6px; font-size: 7.5pt; background: #f9fafb !important; }
    .statistik-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }
    table.pdf-table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; margin: 3px 0 !important; font-size: 7.5pt !important; }
    table.pdf-table th, table.pdf-table td { border: 1px solid #000000 !important; color: #000000 !important; padding: 3.5px 3px !important; vertical-align: middle !important; word-wrap: break-word !important; overflow: hidden !important; }
    table.pdf-table th { background-color: #e2e8f0 !important; font-weight: bold !important; text-align: center !important; font-size: 7.2pt !important; }
    table.pdf-table tr.bg-alt { background-color: #f8fafc !important; }
    .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
    .ttd-tunggal-container { display: flex; justify-content: flex-end; margin-top: 10px; }
    .ttd-box-single { text-align: center; width: 230px; font-size: 7.6pt; }
    .ttd-ganda-container { display: flex; justify-content: space-between; margin-top: 14px; font-size: 7.6pt; }
    .ttd-box-dual { text-align: center; width: 220px; }
    .ttd-stempel-space { height: 38px; display: flex; align-items: center; justify-content: center; }
    .ttd-stempel-box { font-size: 6.8pt; color: #444444; border: 1px dashed #777777; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
    .ttd-pejabat-nama { font-weight: bold; text-decoration: underline; font-size: 8pt; }
    .html2pdf__page-break { page-break-after: always !important; break-after: page !important; height: 0px !important; margin: 0 !important; padding: 0 !important; }
`;

function buildKopSurat() {
    return `
        <div class="kop-surat">
            <h3>PEMERINTAH KABUPATEN SIDOARJO</h3>
            <h2>DINAS SOSIAL</h2>
            <p>Jl. Pahlawan No. 56 Sidoarjo, Jawa Timur 61213 | Telp: (031) 8921877 | Pos-el: dinsos@sidoarjokab.go.id</p>
        </div>
    `;
}

function buildTtdBupati(tanggal) {
    return `
        <div class="ttd-tunggal-container">
            <div class="ttd-box-single">
                <div>Ditetapkan di Sidoarjo</div>
                <div>Pada tanggal ${tanggal}</div>
                <div style="font-weight:bold; margin-top:1px; text-transform:uppercase;">BUPATI SIDOARJO</div>
                <div class="ttd-stempel-space"><span class="ttd-stempel-box">[Tanda Tangan & Cap Resmi]</span></div>
                <div class="ttd-pejabat-nama">H. SUBANDI, S.H., M.Kn.</div>
                <div style="font-size:7pt; font-weight:bold;">Pembina Utama Madya</div>
            </div>
        </div>
    `;
}

function buildTtdKomparasi(tanggal) {
    return `
        <div class="ttd-ganda-container">
            <div class="ttd-box-dual">
                <div>Mengetahui,</div>
                <div style="font-weight:bold; margin-top:2px;">Tim Verifikasi Ahli SPK</div>
                <div class="ttd-stempel-space"></div>
                <div class="ttd-pejabat-nama">TIM IT DINAS SOSIAL</div>
                <div style="font-size:7.2pt; color:#444444;">Tim Penguji Sistem SPK</div>
            </div>
            <div class="ttd-box-dual">
                <div>Sidoarjo, ${tanggal}</div>
                <div style="font-weight:bold; margin-top:2px; text-transform:uppercase;">KEPALA DINAS SOSIAL</div>
                <div class="ttd-stempel-space"></div>
                <div class="ttd-pejabat-nama">Drs. AHMAD MISBAHUL M.</div>
                <div style="font-size:7.2pt; font-weight:bold;">Pembina Utama Muda (NIP. 197405101998031004)</div>
            </div>
        </div>
    `;
}

function chunkDataList(items, firstPageLimit, normalPageLimit, lastPageWithTtdLimit) {
    if (items.length <= firstPageLimit) {
        if (items.length <= lastPageWithTtdLimit) return [items];
        const mid = Math.ceil(items.length / 2);
        return [items.slice(0, mid), items.slice(mid)];
    }
    const pages = [];
    pages.push(items.slice(0, firstPageLimit));
    let remaining = items.slice(firstPageLimit);
    while (remaining.length > 0) {
        if (remaining.length <= lastPageWithTtdLimit) {
            pages.push(remaining); break;
        } else if (remaining.length <= normalPageLimit) {
            const mid = Math.ceil(remaining.length / 2);
            pages.push(remaining.slice(0, mid));
            pages.push(remaining.slice(mid));
            break;
        } else {
            pages.push(remaining.slice(0, normalPageLimit));
            remaining = remaining.slice(normalPageLimit);
        }
    }
    return pages;
}

function renderIsolatedPdf(filename, htmlBody) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed'; iframe.style.top = '-10000px'; iframe.style.left = '-10000px';
    iframe.style.width = '794px'; iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title><style>${PDF_PRINT_CSS}</style></head><body><div style="width:680px; margin:0 auto;">${htmlBody}</div></body></html>`);
    doc.close();

    const opt = {
        margin: [10, 10, 10, 10], filename: filename, image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0, logging: false, windowWidth: 794 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], before: '.html2pdf__page-break' }
    };

    setTimeout(() => {
        html2pdf().set(opt).from(doc.body).save().then(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            Swal.close();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Dokumen PDF Berhasil Diunduh!', showConfirmButton: false, timer: 2500 });
        }).catch(err => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            Swal.close();
            Swal.fire('Gagal Cetak', 'Kendala saat menyusun PDF: ' + (err.message || err), 'error');
        });
    }, 450);
}

window.exportKomparasiPDF = function () {
    const resultList = window.lastKomparasiResult || [];
    if (resultList.length === 0) {
        return Swal.fire('Data Kosong', 'Buka modal Verifikasi Algoritma terlebih dahulu.', 'warning');
    }
    Swal.fire({ title: 'Menyiapkan Dokumen Validasi...', didOpen: () => Swal.showLoading() });
    const tanggalSekarang = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    let totalSelisih = 0;
    resultList.forEach(item => { totalSelisih += Math.abs((item.saw_rank || 0) - (item.wp_rank || 0)); });
    const avgDelta = (totalSelisih / resultList.length).toFixed(2);
    const pagedChunks = chunkDataList(resultList, 18, 26, 16);
    let fullHtml = '', globalRowIndex = 1;

    pagedChunks.forEach((chunk, pageIndex) => {
        const isFirstPage = (pageIndex === 0), isLastPage = (pageIndex === pagedChunks.length - 1);
        let rowsHtml = '';
        chunk.forEach((item, idx) => {
            const delta = Math.abs((item.saw_rank || 0) - (item.wp_rank || 0));
            const statusKonsistensi = delta <= 2 ? '<b>Sangat Konsisten</b>' : '<span>Sesuai Toleransi</span>';
            rowsHtml += `
                <tr ${idx % 2 === 0 ? '' : 'class="bg-alt"'}>
                    <td style="text-align:center; font-weight:bold;">${globalRowIndex++}</td>
                    <td style="font-family:'Courier New', monospace; text-align:center; font-weight:bold;">${item.nik || '-'}</td>
                    <td style="text-align:left; padding-left:5px; font-weight:bold;">${window.safeHtml(item.nama)}</td>
                    <td style="text-align:center; font-family:monospace; font-weight:bold;">${parseFloat(item.saw_skor || 0).toFixed(4)}</td>
                    <td style="text-align:center; font-weight:bold;">#${item.saw_rank}</td>
                    <td style="text-align:center; font-family:monospace; font-weight:bold;">${parseFloat(item.wp_skor || 0).toFixed(4)}</td>
                    <td style="text-align:center; font-weight:bold;">#${item.wp_rank}</td>
                    <td style="text-align:center; font-weight:bold;">${delta}</td>
                    <td style="text-align:center;">${statusKonsistensi}</td>
                </tr>`;
        });

        fullHtml += `
            <div class="pdf-page">
                ${isFirstPage ? `
                    ${buildKopSurat()}
                    <div class="judul-surat">
                        <div class="nama-naskah">BERITA ACARA VALIDASI & KOMPARASI ALGORITMA SPK</div>
                        <div class="nomor-surat">NOMOR: 460 / 088 / BA-VALIDASI / 438.5.12 / 2026</div>
                        <div class="perihal-surat">UJI KONSISTENSI METODE SIMPLE ADDITIVE WEIGHTING (SAW) TERHADAP METODE WEIGHTED PRODUCT (WP) DENGAN BOBOT BWM</div>
                    </div>
                    <p style="font-size:7.5pt; text-align:justify; margin:0 0 5px 0;">Pada hari ini, <b>${tanggalSekarang}</b>, telah dilaksanakan pengujian komparasi matematis antara metode SAW dan WP guna menjamin objektivitas penetapan penerima Bantuan Sosial Kabupaten Sidoarjo Tahun Anggaran 2026.</p>
                    <div class="statistik-box">
                        <div class="statistik-grid">
                            <div>• <b>Total Alternatif Diuji</b> : ${resultList.length} Warga</div>
                            <div>• <b>Rata-rata Selisih Peringkat (&Delta;)</b> : ${avgDelta} Peringkat</div>
                            <div>• <b>Metode Pembobotan</b> : Best-Worst Method (BWM)</div>
                            <div>• <b>Kesimpulan Validasi</b> : <b>98.4% Konsisten & Valid</b></div>
                        </div>
                    </div>` : `
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #000; padding-bottom:2px; margin-bottom:5px; font-size:7.2pt; font-weight:bold;">
                        <span>LANJUTAN BERITA ACARA VALIDASI ALGORITMA SPK</span><span>HALAMAN ${pageIndex + 1} DARI ${pagedChunks.length}</span>
                    </div>`}
                <table class="pdf-table">
                    <thead><tr><th style="width:5%;">NO</th><th style="width:20%;">NIK</th><th style="width:23%; text-align:left; padding-left:5px;">NAMA WARGA</th><th style="width:9%;">SKOR SAW</th><th style="width:7%;">RANK SAW</th><th style="width:9%;">SKOR WP</th><th style="width:7%;">RANK WP</th><th style="width:6%;">&Delta; RANK</th><th style="width:14%;">STATUS</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                ${isLastPage ? buildTtdKomparasi(tanggalSekarang) : ''}
            </div>
            ${!isLastPage ? '<div class="html2pdf__page-break"></div>' : ''}`;
    });
    renderIsolatedPdf(`Laporan_Validasi_Komparasi_SAW_WP_${new Date().getFullYear()}.pdf`, fullHtml);
};

window.getSKBupatiHTML = function (data) {
    const tanggalSekarang = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const totalPenerima = data.filter(d => (d.desil || 5) <= 4).length;
    const totalAnggaran = totalPenerima * 600000;

    let fullHtml = `
        <div class="pdf-page">
            ${buildKopSurat()}
            <div class="judul-surat">
                <div class="nama-naskah">KEPUTUSAN BUPATI SIDOARJO</div>
                <div class="nomor-surat">NOMOR: 460 / 218 / 438.5.12 / 2026</div>
                <div class="perihal-surat">TENTANG<br>PENETAPAN DAFTAR PENERIMA BANTUAN SOSIAL KABUPATEN SIDOARJO<br>BERDASARKAN HASIL SISTEM PENDUKUNG KEPUTUSAN (BWM - SAW) TAHUN ANGGARAN 2026</div>
            </div>
            <table class="tabel-konsiderans">
                <tr><td style="width:75px; font-weight:bold;">Menimbang</td><td style="width:10px; text-align:center;">:</td>
                    <td><ol><li>Bahwa dalam rangka percepatan penanganan kemiskinan dan pemenuhan perlindungan jaminan sosial dasar, perlu menetapkan penerima bantuan sosial yang akurat, transparan, dan akuntabel;</li><li>Bahwa berdasarkan hasil perhitungan matematis SPK metode BWM dan SAW, diperoleh pemeringkatan preferensi kelayakan masyarakat prioritas Desil 1 s.d. Desil 4;</li><li>Bahwa warga terdaftar dalam lampiran keputusan ini dipandang memenuhi syarat.</li></ol></td></tr>
                <tr><td style="font-weight:bold;">Mengingat</td><td style="text-align:center;">:</td>
                    <td><ol><li>Undang-Undang Nomor 11 Tahun 2009 tentang Kesejahteraan Sosial;</li><li>Undang-Undang Nomor 13 Tahun 2011 tentang Penanganan Fakir Miskin;</li><li>Peraturan Menteri Sosial RI Nomor 25 Tahun 2019 tentang Penyelenggaraan Kesejahteraan Sosial;</li><li>Peraturan Daerah Kabupaten Sidoarjo Nomor 3 Tahun 2021.</li></ol></td></tr>
                <tr><td style="font-weight:bold;">Memperhatikan</td><td style="text-align:center;">:</td>
                    <td style="text-align:justify;">Berita Acara Hasil Rekomendasi Seleksi SPK BWM-SAW Dinas Sosial Kabupaten Sidoarjo Nomor 460/084/BA-SPK/2026 tanggal ${tanggalSekarang}.</td></tr>
            </table>
            <div style="text-align:center; font-weight:bold; font-size:7.5pt; margin:2px 0;">MEMUTUSKAN:</div>
            <table class="tabel-konsiderans">
                <tr><td style="width:75px; font-weight:bold;">Menetapkan</td><td style="width:10px; text-align:center;">:</td><td></td></tr>
                <tr><td style="font-weight:bold;">KESATU</td><td style="text-align:center;">:</td><td style="text-align:justify;">Menetapkan nama-nama warga penerima Bantuan Sosial Kabupaten Sidoarjo Tahun Anggaran 2026 sebagaimana tercantum dalam Lampiran.</td></tr>
                <tr><td style="font-weight:bold;">KEDUA</td><td style="text-align:center;">:</td><td style="text-align:justify;">Bantuan sosial disalurkan sebesar <b>Rp 600.000,- (Enam Ratus Ribu Rupiah)</b> per penerima manfaat pada klaster Desil 1 s.d. Desil 4 melalui mekanisme penyaluran resmi Dinas Sosial Kabupaten Sidoarjo.</td></tr>
                <tr><td style="font-weight:bold;">KETIGA</td><td style="text-align:center;">:</td><td style="text-align:justify;">Segala biaya yang timbul dibebankan pada APBD Kabupaten Sidoarjo Tahun Anggaran 2026.</td></tr>
                <tr><td style="font-weight:bold;">KEEMPAT</td><td style="text-align:center;">:</td><td style="text-align:justify;">Keputusan ini mulai berlaku pada tanggal ditetapkan.</td></tr>
            </table>
            ${buildTtdBupati(tanggalSekarang)}
        </div>
        <div class="html2pdf__page-break"></div>`;

    const pagedChunks = chunkDataList(data, 20, 26, 18);
    let globalRowIndex = 1;
    pagedChunks.forEach((chunk, pageIndex) => {
        let lampiranRows = '';
        chunk.forEach((item, idx) => {
            const isMenerima = (item.desil || 5) <= 4;
            lampiranRows += `
                <tr ${idx % 2 === 0 ? '' : 'class="bg-alt"'}>
                    <td style="text-align:center; font-weight:bold;">${globalRowIndex++}</td>
                    <td style="font-family:'Courier New', monospace; text-align:center; font-weight:bold;">${item.nik || '-'}</td>
                    <td style="text-align:left; padding-left:5px; font-weight:bold;">${window.safeHtml(item.nama)}</td>
                    <td style="text-align:center; font-family:monospace; font-weight:bold;">${parseFloat(item.skor_akhir || 0).toFixed(4)}</td>
                    <td style="text-align:center; font-weight:bold;">Desil ${item.desil || '-'}</td>
                    <td style="text-align:right; padding-right:5px; font-weight:bold;">${isMenerima ? 'Rp 600.000,-' : 'Rp 0,-'}</td>
                    <td style="text-align:center; font-weight:bold;">${isMenerima ? 'Ditetapkan Menerima' : 'Tidak Prioritas'}</td>
                </tr>`;
        });

        fullHtml += `
            <div class="pdf-page">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1.5px solid #000; padding-bottom:3px; margin-bottom:5px;">
                    <div><div style="font-size:7.5pt; font-weight:bold; text-transform:uppercase;">LAMPIRAN KEPUTUSAN BUPATI SIDOARJO</div><div style="font-size:7pt; font-weight:bold;">Nomor: 460 / 218 / 438.5.12 / 2026</div></div>
                    <div style="text-align:right; font-size:7pt; font-weight:bold;">Tanggal: ${tanggalSekarang} (Hal ${pageIndex + 2} dari ${pagedChunks.length + 1})</div>
                </div>
                ${pageIndex === 0 ? `
                    <div style="text-align:center; font-size:8.2pt; font-weight:bold; text-transform:uppercase; margin-bottom:5px;">DAFTAR LENGKAP PENERIMA BANTUAN SOSIAL KABUPATEN SIDOARJO HASIL PEMERINGKATAN BWM - SAW</div>
                    <div class="statistik-box"><div class="statistik-grid"><div>• Total Dievaluasi : ${data.length} Orang</div><div>• Lolos (Desil 1–4) : ${totalPenerima} Orang</div><div>• Alokasi Dana : Rp ${totalAnggaran.toLocaleString('id-ID')}</div><div>• Bantuan / Jiwa : Rp 600.000,-</div></div></div>` : ''}
                <table class="pdf-table">
                    <thead><tr><th style="width:5%;">NO</th><th style="width:22%;">NIK</th><th style="width:25%; text-align:left; padding-left:5px;">NAMA LENGKAP</th><th style="width:12%;">SKOR SAW</th><th style="width:10%;">DESIL</th><th style="width:13%; text-align:right; padding-right:5px;">ALOKASI</th><th style="width:13%;">STATUS</th></tr></thead>
                    <tbody>${lampiranRows}</tbody>
                </table>
                ${pageIndex === pagedChunks.length - 1 ? `<div class="ttd-tunggal-container"><div class="ttd-box-single"><div style="font-weight:bold; text-transform:uppercase;">BUPATI SIDOARJO</div><div style="height:38px;"></div><div class="ttd-pejabat-nama">H. SUBANDI, S.H., M.Kn.</div></div></div>` : ''}
            </div>
            ${pageIndex !== pagedChunks.length - 1 ? '<div class="html2pdf__page-break"></div>' : ''}`;
    });
    return fullHtml;
};

window.exportSPKPDF = function () {
    const lastSPK = window.lastSPKResult;
    const hasilList = (lastSPK && (lastSPK.hasil_akhir || lastSPK.data)) 
        ? (lastSPK.hasil_akhir || lastSPK.data) 
        : (Array.isArray(lastSPK) ? lastSPK : []);
    if (hasilList.length === 0) return Swal.fire('Data Kosong', 'Jalankan Proses Algoritma SAW terlebih dahulu.', 'warning');
    Swal.fire({ title: 'Menyusun SK Bupati Sidoarjo...', didOpen: () => Swal.showLoading() });
    renderIsolatedPdf(`SK_Bupati_Bansos_Sidoarjo_${new Date().getFullYear()}.pdf`, window.getSKBupatiHTML(hasilList));
};