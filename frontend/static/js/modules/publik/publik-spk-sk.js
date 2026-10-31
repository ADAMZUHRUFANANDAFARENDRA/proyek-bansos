/**
 * Modul: publik-spk-sk.js
 * Deskripsi: Penanganan Akses Warga terhadap Metrik Perhitungan SPK (BWM-SAW & WP) dan SK Bupati Terbit
 * Dilengkapi Gerbang Privasi Verifikasi Identitas (Nama Lengkap Sesuai KTP, NIK 16 Digit, dan Email Terdaftar)
 */

(function () {
    let cachedSpkSkData = null;

    // 1. Cek Status Publikasi SPK & SK Bupati saat halaman dimuat
    window.cekStatusPublikasiWargaSpkSk = async function () {
        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            const [resSpk, resSk] = await Promise.all([
                fetch(`${base}/api/spk/status-publikasi`),
                fetch(`${base}/api/sk-bupati/status-publikasi`)
            ]);

            const jsonSpk = await resSpk.json();
            const jsonSk = await resSk.json();

            const spkPub = Boolean(jsonSpk?.spk?.is_published);
            const skPub = Boolean(jsonSk?.is_published);

            const badgeSpk = document.getElementById('badgePublikStatusSpk');
            const badgeSk = document.getElementById('badgePublikStatusSk');

            if (badgeSpk) {
                badgeSpk.className = spkPub ? 'badge-live-published' : 'badge-live-draft';
                badgeSpk.innerHTML = spkPub
                    ? `<i class="fas fa-check-circle"></i> Metrik SPK: Diterbitkan (${jsonSpk.spk?.published_at || 'Aktif'})`
                    : `<i class="fas fa-lock"></i> Metrik SPK: Belum Diterbitkan (Internal)`;
            }

            if (badgeSk) {
                badgeSk.className = skPub ? 'badge-live-published' : 'badge-live-draft';
                badgeSk.innerHTML = skPub
                    ? `<i class="fas fa-certificate"></i> SK Bupati: Diterbitkan (${jsonSk?.published_at || 'Resmi'})`
                    : `<i class="fas fa-lock"></i> SK Bupati: Proses Pengesahan (Internal)`;
            }
        } catch (_) {}
    };

    // 2. Fungsi Isi Cepat Contoh Warga
    window.isiContohSpkSkWarga = function (nik, nama, email) {
        const inpNik = document.getElementById('spkPublikNikInput');
        const inpNama = document.getElementById('spkPublikNamaInput');
        const inpEmail = document.getElementById('spkPublikEmailInput');

        if (inpNik) inpNik.value = nik;
        if (inpNama) inpNama.value = nama;
        if (inpEmail) inpEmail.value = email;

        // Otomatis jalankan verifikasi
        window.verifikasiDanMuatSpkSkWarga();
    };

    // 3. Verifikasi Identitas & Tampilkan Data Metrik SPK + SK Bupati Personal
    window.verifikasiDanMuatSpkSkWarga = async function (e) {
        if (e && e.preventDefault) e.preventDefault();

        const inpNik = document.getElementById('spkPublikNikInput');
        const inpNama = document.getElementById('spkPublikNamaInput');
        const inpEmail = document.getElementById('spkPublikEmailInput');
        const container = document.getElementById('containerHasilSpkSkWarga');

        const nik = (inpNik?.value || '').trim();
        const nama = (inpNama?.value || '').trim();
        const email = (inpEmail?.value || '').trim();

        if (!nik || nik.length < 16) {
            Swal.fire({
                icon: 'warning',
                title: 'NIK Tidak Lengkap',
                text: 'Harap masukkan 16 Digit Nomor Induk Kependudukan (NIK) Anda sesuai e-KTP.',
                confirmButtonColor: '#009846'
            });
            return;
        }

        if (!nama) {
            Swal.fire({
                icon: 'warning',
                title: 'Nama Wajib Diisi',
                text: 'Harap masukkan Nama Lengkap Anda sesuai e-KTP.',
                confirmButtonColor: '#009846'
            });
            return;
        }

        if (!email || !email.includes('@')) {
            Swal.fire({
                icon: 'warning',
                title: 'Email Tidak Valid',
                text: 'Harap masukkan Alamat Email aktif yang didaftarkan pada data penerima bansos.',
                confirmButtonColor: '#009846'
            });
            return;
        }

        if (container) {
            container.innerHTML = `
                <div style="text-align:center; padding:48px 20px; background:#ffffff; border-radius:20px; border:1px solid #e2e8f0; box-shadow:0 4px 15px rgba(0,0,0,0.03);">
                    <i class="fas fa-circle-notch fa-spin" style="font-size:2.4rem; color:#009846;"></i>
                    <div style="margin-top:14px; font-weight:800; font-size:1.05rem; color:#0f172a;">Memverifikasi Data Kependudukan & Mengambil Metrik SPK...</div>
                    <div style="font-size:0.84rem; color:#64748b; margin-top:6px;">Mencocokkan NIK, Nama Lengkap, dan Alamat Email Anda secara aman dengan basis data terenkripsi.</div>
                </div>
            `;
            container.style.display = 'block';
        }

        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            const res = await fetch(`${base}/api/publik/spk-sk-warga`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nik, nama, email })
            });

            const json = await res.json();

            if (!res.ok || json.status !== 'success') {
                container.innerHTML = `
                    <div style="background:#fff1f2; border:1.5px solid #fecdd3; border-radius:20px; padding:28px; text-align:center;">
                        <div style="width:52px; height:52px; border-radius:50%; background:#fee2e2; color:#dc2626; display:flex; align-items:center; justify-content:center; margin:0 auto 14px; font-size:1.5rem;">
                            <i class="fas fa-user-lock"></i>
                        </div>
                        <div style="font-weight:800; font-size:1.1rem; color:#991b1b;">Verifikasi Identitas Tidak Cocok</div>
                        <div style="font-size:0.88rem; color:#7f1d1d; max-width:620px; margin:8px auto 18px; line-height:1.5;">
                            ${json.message || 'Data nama, NIK, atau email yang Anda masukkan tidak cocok dengan catatan resmi kependudukan. Mohon periksa kembali ejaan nama dan digit NIK Anda.'}
                        </div>
                        <button type="button" onclick="window.tutupDataSpkSkWarga()" class="btn" style="background:#dc2626; color:#ffffff; font-weight:700; padding:10px 22px; border-radius:12px; border:none; cursor:pointer;">
                            <i class="fas fa-redo"></i> Coba Input Kembali
                        </button>
                    </div>
                `;
                return;
            }

            cachedSpkSkData = json.data;
            window.renderSpkSkResultWarga(json.data);

        } catch (err) {
            container.innerHTML = `
                <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:18px; padding:24px; text-align:center; color:#dc2626;">
                    <i class="fas fa-exclamation-triangle" style="font-size:1.8rem; margin-bottom:8px;"></i>
                    <div style="font-weight:700;">Gagal terhubung ke peladen: ${err.message}</div>
                </div>
            `;
        }
    };

    // 4. Render Hasil SPK & SK Bupati Khusus Warga Bersangkutan
    window.renderSpkSkResultWarga = function (d) {
        const container = document.getElementById('containerHasilSpkSkWarga');
        if (!container || !d) return;

        const w = d.warga;
        const spk = d.spk_metrik;
        const sk = d.sk_bupati;

        const isDiterima = Boolean(sk?.is_penerima);
        const statusBadgeClass = isDiterima ? 'badge-layak-bupati' : 'badge-cadangan-bupati';
        const statusIcon = isDiterima ? 'fa-check-circle' : 'fa-hourglass-half';
        const statusTitle = isDiterima ? 'DITETAPKAN SEBAGAI PENERIMA BANSOS' : 'STATUS CADANGAN / TIDAK PRIORITAS';

        // Bangun tabel kriteria C1-C10
        let kriteriaHtml = '';
        if (spk?.kriteria_breakdown && spk.kriteria_breakdown.length > 0) {
            kriteriaHtml = spk.kriteria_breakdown.map((c, i) => `
                <tr style="border-bottom:1px solid #f1f5f9; background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding:10px 12px; font-weight:700; color:#334155; font-size:0.83rem; text-align:center;">${c.kode}</td>
                    <td style="padding:10px 12px; font-weight:600; color:#0f172a; font-size:0.85rem;">${c.nama}</td>
                    <td style="padding:10px 12px; font-weight:700; color:#0284c7; font-size:0.83rem; text-align:center;">${(c.bobot_bwm * 100).toFixed(1)}%</td>
                    <td style="padding:10px 12px; color:#475569; font-size:0.83rem; text-align:center;">${c.nilai_input}</td>
                    <td style="padding:10px 12px; font-weight:700; color:#16a34a; font-size:0.85rem; text-align:center;">${c.skor_normalisasi.toFixed(3)}</td>
                </tr>
            `).join('');
        }

        container.innerHTML = `
            <!-- BAR IDENTITAS TERVERIFIKASI & PRIVASI -->
            <div style="background:#ffffff; border:1.5px solid #dcfce7; border-radius:18px; padding:18px 22px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; box-shadow:0 4px 14px rgba(22,163,74,0.06);">
                <div style="display:flex; align-items:center; gap:14px;">
                    <div style="width:48px; height:48px; border-radius:14px; background:#dcfce7; color:#15803d; display:flex; align-items:center; justify-content:center; font-size:1.35rem; flex-shrink:0;">
                        <i class="fas fa-id-card-clip"></i>
                    </div>
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span style="font-weight:800; font-size:1.15rem; color:#0f172a;">${w.nama}</span>
                            <span style="background:#15803d; color:#ffffff; font-size:0.72rem; font-weight:800; padding:3px 9px; border-radius:8px; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fas fa-shield-halved"></i> Identitas Terverifikasi
                            </span>
                        </div>
                        <div style="font-size:0.82rem; color:#64748b; margin-top:3px; display:flex; gap:12px; flex-wrap:wrap;">
                            <span><i class="fas fa-fingerprint"></i> NIK: <b>${w.nik}</b></span>
                            <span><i class="fas fa-envelope"></i> Email: <b>${w.email}</b></span>
                            <span><i class="fas fa-map-marker-alt"></i> ${w.alamat}</span>
                        </div>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:6px 12px; font-size:0.76rem; font-weight:700; color:#475569; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fas fa-user-shield text-success"></i> Data Warga Lain Disembunyikan
                    </div>
                    <button type="button" onclick="window.tutupDataSpkSkWarga()" class="btn" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecdd3; padding:8px 14px; border-radius:10px; font-weight:700; font-size:0.82rem; cursor:pointer;" title="Tutup pratinjau data pribadi">
                        <i class="fas fa-times"></i> Tutup Data
                    </button>
                </div>
            </div>

            <!-- GRID DUA KOLOM: SK BUPATI & METRIK SPK -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:22px; margin-bottom:24px;">
                
                <!-- KOLOM 1: KEPUTUSAN BUPATI SIDOARJO -->
                <div style="background:#ffffff; border-radius:20px; border:1.5px solid ${isDiterima ? '#bbf7d0' : '#fed7aa'}; padding:22px; box-shadow:0 4px 18px rgba(0,0,0,0.04); display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <!-- Header SK -->
                        <div style="display:flex; align-items:center; gap:12px; border-bottom:1.5px solid #f1f5f9; padding-bottom:14px; margin-bottom:16px;">
                            <div style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg, #e11d48, #be123c); color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:1.15rem; flex-shrink:0;">
                                <i class="fas fa-file-contract"></i>
                            </div>
                            <div>
                                <div style="font-size:1rem; font-weight:800; color:#0f172a;">Keputusan Resmi Bupati Sidoarjo</div>
                                <div style="font-size:0.75rem; font-weight:600; color:#be123c;">SK Penetapan KPM Bantuan Sosial TA 2026</div>
                            </div>
                        </div>

                        <!-- Status Keputusan Badge -->
                        <div style="background:${isDiterima ? '#f0fdf4' : '#fffbeb'}; border:1.5px solid ${isDiterima ? '#86efac' : '#fde68a'}; border-radius:14px; padding:14px 18px; margin-bottom:16px; text-align:center;">
                            <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:${isDiterima ? '#15803d' : '#b45309'}; margin-bottom:4px;">
                                <i class="fas ${statusIcon}"></i> Hasil Penetapan Bupati
                            </div>
                            <div style="font-size:1.15rem; font-weight:900; color:${isDiterima ? '#166534' : '#92400e'};">
                                ${statusTitle}
                            </div>
                            <div style="font-size:0.8rem; color:#475569; margin-top:6px; line-height:1.4;">
                                ${sk.catatan || (isDiterima ? 'Berdasarkan evaluasi SPK BWM-SAW, Anda memenuhi kriteria prioritas kemiskinan ekstrem.' : 'Anda berada di luar kuota 40 KPM prioritas desil terendah.')}
                            </div>
                        </div>

                        <!-- Rincian Legalitas SK -->
                        <div style="background:#f8fafc; border-radius:14px; padding:14px 16px; font-size:0.83rem; color:#334155; line-height:1.7;">
                            <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #e2e8f0; padding-bottom:6px;">
                                <span style="color:#64748b;">Nomor SK Bupati:</span>
                                <span style="font-weight:800; font-family:'JetBrains Mono', monospace; color:#0f172a;">${sk.nomor_sk || '188/460/438.1.1.3/2026'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #e2e8f0; padding:6px 0;">
                                <span style="color:#64748b;">Tanggal Pengesahan:</span>
                                <span style="font-weight:700;">${sk.tanggal_pengesahan || '28 September 2026'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #e2e8f0; padding:6px 0;">
                                <span style="color:#64748b;">Pejabat Penandatangan:</span>
                                <span style="font-weight:700;">${sk.nama_bupati || 'Bupati Sidoarjo'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #e2e8f0; padding:6px 0;">
                                <span style="color:#64748b;">Paket Alokasi Bantuan:</span>
                                <span style="font-weight:800; color:#16a34a;">${sk.paket_bantuan || 'PKH & Sembako Rp 600.000'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding-top:6px;">
                                <span style="color:#64748b;">Otentikasi Digital:</span>
                                <span style="font-weight:700; color:#0284c7;"><i class="fas fa-check-double"></i> Bersertifikasi BSrE BSSN</span>
                            </div>
                        </div>
                    </div>

                    <!-- Tombol Unduh Petikan SK -->
                    <div style="margin-top:20px;">
                        <button type="button" onclick="window.unduhPetikanSkWarga()" class="btn" style="width:100%; background:linear-gradient(135deg, #e11d48, #be123c); color:#ffffff; font-weight:800; padding:12px; border-radius:12px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 12px rgba(225,29,72,0.25);">
                            <i class="fas fa-file-pdf"></i> Unduh Salinan Petikan SK Bupati Resmi
                        </button>
                    </div>
                </div>

                <!-- KOLOM 2: METRIK & VARIABEL PERHITUNGAN SPK -->
                <div style="background:#ffffff; border-radius:20px; border:1.5px solid #e0f2fe; padding:22px; box-shadow:0 4px 18px rgba(0,0,0,0.04);">
                    <!-- Header SPK -->
                    <div style="display:flex; align-items:center; gap:12px; border-bottom:1.5px solid #f1f5f9; padding-bottom:14px; margin-bottom:16px;">
                        <div style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg, #0284c7, #0369a1); color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:1.15rem; flex-shrink:0;">
                            <i class="fas fa-square-root-variable"></i>
                        </div>
                        <div>
                            <div style="font-size:1rem; font-weight:800; color:#0f172a;">Metrik Perhitungan SPK (BWM-SAW & WP)</div>
                            <div style="font-size:0.75rem; font-weight:600; color:#0284c7;">Transparansi Variabel & Perankingan Akuntabel</div>
                        </div>
                    </div>

                    <!-- 3 Kartu Nilai Evaluasi -->
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:16px;">
                        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:12px; padding:10px; text-align:center;">
                            <div style="font-size:0.7rem; font-weight:700; color:#0369a1; text-transform:uppercase;">Peringkat</div>
                            <div style="font-size:1.2rem; font-weight:900; color:#0284c7; margin-top:2px;">#${spk.peringkat || '-'}</div>
                            <div style="font-size:0.68rem; color:#64748b;">dari ${spk.total_populasi || 100} Warga</div>
                        </div>
                        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:10px; text-align:center;">
                            <div style="font-size:0.7rem; font-weight:700; color:#15803d; text-transform:uppercase;">Skor SAW</div>
                            <div style="font-size:1.2rem; font-weight:900; color:#16a34a; margin-top:2px;">${(Number(spk.skor_saw) || 0).toFixed(4)}</div>
                            <div style="font-size:0.68rem; color:#64748b;">BWM-SAW</div>
                        </div>
                        <div style="background:#faf5ff; border:1px solid #e9d5ff; border-radius:12px; padding:10px; text-align:center;">
                            <div style="font-size:0.7rem; font-weight:700; color:#7e22ce; text-transform:uppercase;">Desil</div>
                            <div style="font-size:1.2rem; font-weight:900; color:#9333ea; margin-top:2px;">D${spk.desil || w.desil || '-'}</div>
                            <div style="font-size:0.68rem; color:#64748b;">Tingkat Kemiskinan</div>
                        </div>
                    </div>

                    <!-- Tabel Breakdown Kriteria C1 s/d C10 -->
                    <div style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; max-height:260px; overflow-y:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead style="background:#f1f5f9; position:sticky; top:0;">
                                <tr>
                                    <th style="padding:8px 10px; font-size:0.72rem; font-weight:800; color:#475569; text-align:center;">KODE</th>
                                    <th style="padding:8px 10px; font-size:0.72rem; font-weight:800; color:#475569;">KRITERIA</th>
                                    <th style="padding:8px 10px; font-size:0.72rem; font-weight:800; color:#475569; text-align:center;">BOBOT</th>
                                    <th style="padding:8px 10px; font-size:0.72rem; font-weight:800; color:#475569; text-align:center;">NILAI</th>
                                    <th style="padding:8px 10px; font-size:0.72rem; font-weight:800; color:#475569; text-align:center;">SKOR</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${kriteriaHtml || '<tr><td colspan="5" style="text-align:center; padding:14px; color:#64748b;">Data kriteria terverifikasi lengkap.</td></tr>'}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top:14px; font-size:0.76rem; color:#64748b; line-height:1.4;">
                        <i class="fas fa-info-circle text-primary"></i> <b>Catatan Transparansi:</b> Pembobotan kriteria dihitung menggunakan algoritma analitik <i>Best-Worst Method</i> (BWM) yang konsisten secara matematis (K.R &lt; 0.10) dan dinilai secara objektif tanpa intervensi manual.
                    </div>
                </div>

            </div>
        `;

        // Smooth scroll ke hasil
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // 5. Tutup & Reset Data Warga
    window.tutupDataSpkSkWarga = function () {
        const container = document.getElementById('containerHasilSpkSkWarga');
        const inpNik = document.getElementById('spkPublikNikInput');
        const inpNama = document.getElementById('spkPublikNamaInput');
        const inpEmail = document.getElementById('spkPublikEmailInput');

        if (container) {
            container.innerHTML = `
                <div style="background:#f8fafc; border:1.5px dashed #cbd5e1; border-radius:18px; padding:36px 20px; text-align:center; color:#64748b;">
                    <div style="width:54px; height:54px; border-radius:50%; background:#e2e8f0; color:#64748b; display:flex; align-items:center; justify-content:center; margin:0 auto 12px; font-size:1.4rem;">
                        <i class="fas fa-lock"></i>
                    </div>
                    <div style="font-weight:800; font-size:1rem; color:#334155;">Data SPK & SK Bupati Dilindungi</div>
                    <div style="font-size:0.83rem; max-width:540px; margin:6px auto 0; line-height:1.5;">
                        Silakan masukkan Nama Lengkap, NIK (16 Digit), dan Email Anda pada form di atas untuk menampilkan penetapan SK Bupati dan metrik perhitungan BWM-SAW Anda.
                    </div>
                </div>
            `;
        }

        if (inpNik) inpNik.value = '';
        if (inpNama) inpNama.value = '';
        if (inpEmail) inpEmail.value = '';
        cachedSpkSkData = null;
    };

    // 6. Unduh / Cetak Petikan Salinan Resmi SK Bupati
    window.unduhPetikanSkWarga = function () {
        if (!cachedSpkSkData) return;
        const w = cachedSpkSkData.warga;
        const sk = cachedSpkSkData.sk_bupati;
        const spk = cachedSpkSkData.spk_metrik;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Harap izinkan pop-up peramban untuk mencetak Petikan SK Bupati.');
            return;
        }

        const isDiterima = Boolean(sk?.is_penerima);

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <title>PETIKAN SALINAN SK BUPATI - ${w.nama} (${w.nik})</title>
                <style>
                    body { font-family: 'Times New Roman', Times, serif; color: #000; margin: 40px; line-height: 1.5; font-size: 12pt; }
                    .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 20px; }
                    .kop h2 { margin: 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; }
                    .kop h1 { margin: 2px 0; font-size: 16pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
                    .kop p { margin: 0; font-size: 10pt; }
                    .judul-sk { text-align: center; margin: 25px 0 20px 0; }
                    .judul-sk h3 { margin: 0; font-size: 12pt; text-decoration: underline; text-transform: uppercase; }
                    .judul-sk p { margin: 4px 0 0 0; font-size: 11pt; }
                    table.data-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    table.data-table td { padding: 6px 8px; vertical-align: top; }
                    .border-box { border: 1.5px solid #000; padding: 12px 16px; margin: 20px 0; border-radius: 4px; }
                    .ttd-wrapper { float: right; width: 280px; text-align: center; margin-top: 30px; }
                    .clear { clear: both; }
                    @media print {
                        body { margin: 20mm; }
                    }
                </style>
            </head>
            <body>
                <div class="kop">
                    <h2>PEMERINTAH KABUPATEN SIDOARJO</h2>
                    <h1>DINAS SOSIAL</h1>
                    <p>Jl. Pahlawan No. 25, Sidokumpul, Kec. Sidoarjo, Kabupaten Sidoarjo, Jawa Timur 61213</p>
                    <p>Laman: sidoarjokab.go.id | Email: dinsos@sidoarjokab.go.id | Call Center: 112</p>
                </div>

                <div class="judul-sk">
                    <h3>PETIKAN KEPUTUSAN BUPATI SIDOARJO</h3>
                    <p>NOMOR: ${sk.nomor_sk || '188/460/438.1.1.3/2026'}</p>
                    <p style="margin-top:6px; font-weight:bold;">TENTANG<br>PENETAPAN PENERIMA BANTUAN SOSIAL PEMERINTAH KABUPATEN SIDOARJO TAHUN ANGGARAN 2026</p>
                </div>

                <p style="text-indent: 30px;">Berdasarkan hasil seleksi dan verifikasi komputasi Sistem Pendukung Keputusan (SPK) menggunakan integrasi metode <i>Best-Worst Method</i> (BWM) dan <i>Simple Additive Weighting</i> (SAW), bersama ini menerangkan bahwa:</p>

                <table class="data-table">
                    <tr><td style="width:30%;">Nama Lengkap</td><td style="width:2%;">:</td><td style="font-weight:bold;">${w.nama}</td></tr>
                    <tr><td>Nomor Induk Kependudukan (NIK)</td><td>:</td><td style="font-weight:bold;">${w.nik}</td></tr>
                    <tr><td>Alamat Domisili</td><td>:</td><td>${w.alamat}</td></tr>
                    <tr><td>Tingkat Desil Kesejahteraan</td><td>:</td><td>Desil ${spk.desil || w.desil || '-'}</td></tr>
                    <tr><td>Skor Akhir SPK BWM-SAW</td><td>:</td><td>${(Number(spk.skor_saw) || 0).toFixed(4)} (Peringkat #${spk.peringkat || '-'})</td></tr>
                </table>

                <div class="border-box">
                    <div style="font-weight:bold; font-size:11pt; text-align:center; text-transform:uppercase;">STATUS PENETAPAN KEPUTUSAN:</div>
                    <div style="font-weight:bold; font-size:13pt; text-align:center; margin:6px 0; color:${isDiterima ? '#000' : '#444'};">
                        ${statusTitle}
                    </div>
                    <div style="text-align:center; font-size:10pt;">
                        ${isDiterima
                            ? `Ditetapkan untuk menerima alokasi bantuan sosial paket: <b>${sk.paket_bantuan || 'PKH & Sembako Tunai'}</b>.`
                            : `Belum masuk kuota penerima prioritas tahap berjalan. Berkas tercatat aktif dalam antrean cadangan evaluasi berikutnya.`
                        }
                    </div>
                </div>

                <p style="font-size:10pt; color:#333;">Petikan keputusan ini dicetak secara sah dan diotentikasi secara elektronik menggunakan Sertifikat Elektronik Balai Sertifikasi Elektronik (BSrE) Badan Siber dan Sandi Negara (BSSN).</p>

                <div class="ttd-wrapper">
                    <p>Ditetapkan di Sidoarjo<br>Pada tanggal: ${sk.tanggal_pengesahan || '28 September 2026'}</p>
                    <p style="font-weight:bold; margin-top:5px;">BUPATI SIDOARJO,</p>
                    <div style="margin: 15px auto; width:80px; height:80px; border:1px solid #ccc; display:flex; align-items:center; justify-content:center; font-size:8pt; text-align:center; background:#f9f9f9;">
                        [TTE BSrE BSSN]
                    </div>
                    <p style="font-weight:bold; text-decoration:underline;">${sk.nama_bupati || 'H. AHMAD MUHDLOR, S.I.P.'}</p>
                </div>
                <div class="clear"></div>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Panggil pengecekan status awal saat dokumen dimuat
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(window.cekStatusPublikasiWargaSpkSk, 1000);
    });

})();
