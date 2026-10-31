/**
 * Modul: publik-chatbot.js
 * Deskripsi: Asisten virtual cerdas informasi bantuan sosial Kabupaten Sidoarjo
 * Mencakup seluruh tahapan sistem bansos, NLP semantik responsif, filter kata kotor & luar konteks.
 */

// 14. CHATBOT ASISTEN VIRTUAL & INVESTIGASI SENGKETA
// =========================================================================
window.toggleChatbotWindow = window.toggleModernChatbot = function () {
    const win = document.getElementById('chatbotWindow') || document.getElementById('chatbotBox');
    if (!win) return;
    const isVisible = (win.style.display === 'flex' || win.style.display === 'block');
    win.style.display = isVisible ? 'none' : 'flex';
};

window.botReplyFAQ = function (topic) {
    const body = document.getElementById('chatbotMsgBody') || document.getElementById('chatbotMessages');
    if (!body) return;

    let qText = '';
    let topicKey = topic;

    if (topic === 'tahapan') {
        qText = 'Apa saja tahapan lengkap pendaftaran s/d pencairan bansos?';
    } else if (topic === 'daftar') {
        qText = 'Bagaimana cara daftar bansos mandiri secara online?';
    } else if (topic === 'spk' || topic === 'kriteria') {
        qText = 'Bagaimana algoritma SPK BWM-SAW dan desil dihitung?';
        topicKey = 'spk';
    } else if (topic === 'sk_bupati') {
        qText = 'Bagaimana cara memeriksa dan mengunduh SK Bupati?';
    } else if (topic === 'rekap' || topic === 'jadwal') {
        qText = 'Kapan jadwal penyaluran 3 bulanan dan pencairan fisik?';
        topicKey = 'rekap';
    } else if (topic === 'sanggah' || topic === 'aduan') {
        qText = 'Bagaimana cara mengajukan sanggah jika desil tidak sesuai?';
        topicKey = 'aduan';
    } else if (topic === 'konsultasi') {
        qText = 'Bagaimana cara chat atau video call dengan petugas?';
    } else if (topic === 'privasi') {
        qText = 'Apakah data NIK dan KTP saya aman sesuai UU PDP?';
    } else {
        qText = topic;
    }

    body.innerHTML += `<div class="user-bubble" style="background:#0284c7; color:white; padding:10px 14px; border-radius:14px; align-self:flex-end; max-width:85%; margin-bottom:8px; font-size:0.86rem; box-shadow:0 2px 4px rgba(2,132,199,0.2);">${qText}</div>`;
    body.scrollTop = body.scrollHeight;

    setTimeout(() => {
        const balasan = window.getJawabanCerdasBot(topicKey || qText);
        body.innerHTML += `<div class="bot-bubble" style="background:white; padding:12px 16px; border-radius:14px; border:1px solid #e2e8f0; font-size:0.86rem; line-height:1.55; margin-bottom:8px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">${balasan}</div>`;
        body.scrollTop = body.scrollHeight;
    }, 300);
};

window.getJawabanCerdasBot = function (teks) {
    const raw = (teks || '').trim();
    const t = raw.toLowerCase();

    // 1. FILTER KATA KOTOR / VULGAR / KASAR
    const kataKotorRegex = /\b(anjing|asu|babi|bangsat|jancok|dancok|cok|kontol|memek|jembut|ngentot|pantek|bajingan|kampret|bego|goblok|tolol|tai|taek|sialan|setan|iblis|biadab|peler|peli|itil|bejad|pecun|lontong|lonte|sundal|brengsek|matamu|jangkrik|cuk|monyet|pepek|titit|ngaceng|kimak|pukimak|bangke)\b/i;
    if (kataKotorRegex.test(t)) {
        return `
            <div style="background:#fff1f2; border:1px solid #fecdd3; border-left:4px solid #e11d48; border-radius:10px; padding:12px; color:#9f1239; font-size:0.84rem; line-height:1.55;">
                <div style="font-weight:800; display:flex; align-items:center; gap:6px; margin-bottom:6px; color:#be123c;">
                    <i class="fas fa-exclamation-triangle"></i> PERINGATAN ETIKA KOMUNIKASI RESMI
                </div>
                Sistem mendeteksi penggunaan kata yang <b>tidak pantas, kasar, atau melanggar etika komunikasi</b>.<br><br>
                Mohon gunakan tutur bahasa yang santun, tertib, dan beretika demi kenyamanan bersama dalam menggunakan layanan publik Pemerintah Kabupaten Sidoarjo. Pertanyaan Anda yang mengandung kata kotor <b>tidak dapat diproses</b> oleh sistem.
            </div>
        `;
    }

    // 2. FILTER DI LUAR KONTEKS BANSOS & SISTEM
    const luarKonteksKeywords = [
        'resep', 'masak', 'kue', 'makanan enak', 'game', 'cheat', 'slot', 'zeus', 'judi', 'taruhan', 'betting',
        'sepak bola', 'bola', 'liga champion', 'liga inggris', 'manchester', 'chelsea', 'arsenal', 'persib', 'persebaya',
        'anime', 'naruto', 'one piece', 'boruto', 'manga', 'ramalan', 'zodiak', 'horoskop', 'pacar', 'jodoh',
        'cinta', 'film', 'drakor', 'nonton film', 'chord', 'lirik lagu', 'kalkulus', 'rumus fisika',
        'python', 'javascript', 'bikin web', 'presiden amerika', 'beli motor', 'mobil bekas', 'cuaca di jepang'
    ];
    const isLuarKonteks = luarKonteksKeywords.some(kw => t.includes(kw));
    if (isLuarKonteks) {
        return `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-left:4px solid #0284c7; border-radius:10px; padding:12px; color:#0f172a; font-size:0.84rem; line-height:1.55;">
                <div style="font-weight:800; display:flex; align-items:center; gap:6px; margin-bottom:6px; color:#0369a1;">
                    <i class="fas fa-info-circle"></i> PEMBERITAHUAN LINGKUP LAYANAN
                </div>
                Maaf, pertanyaan Anda berada di <b>luar konteks dan lingkup sistem layanan Bantuan Sosial Terpadu Kabupaten Sidoarjo</b>.<br><br>
                Asisten pintar ini dikhususkan untuk memandu Anda terkait seluruh tahapan sistem bansos:
                <ul style="margin:6px 0 8px 16px; padding:0; color:#334155; font-size:0.82rem;">
                    <li><b>Tahap 1:</b> Pendaftaran mandiri & verifikasi NIK Dukcapil</li>
                    <li><b>Tahap 2:</b> Penilaian algoritma SPK BWM-SAW & penetapan Desil 1–10</li>
                    <li><b>Tahap 3:</b> Dokumen sah SK Bupati Sidoarjo (Sertifikat BSrE BSSN)</li>
                    <li><b>Tahap 4:</b> Rekapitulasi penyaluran 3 bulanan & mutasi data C1–C39</li>
                    <li><b>Tahap 5:</b> Sanggah kelayakan, mediasi aduan, & perisai sengketa</li>
                    <li><b>Tahap 6:</b> Konsultasi interaktif pesan, suara & video call dengan aparatur</li>
                </ul>
                Silakan pilih topik bantuan cepat pada tombol di atas atau ketik pertanyaan seputar bansos Sidoarjo!
            </div>
        `;
    }

    // 3. TAHAPAN LENGKAP SISTEM BANSOS SIDOARJO (ROADMAP END-TO-END)
    if (t.includes('tahap') && (t.includes('lengkap') || t.includes('alur') || t.includes('proses') || t.includes('semua') || t.includes('urutan') || t.includes('awal sampai akhir') || t.includes('bagaimana') || t.includes('mekanisme') || t.includes('siklus') || t.includes('cara kerja'))) {
        return `
            <b><i class="fas fa-route text-primary"></i> 6 Tahapan Lengkap Sistem Bantuan Sosial Sidoarjo:</b><br><br>
            <b>1. Pendaftaran Mandiri & Validasi Dukcapil:</b> Warga mendaftar online via tab <i>Daftar Mandiri</i> dengan NIK 16 digit, KK, dan foto hunian terkunci titik GPS.<br>
            <b>2. Penilaian Algoritma SPK (BWM - SAW):</b> Sistem menghitung otomatis bobot 10 kriteria analitik (C1–C10) untuk menetapkan peringkat Desil 1–10 secara adil tanpa calo.<br>
            <b>3. Penetapan Resmi SK Bupati:</b> Hasil perankingan disahkan melalui Surat Keputusan Bupati Sidoarjo berotentikasi digital <b>BSrE BSSN</b>.<br>
            <b>4. Penyaluran Dana 3 Bulanan (Triwulanan):</b> Bantuan fisik (uang/sembako) disalurkan setiap 3 bulan (Triwulan I–IV) disertai evaluasi pemutakhiran mutasi data C1–C39.<br>
            <b>5. Mediasi Sanggah & Aduan Sengketa:</b> Jika ada ketidaksesuaian desil atau belum menerima fisik, warga dapat melapor di tab <i>Pantau Aduan</i>.<br>
            <b>6. Konsultasi Interaktif Aparatur:</b> Warga dapat berkonsultasi langsung melalui Live Chat, Voice Note, serta Panggilan Telepon/Video WebRTC resmi.
        `;
    }

    // 4. METRIK SPK & ALGORITMA BWM - SAW & DESIL KELAYAKAN
    if (t.includes('spk') || t.includes('metrik') || t.includes('saw') || t.includes('bwm') || t.includes('hitung') || t.includes('kalkulasi') || t.includes('algoritma') || t.includes('bobot') || t.includes('rumus') || t.includes('desil') || t.includes('kelayakan') || t.includes('siapa dapat') || t.includes('kategori miskin')) {
        return `
            <b><i class="fas fa-calculator text-primary"></i> Penilaian Algoritma SPK BWM - SAW & Desil:</b><br>
            Sistem menggunakan kombinasi dua metode ilmiah untuk menjamin transparansi mutlak:<br>
            • <b>Best-Worst Method (BWM):</b> Mengukur bobot prioritas 10 kriteria kependudukan (C1 Penghasilan, C2 Tanggungan, C3 Kondisi Dinding, C4 Luas Lantai, C5 Daya Listrik, C6 Sumber Air, C7 Aset Bergerak, C8 Status Tempat Tinggal, C9 Disabilitas/Penyakit Menahun, C10 Usia Lansia).<br>
            • <b>Simple Additive Weighting (SAW):</b> Menormalisasi matriks skor warga dan mengurutkan peringkat secara objektif.<br><br>
            <b>Klasifikasi Desil:</b><br>
            • <b>Desil 1–4:</b> Kategori Sangat Miskin s/d Rentan (<b>Prioritas Utama</b> penerima bantuan Rp 600.000 / paket sembako).<br>
            • <b>Desil 5–10:</b> Kategori Mandiri / Mampu (Non-Prioritas).<br>
            <br>👉 Buka tab <b>"Metrik SPK & SK Bupati"</b> dan verifikasi identitas Anda untuk melihat kalkulasi nilai kriteria C1–C10 Anda.
        `;
    }

    // 5. DOKUMEN RESMI SK BUPATI SIDOARJO (BSrE BSSN)
    if (t.includes('sk') || t.includes('bupati') || t.includes('surat keputusan') || t.includes('penetapan') || t.includes('bsre') || t.includes('bssn') || t.includes('tanda tangan bupati') || t.includes('petikan') || t.includes('legalitas')) {
        return `
            <b><i class="fas fa-file-signature text-primary"></i> Keputusan Resmi Bupati Sidoarjo:</b><br>
            KPM penerima bansos disahkan melalui <b>Surat Keputusan Bupati Sidoarjo Nomor 188/460/438.5.12/2026</b> tentang Penetapan Penerima Bantuan Sosial Terpadu Berdasarkan SPK BWM-SAW.<br><br>
            • <b>Legalitas Hukum:</b> Dokumen ini ditandatangani secara elektronik bersertifikat resmi <b>BSrE Badan Siber dan Sandi Negara (BSSN)</b> sehingga sah dan berkekuatan hukum tetap.<br>
            • <b>Salinan Petikan:</b> Setiap warga terdaftar berhak memeriksa penetapan nama dan mengunduh salinan petikan resmi SK Bupati berstempel dinas di tab <b>"Metrik SPK & SK Bupati"</b>.
        `;
    }

    // 6. REKAPITULASI 3 BULANAN, JADWAL PENCAIRAN & MUTASI DATA C1-C39
    if (t.includes('rekap') || t.includes('3 bulan') || t.includes('tiga bulan') || t.includes('triwulan') || t.includes('cair') || t.includes('kapan cair') || t.includes('uang') || t.includes('jadwal') || t.includes('nominal') || t.includes('mutasi') || t.includes('perubahan') || t.includes('desa') || t.includes('kelurahan')) {
        return `
            <b><i class="fas fa-calendar-check text-primary"></i> Rekap Penyaluran 3 Bulanan (Triwulanan) & Mutasi:</b><br>
            Penyaluran bantuan sosial dilaksanakan bertahap setiap 3 bulan sekali:<br>
            • <b>Triwulan I:</b> Januari – Maret<br>
            • <b>Triwulan II:</b> April – Juni<br>
            • <b>Triwulan III:</b> Juli – September<br>
            • <b>Triwulan IV:</b> Oktober – Desember (Tahap Berjalan 2026)<br><br>
            • <b>Penyaluran Awal s/d Akhir:</b> Dana disalurkan dalam bentuk Transfer Tunai (Rp 600.000 / KPM) atau Paket Pangan Sembako melalui kantor kelurahan/desa setempat membawa KTP dan KK asli.<br>
            • <b>Pencatatan Mutasi:</b> Jika terjadi perubahan kondisi ekonomi, kematian, atau kepindahan (kriteria C1–C39), data dapat dimutasi setiap triwulan via tab <b>"Rekap 3 Bulanan"</b>.
        `;
    }

    // 7. PENDAFTARAN MANDIRI, CEK DUKCAPIL & PERSYARATAN
    if (t.includes('daftar') || t.includes('baru') || t.includes('registrasi') || t.includes('pengajuan') || t.includes('ajukan') || t.includes('ikut bansos') || t.includes('syarat') || t.includes('berkas') || t.includes('ktp') || t.includes('kk') || t.includes('geotagging') || t.includes('dukcapil')) {
        return `
            <b><i class="fas fa-user-plus text-primary"></i> Tata Cara Pendaftaran Mandiri Online:</b><br>
            1. Buka tab <b>"Daftar Mandiri"</b> pada bilah menu portal.<br>
            2. Masukkan <b>16 digit NIK KTP</b> Anda lalu klik <i>Cek Dukcapil</i> untuk validasi data kependudukan Kabupaten Sidoarjo.<br>
            3. Lengkapi formulir 10 kriteria sosial-ekonomi faktual keluarga Anda.<br>
            4. Kunci <b>titik koordinat GPS rumah</b> (Geotagging) dan unggah foto tempat tinggal asli.<br>
            5. Klik <b>"Kirim Pengajuan Pendaftaran"</b>. Petugas lapangan akan memverifikasi dan algoritma SPK akan menghitung desil Anda secara otomatis.
        `;
    }

    // 8. CEK STATUS BANSOS & NIK
    if (t.includes('cek') || t.includes('status') || t.includes('nik') || t.includes('terdaftar') || t.includes('apakah saya dapat')) {
        return `
            <b><i class="fas fa-search text-primary"></i> Cara Cek Status Bantuan Sosial:</b><br>
            Buka tab <b>"Cek Status Bansos"</b> di navigasi utama portal, lalu masukkan 16 digit NIK KTP Anda.<br><br>
            Sistem akan menampilkan:<br>
            • Kelayakan desil KPM (Desil 1–10)<br>
            • Status penyaluran (Menunggu Verifikasi / Disetujui / Disalurkan / Telah Menerima)<br>
            • Nominal dan bentuk bantuan sosial yang dialokasikan.
        `;
    }

    // 9. SANGGAH DESIL, ADUAN SENGKETA & KENDALA SISTEM
    if (t.includes('aduan') || t.includes('lapor') || t.includes('sengketa') || t.includes('sanggah') || t.includes('belum terima') || t.includes('masalah') || t.includes('salah data') || t.includes('dicoret') || t.includes('gagal')) {
        return `
            <b><i class="fas fa-shield-alt text-danger"></i> Prosedur Pengaduan & Sanggah Desil:</b><br>
            Jika Anda mengalami kendala (misal: kondisi ekonomi memburuk tetapi belum masuk desil 1–4, atau data tercatat 'Telah Menerima' tetapi belum menerima fisik bantuan):<br><br>
            1. Klik tombol <b>"Laporkan Masalah / Gagal Daftar ke Admin"</b> di jendela chat ini, atau buka tab <b>"Pantau Aduan"</b>.<br>
            2. Masukkan NIK, nama lengkap, dan uraian kendala yang dialami.<br>
            3. Laporan Anda langsung memicu sinyal <b>Sengketa Penyaluran (Perisai Merah)</b> ke meja investigasi administrator untuk diverifikasi ulang di lapangan.
        `;
    }

    // 10. KONSULTASI INTERAKTIF, LIVE CHAT & PANGGILAN WEBRTC
    if (t.includes('chat') || t.includes('panggilan') || t.includes('telepon') || t.includes('telpon') || t.includes('video') || t.includes('petugas') || t.includes('hubungi') || t.includes('kontak') || t.includes('bicara')) {
        return `
            <b><i class="fas fa-headset text-primary"></i> Konsultasi Langsung dengan Petugas Dinsos:</b><br>
            Pemerintah Kabupaten Sidoarjo menyediakan 3 jalur komunikasi interaktif dua arah:<br>
            • <b>Live Chat Terpadu:</b> Kirim pesan teks, dokumen PDF/Excel, dan foto bukti fisik.<br>
            • <b>Pesan Suara (Voice Note):</b> Rekam pesan suara penjelasan kendala Anda secara praktis.<br>
            • <b>Panggilan Telepon & Video Call WebRTC HD:</b> Terhubung langsung tatap muka secara digital dengan aparatur tanpa pulsa.<br><br>
            👉 Buka tab <b>"Konsultasi Warga"</b> atau masuk ke Dashboard Pribadi Anda untuk memulai percakapan resmi.
        `;
    }

    // 11. KEAMANAN & PRIVASI DATA (UU PDP)
    if (t.includes('privasi') || t.includes('aman') || t.includes('rahasia') || t.includes('uu pdp') || t.includes('perlindungan') || t.includes('bocor')) {
        return `
            <b><i class="fas fa-user-shield text-success"></i> Standar Privasi & Keamanan Data (UU PDP No. 27/2022):</b><br>
            Seluruh data identitas kependudukan warga (NIK, Nama, Alamat, Nomor Telepon, dan Email) dilindungi secara ketat:<br>
            • Rincian metrik SPK dan SK Bupati warga lain disembunyikan demi kerahasiaan kependudukan.<br>
            • Akses data rincian KPM hanya dapat dibuka melalui verifikasi 3 lapis: <b>Nama Lengkap KTP + NIK 16 Digit + Alamat Email Terdaftar</b>.<br>
            • Komunikasi audio/video diamankan dengan enkripsi end-to-end standar WebRTC.
        `;
    }

    // 12. BESARAN BANTUAN / NOMINAL
    if (t.includes('nominal') || t.includes('berapa') || t.includes('jumlah') || t.includes('uang') || t.includes('rp') || t.includes('sembako') || t.includes('beras')) {
        return `
            <b><i class="fas fa-money-bill-wave text-success"></i> Alokasi Nilai Bantuan Sosial Sidoarjo:</b><br>
            • <b>Bantuan Tunai:</b> Rp 600.000 / KPM per periode triwulanan bagi keluarga prioritas Desil 1–4.<br>
            • <b>Bantuan Pangan / Sembako:</b> Beras premium 10 kg, minyak goreng 2 liter, dan protein bergizi.<br>
            • Rincian riwayat penerimaan awal s/d akhir per wilayah dapat dipantau langsung di tab <b>"Rekap 3 Bulanan"</b>.
        `;
    }

    // 13. JAM LAYANAN OPERASIONAL
    if (t.includes('jam') || t.includes('buka') || t.includes('jadwal') || t.includes('kapan') || t.includes('hari')) {
        return `
            <b><i class="fas fa-clock text-primary"></i> Jam Operasional Layanan Bansos:</b><br>
            • <b>Portal Layanan Online & Chatbot Asisten:</b> Aktif <b>24 Jam Nonstop</b> setiap hari.<br>
            • <b>Konsultasi Langsung & Investigasi Petugas:</b> Hari Kerja (Senin – Jumat, pukul 08.00 – 16.00 WIB).<br>
            • Aduan atau permohonan yang masuk di luar jam kerja akan diproses pada hari kerja berikutnya.
        `;
    }

    // 14. DEFAULT INTENTIONAL FALLBACK (JIKA PERTANYAAN MASIH DALAM KONTEKS BANSOS TAPI BELUM SPESIFIK)
    return `
        <b>Terima kasih telah berkonsultasi dengan Asisten Virtual Bansos Pemkab Sidoarjo.</b><br><br>
        Sistem kami siap membantu Anda di setiap tahapan layanan:<br>
        1. <b>Pendaftaran Mandiri:</b> Isi data kependudukan & geotagging rumah.<br>
        2. <b>Penilaian SPK:</b> Algoritma BWM-SAW 10 kriteria penentu desil.<br>
        3. <b>SK Bupati Sidoarjo:</b> Penetapan resmi berkekuatan hukum BSrE BSSN.<br>
        4. <b>Rekap 3 Bulanan:</b> Jadwal penyaluran triwulanan & mutasi data C1–C39.<br>
        5. <b>Pantau Aduan:</b> Mediasi sanggah jika desil tidak sesuai.<br>
        6. <b>Konsultasi Warga:</b> Live Chat & Video Call WebRTC langsung ke petugas.<br><br>
        👉 <i>Silakan ketik pertanyaan spesifik (contoh: "Bagaimana cara sanggah desil?" atau "Kapan penyaluran 3 bulanan?") atau klik opsi bantuan cepat di atas!</i>
    `;
};

window.kirimPilihanBot = function (teks) {
    const body = document.getElementById('chatbotMessages') || document.getElementById('chatbotMsgBody');
    if (!body) return;
    body.innerHTML += `<div style="background: #0284c7; color: white; padding: 10px 14px; border-radius: 14px; align-self: flex-end; font-size: 0.86rem; max-width: 85%; margin-bottom:8px; box-shadow:0 2px 4px rgba(2,132,199,0.2);">${teks}</div>`;
    body.scrollTop = body.scrollHeight;

    setTimeout(() => {
        const balasan = window.getJawabanCerdasBot(teks);
        body.innerHTML += `<div style="background: white; padding: 12px 16px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 0.86rem; line-height: 1.55; margin-bottom:8px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">${balasan}</div>`;
        body.scrollTop = body.scrollHeight;
    }, 300);
};

window.botSendMessage = window.kirimTeksBot = function () {
    const inp = document.getElementById('botInputText') || document.getElementById('chatbotInput');
    const txt = inp ? inp.value.trim() : '';
    if (!txt) return;
    inp.value = '';

    const body = document.getElementById('chatbotMsgBody') || document.getElementById('chatbotMessages');
    if (!body) return;

    // Tampilkan pesan warga di jendela chat
    const safeMsg = typeof window.safeHtml === 'function' ? window.safeHtml(txt) : txt.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    body.innerHTML += `<div style="background: #0284c7; color: white; padding: 10px 14px; border-radius: 14px; align-self: flex-end; font-size: 0.86rem; max-width: 85%; margin-bottom:8px; box-shadow:0 2px 4px rgba(2,132,199,0.2);">${safeMsg}</div>`;
    body.scrollTop = body.scrollHeight;

    setTimeout(() => {
        // Panggil NLP cerdas terintegrasi
        const botReply = window.getJawabanCerdasBot(txt);
        body.innerHTML += `<div style="background: white; padding: 12px 16px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 0.86rem; line-height: 1.55; margin-bottom:8px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">${botReply}</div>`;
        body.scrollTop = body.scrollHeight;
    }, 350);
};

window.botBukaFormLapor = window.bukaFormLaporKendalaBot = async function () {
    window.toggleChatbotWindow();

    const { value: formValues } = await Swal.fire({
        title: '<i class="fas fa-shield-virus text-danger"></i> Laporkan Masalah / Kendala Sistem',
        html: `
            <div style="text-align:left; font-size:0.88rem;">
                <p style="margin-bottom:12px; color:#64748b;">Gunakan jalur ini jika Anda mengalami kendala teknis/sistem eror, belum terdaftar, atau masalah bansos lainnya.</p>
                
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Kategori Aduan / Kendala</label>
                <select id="botSwalKategori" class="form-input" style="width:100%; padding:9px 12px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1; font-size:0.86rem;">
                    <option value="Aduan Sistem & Kendala Teknis">🚨 Aduan Sistem / Eror Aplikasi / Gangguan Teknis (Urgent)</option>
                    <option value="Aduan Belum Terdaftar" selected>⚠️ Belum Terdaftar / Kendala Registrasi Baru</option>
                    <option value="Sengketa Penyaluran Bansos">📦 Sengketa Penyaluran Bantuan Sosial</option>
                    <option value="Lainnya">📝 Kendala Teknis Lainnya</option>
                </select>

                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Nomor Induk Kependudukan (NIK)</label>
                <input type="number" id="botSwalNik" class="form-input" placeholder="16 digit NIK KTP" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1;">
                
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Nama Lengkap</label>
                <input type="text" id="botSwalNama" class="form-input" placeholder="Nama Anda" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1;">
                
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Uraian Kendala yang Dialami</label>
                <textarea id="botSwalPesan" class="form-input" rows="3" placeholder="Contoh: Terjadi eror pada sistem, gagal verifikasi, NIK tidak terbaca, dll..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;"></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Buka Dashboard Pengaduan',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const kategori = document.getElementById('botSwalKategori')?.value || 'Aduan Belum Terdaftar';
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
            return { nik, nama, pesan, kategori };
        }
    });

    if (formValues) {
        window.masukDashboardPengaduan(formValues.nik, formValues.nama, formValues.pesan, true, formValues.kategori);
    }
};

// =========================================================================
