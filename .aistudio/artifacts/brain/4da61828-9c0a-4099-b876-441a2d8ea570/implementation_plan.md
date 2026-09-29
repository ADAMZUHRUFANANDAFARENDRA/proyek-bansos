# Rencana Implementasi: Modernisasi Verifikasi Algoritma, Grafik Presisi Dokumen, Pengaturan Kertas, & QR Code TTE Valid

Dokumen ini merinci rencana teknis dan visual untuk menyempurnakan fitur **Verifikasi Algoritma (SAW vs WP)**, grafis dokumen unduhan (PDF, Word, Excel), tata letak naskah resmi, pengaturan ukuran kertas lanjutan (A4, F4/Folio, Legal, Letter, A5), serta implementasi QR Code Tanda Tangan Elektronik (TTE) standar yang dapat dipindai oleh kamera ponsel.

---

## 1. Analisis Kebutuhan & Masalah Saat Ini

Berdasarkan tinjauan tangkapan layar berkas unduhan dan permintaan pengguna:
1. **Antarmuka Verifikasi Algoritma**: Membutuhkan tampilan yang lebih modern, bersih, profesional, berkesan dasbor analitik instansi (*SaaS Dashboard Guidelines*), dengan hierarki informasi yang teratur.
2. **Grafik pada Dokumen Ekspor (PDF, Word, Excel)**:
   - Pada berkas sebelumnya, grafik tampak seperti garis tipis (*line chart*) yang squashed/gepeng, judul dan legenda berdempetan, label skor kecil dan tidak jelas.
   - Pengguna mengonfirmasi preferensi: **Diagram Batang Ganda (*Grouped Bar Chart*)** berwarna jelas (Hijau Zamrud untuk SAW vs Biru Langit untuk WP) dengan angka skor tertera tegas di atas setiap batang.
3. **Penyelarasan Grafik & Tabel pada Excel**:
   - Grafik pada Sheet 1 Excel harus membentang sejajar persis dari **Kolom A hingga Kolom K** (sesuai lebar tabel data), tanpa rongga kosong di kanan.
   - Garis pemisah kop surat instansi diselaraskan agar rapi menyatu sepanjang tabel.
4. **Proporsi Logo Pemkab Sidoarjo**:
   - Ukuran logo pada Word, Excel, dan PDF disesuaikan agar pas sesuai standar naskah dinas (tidak terlalu besar dan tidak terlalu mini/pipih, rasio 1 : 1.18).
5. **Penataan Layout, Header, Footer & Page-Break**:
   - Memastikan tidak ada teks, grafik, garis, atau blok tanda tangan yang bertabrakan dengan header/footer maupun terpotong tidak wajar di tengah halaman (menerapkan aturan `page-break-inside: avoid;`).
6. **Pengaturan Ukuran Kertas Lanjutan (PDF & Word)**:
   - Menyediakan pilihan ukuran kertas di modal pengaturan: **A4 (Standar)**, **F4 / Folio (330 x 215 mm - Standar Pemkab)**, **Legal**, **Letter**, dan **A5**, beserta opsi orientasi (Portrait & Landscape).
7. **QR Code TTE yang Valid & Dapat Discan Ponsel**:
   - Sebelumnya menggunakan sketsa matriks kanvas ilustratif sehingga tidak dapat didecode oleh scanner HP.
   - Menggunakan pustaka encoder QR Code standar (format ISO/IEC 18004) yang menghasilkan QR Code asli dan dapat dipindai langsung oleh kamera smartphone menuju URL verifikasi keabsahan digital resmi SPK Bansos Pemkab Sidoarjo.

---

## 2. Rencana Arsitektur & Desain Visual

### A. Antarmuka Modal Verifikasi Algoritma (`frontend/index.html` & `admin-spk.js`)
- **Header & Action Bar**:
  - Judul dengan tipografi bersih (*Plus Jakarta Sans* / *Cabinet Grotesk*), ikon timbangan analitik, serta tombol tunggal terpadu **"Atur Dokumen & TTD"** dan dropdown **"Unduh Hasil"** bergaya *pill/glass-card modern*.
- **4 Kartu Metrik Analitik Terpadu (KPI Strip)**:
  - Total Calon Penerima (misal: 112 Warga).
  - Koefisien Korelasi Spearman ($r_s$) dengan badge validitas matematis.
  - Nilai Konsistensi BWM ($\xi$).
  - Kuota Alokasi Prioritas (Desil 1-4).
- **Chart Viewer Interaktif**:
  - Kanvas grafik Chart.js dengan *rounded bars*, palet warna emerald `#10b981` dan sky blue `#0284c7`, gridline transparan, dan legenda yang rapi di kanan atas.
  - Tab filter cepat untuk melihat Top 15 Alternatif vs Seluruh Alternatif Terpilih.
- **Tabel Data Alternatif**:
  - Kolom nomor, NIK sensor rapi, nama penerima, alamat, skor SAW, rank SAW, skor WP, rank WP, deviasi, dan status kelayakan desil dengan styling modern.

### B. Mesin Generator Grafik Dokumen Ekspor (`PrintHelper.generateHighDefChart`)
- Membuat generator grafik kanvas beresolusi tinggi (lebar 2000px, tinggi 700px, rasio pixel tinggi) khusus untuk penyematan ke PDF, Word, dan Excel:
  - **Judul**: Diletakkan di kiri atas dengan font tegas, tidak menabrak legenda.
  - **Legenda**: Diletakkan di kanan atas dengan kotak warna hijau zamrud (Skor SAW) dan biru langit (Skor Validasi WP).
  - **Sumbu Y**: Skala 0.0 sampai 1.0 dengan interval 0.2 dan garis kisi horizontal tipis abu-abu muda (`#E2E8F0`).
  - **Diagram Batang Ganda**: Dua batang bersebelahan per warga, sudut atas membulat halus.
  - **Skor di Atas Batang**: Nilai skor numerik 4 desimal (misal `0.7004` dan `0.0166`) dicetak horizontal di atas masing-masing batang dengan font kontras tinggi.
  - **Label Sumbu X**: Nama kepala keluarga dimiringkan 40 derajat dengan titik jangkar teks yang rapi di bawah batang.

### C. Penyelarasan Dokumen Excel (`AdminPrint.exportKomparasiExcel`)
- **Kop Surat & Logo**:
  - Logo Pemkab disematkan di Kolom A baris 1-4 dengan ukuran resmi proporsional (~84 x 100 px).
  - Teks Kop Surat mengisi Kolom B s.d. K dengan margin teks yang elegan.
  - Garis pemisah kop surat (garis ganda) membentang penuh dari **Kolom A hingga Kolom K**.
- **Grafik Komparasi**:
  - Ukuran grafik dikalibrasi presisi dari Kolom A baris 13 hingga Kolom K baris 26 (lebar sama persis dengan tabel data di bawahnya).
- **Tabel Data**:
  - Kolom A sampai K dengan styling *navy blue* header, zebra striping tipis, dan alignment yang presisi.
- **Blok Pengesahan & TTD**:
  - Menempatkan area tanda tangan di Kolom H-K dengan jarak tinggi baris yang cukup (85-110 pt) sehingga stempel atau QR Code tidak menabrak baris teks nama dan NIP.

### D. Penyelarasan Dokumen Word (`AdminPrint.exportKomparasiWord`)
- Menggunakan styling CSS halaman `@page` yang mendefinisikan margin 2cm di setiap sisi.
- Logo Pemkab diatur proporsional (80 x 96 px) dengan perataan vertikal yang tidak mengganggu teks kop.
- Grafik disematkan dengan kontainer selebar 100% margin dokumen dengan border tipis dan padding dalam yang rapi.
- Menambahkan aturan `@page Section1 { size: ... }` sesuai ukuran kertas yang dipilih.

### E. Penyelarasan Dokumen PDF (`AdminPrint.cetakLaporanKomparasi`)
- Dukungan `@page { size: [ukuran] [orientasi]; margin: 15mm 15mm 20mm 15mm; }`.
- Pencegahan elemen terpotong (`page-break-inside: avoid;` pada baris tabel, kartu ringkasan, dan blok tanda tangan).
- Header kop surat resmi dengan pembagi garis hitam tegas 2px dan garis tipis 1px.

### F. Pengaturan Dokumen Lanjutan di Modal (`modalSettingDokumen`)
- Menambahkan tab atau seksi **"Pengaturan Kertas & Layout"**:
  - Ukuran Kertas: **A4 (210 x 297 mm)**, **F4 / Folio (215 x 330 mm)**, **Legal (216 x 356 mm)**, **Letter (216 x 279 mm)**, **A5 (148 x 210 mm)**.
  - Orientasi: **Portrait (Tegak)** atau **Landscape (Mendatar)**.
  - Pilihan tersimpan di `localStorage` dan langsung diterapkan saat unduh PDF / Word.

### G. Implementasi QR Code TTE Valid & Halaman Verifikasi
- Menggunakan pustaka generator QR Code standar ISO (format ISO/IEC 18004) yang menghasilkan matriks barcode 2D standar yang dapat dipindai oleh semua aplikasi pembaca QR smartphone.
- **Muatan Data QR**:
  - Tautan URL verifikasi digital resmi, contoh:
    `https://[host]/#verifikasi?doc=BA-SPK-SDA-2026&pimpinan=Dr.+Drs.+H.+Ahmad+Misbahul+Munir%2C+M.Si&nip=197108151996031003&instansi=Dinas+Sosial+Kabupaten+Sidoarjo&tgl=28+September+2026&status=VALID`
- **Halaman/Modal Verifikasi Keabsahan**:
  - Ketika tautan dibuka di browser, aplikasi langsung menampilkan layar sertifikasi resmi berlogo Pemkab Sidoarjo:
    - Status: "DOKUMEN DINAS RESMI TERVERIFIKASI" (Hijau).
    - Nomor Dokumen & Tanggal Terbit.
    - Penandatangan Digital bersertifikat BSrE BSSN.
    - Rangkuman Integritas Algoritma SAW & WP.

---

## 3. Tahapan Eksekusi Rinci

1. **Pustaka & Dependensi**:
   - Memastikan generator QR Code standar terpasang di `index.html` agar menghasilkan QR Code valid yang dapat discan oleh kamera smartphone manapun.
2. **Pembaruan Modal Verifikasi Algoritma (`frontend/index.html`)**:
   - Restrukturisasi antarmuka modal komparasi dengan kartu ringkasan metrik modern dan tata letak elegan.
   - Perluasan tab modal `modalSettingDokumen` untuk memuat selektor ukuran kertas (A4, F4/Folio, Legal, Letter, A5) dan orientasi.
3. **Penyempurnaan Mesin Cetak & Ekspor (`frontend/static/js/modules/admin-print.js`)**:
   - Penulisan ulang fungsi `PrintHelper.generateHighDefChart`: menghasilkan grouped bar chart 2 batang berwarna tegas dengan label nilai desimal di atas batang dan label sumbu X miring yang rapi.
   - Penskalaan logo Pemkab Sidoarjo pada ketiga format (Word, Excel, PDF) agar proporsional dan tidak terdistorsi.
   - Penyelarasan posisi grafik di Excel (Kolom A-K) persis di atas tabel tanpa rongga kosong.
   - Integrasi ukuran kertas dinamis pada template cetak PDF dan Word.
   - Pembuatan fungsi yang menghasilkan data QR Code standar ISO.
4. **Halaman / Penanganan Verifikasi Digital**:
   - Menambahkan deteksi URL hash `#verifikasi` pada `frontend/static/js/modules/admin-spk.js` untuk menampilkan sertifikat verifikasi digital saat QR Code dipindai.
5. **Verifikasi & Uji Coba**:
   - Menjalankan `compile_applet` dan `lint_applet`.
   - Menguji ekspor berkas Excel, Word, dan PDF untuk memastikan tata letak bebas tabrakan dan grafik tampak sempurna.

---

## 4. Rencana Verifikasi Pengujian

| Komponen | Skenario Uji | Kriteria Sukses |
|---|---|---|
| **Antarmuka SAW vs WP** | Buka modal verifikasi algoritma | Tampilan modern, kartu KPI rapi, grafik interaktif tajam, tombol navigasi tunggal |
| **Grafik di Excel** | Unduh laporan komparasi `.xlsx` | Grafik berupa diagram batang ganda jelas, sejajar penuh Kolom A-K di atas tabel, tanpa celah |
| **Grafik di PDF & Word** | Unduh laporan komparasi `.pdf` dan `.doc` | Diagram batang beresolusi tinggi, skor tertera di atas batang, teks tidak saling bertabrakan |
| **Ukuran Logo Pemkab** | Periksa logo di PDF, Word, Excel | Logo berukuran proporsional (tidak mini, tidak raksasa, rasio aspek perisai alami) |
| **Ukuran Kertas** | Pilih ukuran F4 / Folio atau A5 di modal pengaturan lalu unduh PDF/Word | Tata letak dokumen menyesuaikan dimensi kertas yang dipilih tanpa meluber |
| **Pemindaian QR Code** | Pindai QR Code di dokumen menggunakan kamera HP | Kamera berhasil membaca tautan dan membuka halaman verifikasi keabsahan resmi |
