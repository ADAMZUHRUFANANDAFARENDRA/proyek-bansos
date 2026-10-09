/**
 * Modul: admin-warga-crud.js
 * Deskripsi: Tambah data, edit data multi-variabel, cek Dukcapil, peta picker, dan status verifikasi
 */

// 8. VERIFIKASI DUKCAPIL SIDOARJO (AMBIL DATA DARI ARSIP DATA WARGA)
// =========================================================================
window.cekDukcapilLokal = async function () {
    const nikInput = document.getElementById('nik');
    const nik = (nikInput?.value || '').trim();

    if (!nik) {
        return showAdminAlert({ 
            icon: 'warning', 
            title: 'Peringatan', 
            text: 'Silakan masukkan 16 digit Nomor Induk Kependudukan (NIK) terlebih dahulu.' 
        });
    }

    if (nik.length !== 16 || !/^\d+$/.test(nik)) {
        return showAdminAlert({ 
            icon: 'warning', 
            title: 'Peringatan', 
            text: 'Nomor Induk Kependudukan (NIK) harus tepat 16 digit angka.' 
        });
    }

    // Fungsi utilitas untuk mengosongkan seluruh kolom form pendataan warga
    const kosongkanFormPendataanWarga = function () {
        const fieldsToClear = [
            'nama', 'no_hp', 'email', 'tempatLahir', 'tglLahir', 
            'alamat', 'lat', 'lng', 'c1', 'c2', 'c3', 'c5', 'c7', 'catatan'
        ];
        fieldsToClear.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Reset dropdown pilihan ke opsi awal
        if (document.getElementById('inputC4')) document.getElementById('inputC4').value = '1';
        if (document.getElementById('inputC6')) document.getElementById('inputC6').value = '2';
        if (document.getElementById('inputC8')) document.getElementById('inputC8').value = '1';
        if (document.getElementById('inputC9')) document.getElementById('inputC9').value = '1';
        if (document.getElementById('inputC10')) document.getElementById('inputC10').value = '1';

        // Reset peta ke pusat Sidoarjo
        if (typeof formMap !== 'undefined' && formMap && typeof formMarker !== 'undefined' && formMarker) {
            const center = window.MAP_CENTER_SIDOARJO || [-7.4478, 112.7183];
            formMap.setView(center, 13);
            formMarker.setLatLng(center);
        }
    };

    // Fungsi utilitas untuk memformat tanggal ke YYYY-MM-DD
    const formatTanggalInput = function (val) {
        if (!val) return '';
        const s = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const parts = s.split(/[\/\-\.]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        try {
            const d = new Date(s);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        } catch (_) {}
        return '';
    };

    // Tampilkan indikator pencarian (tanpa tombol batalkan)
    showAdminAlert({ 
        title: 'Memeriksa Arsip Data Warga...', 
        text: `Mencari catatan kependudukan untuk NIK: ${nik}...`, 
        showCancelButton: false,
        canCancel: false,
        showCloseButton: false,
        didOpen: (popup) => {
            popup?.querySelector('.swal2-cancel')?.remove();
            popup?.querySelector('.swal2-close')?.remove();
            Swal?.showLoading();
        }
    });

    try {
        let found = null;

        // 1. Prioritas Utama: Cari langsung di memori Arsip Data Warga (window.globalDataWarga)
        if (Array.isArray(window.globalDataWarga) && window.globalDataWarga.length > 0) {
            found = window.globalDataWarga.find(w => String(w.nik).trim() === nik);
        }

        // 2. Jika belum ditemukan, periksa cache lokal browser
        if (!found) {
            try {
                const cached = JSON.parse(localStorage.getItem('cachedDataWarga') || '[]');
                if (Array.isArray(cached) && cached.length > 0) {
                    found = cached.find(w => String(w.nik).trim() === nik);
                }
            } catch (_) {}
        }

        // 3. Jika belum ditemukan, periksa endpoint Arsip Server / Dukcapil
        if (!found) {
            try {
                const dukUrl = `/api/dukcapil/${encodeURIComponent(nik)}`;
                const res = await (window.fetchWithAuth ? window.fetchWithAuth(dukUrl) : fetch(`${window.BASE_URL || ''}${dukUrl}`));
                if (res && res.ok) {
                    const json = await res.json();
                    if (json && json.status === 'success' && json.data) {
                        found = json.data;
                    }
                }
            } catch (_) {}
        }

        // 4. Jika masih belum ditemukan, periksa endpoint data warga terpusat
        if (!found) {
            try {
                const wUrl = `/api/warga/${encodeURIComponent(nik)}`;
                const res = await (window.fetchWithAuth ? window.fetchWithAuth(wUrl) : fetch(`${window.BASE_URL || ''}${wUrl}`));
                if (res && res.ok) {
                    const json = await res.json();
                    if (json && json.status === 'success' && json.data) {
                        found = json.data;
                    }
                }
            } catch (_) {}
        }

        Swal?.close();

        // KONDISI A: DATA TIDAK ADA DI ARSIP DATA WARGA -> KOSONGKAN SELURUH FORMULIR
        if (!found) {
            kosongkanFormPendataanWarga();
            return showAdminAlert({ 
                icon: 'warning', 
                title: 'Data Tidak Ditemukan', 
                html: `
                    <div style="text-align:center; font-size:0.92rem; line-height:1.6;">
                        <p>Catatan kependudukan NIK <b>${nik}</b> <u>tidak terdaftar</u> di dalam <b>Arsip Data Warga</b>.</p>
                        <div style="background:#fee2e2; color:#b91c1c; padding:8px 12px; border-radius:8px; margin-top:8px; font-weight:600; font-size:0.85rem;">
                            <i class="fas fa-eraser"></i> Seluruh kolom pada Formulir Pendataan Warga telah dikosongkan.
                        </div>
                    </div>
                `,
                showCancelButton: false,
                showCloseButton: false,
                confirmButtonColor: '#e11d48',
                confirmButtonText: 'Selesai',
                customClass: {
                    popup: 'swal-modern-rounded swal-no-cancel',
                    confirmButton: 'swal-btn-pill-danger',
                    cancelButton: 'swal-btn-hidden-force'
                },
                didOpen: (popup) => {
                    popup?.querySelector('.swal2-cancel')?.remove();
                    popup?.querySelector('.swal2-close')?.remove();
                }
            });
        }

        // KONDISI B: DATA ADA DI ARSIP DATA WARGA -> AMBIL DATA LENGKAP & ISI OTOMATIS KE FORM
        const d = found;

        // 1. Nomor Induk Kependudukan (NIK)
        if (document.getElementById('nik')) {
            document.getElementById('nik').value = d.nik || nik;
        }

        // 2. Nama Lengkap Pemohon
        if (document.getElementById('nama')) {
            document.getElementById('nama').value = d.nama || d.nama_lengkap || '';
        }

        // 3. No. WhatsApp / HP
        if (document.getElementById('no_hp')) {
            document.getElementById('no_hp').value = d.no_hp || d.telepon || d.hp || d.noHp || d.extra_data?.['No. WA'] || d.extra_data?.['Kontak'] || d.extra_data?.['No. HP'] || '';
        }

        // 4. Alamat Email
        if (document.getElementById('email')) {
            document.getElementById('email').value = d.email || d.extra_data?.['Email'] || '';
        }

        // 5. Tempat Lahir
        if (document.getElementById('tempatLahir')) {
            document.getElementById('tempatLahir').value = d.tempat_lahir || d.tempatLahir || d.extra_data?.['Tempat Lahir'] || 'Sidoarjo';
        }
        
        // 6. Tanggal Lahir (Format YYYY-MM-DD untuk input date)
        const tglLahirFormatted = formatTanggalInput(d.tanggal_lahir || d.tglLahir || d.tgl_lahir || d.extra_data?.['Tanggal Lahir']);
        if (document.getElementById('tglLahir')) {
            document.getElementById('tglLahir').value = tglLahirFormatted;
        }
        
        // 7. Alamat Lengkap Tempat Tinggal
        if (document.getElementById('alamat')) {
            document.getElementById('alamat').value = d.alamat || d.extra_data?.['Alamat'] || d.extra_data?.['Alamat Lengkap'] || '';
        }

        // 8. Titik Lokasi Rumah (Geotagging Lintang & Bujur)
        const latVal = (d.lat !== undefined && d.lat !== null && d.lat !== '') ? d.lat : (d.extra_data?.['Lat'] || d.extra_data?.['Latitude'] || '');
        const lngVal = (d.lng !== undefined && d.lng !== null && d.lng !== '') ? d.lng : (d.extra_data?.['Lng'] || d.extra_data?.['Longitude'] || '');
        if (document.getElementById('lat')) document.getElementById('lat').value = latVal;
        if (document.getElementById('lng')) document.getElementById('lng').value = lngVal;

        const numLat = parseFloat(latVal);
        const numLng = parseFloat(lngVal);
        if (!isNaN(numLat) && !isNaN(numLng)) {
            if (typeof window.setFormCoords === 'function') {
                window.setFormCoords(numLat, numLng);
            }
            if (typeof formMap !== 'undefined' && formMap && typeof formMarker !== 'undefined' && formMarker) {
                formMap.setView([numLat, numLng], 16);
                formMarker.setLatLng([numLat, numLng]);
            }
        } else if (d.alamat && typeof window.cariAlamatDiPeta === 'function') {
            window.cariAlamatDiPeta(d.alamat);
        }

        // 9. Kuesioner 10 Kriteria Kelayakan (C1 - C10)
        // C1. Kondisi Ekonomi
        if (document.getElementById('c1')) {
            const v1 = d.c1 !== undefined && d.c1 !== null ? d.c1 : (d.c1_ekonomi !== undefined ? d.c1_ekonomi : (d.extra_data?.['C1'] || d.extra_data?.['c1'] || ''));
            document.getElementById('c1').value = v1 !== '' ? Math.round(Number(v1) || 0) : '';
        }
        // C2. Nilai Aset
        if (document.getElementById('c2')) {
            const v2 = d.c2 !== undefined && d.c2 !== null ? d.c2 : (d.c2_aset !== undefined ? d.c2_aset : (d.extra_data?.['C2'] || d.extra_data?.['c2'] || ''));
            document.getElementById('c2').value = v2 !== '' ? Math.round(Number(v2) || 0) : '';
        }
        // C3. Usia Kepala Keluarga
        if (document.getElementById('c3')) {
            const v3 = d.c3 !== undefined && d.c3 !== null ? d.c3 : (d.c3_umur !== undefined ? d.c3_umur : (d.extra_data?.['C3'] || d.extra_data?.['c3'] || ''));
            document.getElementById('c3').value = v3 !== '' ? Math.round(Number(v3) || 0) : '';
        }
        // C4. Jenis Kelamin (1 = Laki-laki, 2 = Perempuan)
        if (document.getElementById('inputC4')) {
            let c4Val = '1';
            if (d.c4 !== undefined && d.c4 !== null && String(d.c4) !== '') c4Val = String(d.c4);
            else if (d.c4_jenis_kelamin !== undefined && d.c4_jenis_kelamin !== null) c4Val = String(d.c4_jenis_kelamin);
            else if (d.c4_jk !== undefined && d.c4_jk !== null) c4Val = String(d.c4_jk);
            else if (d.jenis_kelamin) {
                const s = String(d.jenis_kelamin).toLowerCase();
                c4Val = (s.includes('perempuan') || s === 'p' || s === '2') ? '2' : '1';
            } else if (d.extra_data?.['Jenis Kelamin']) {
                const s = String(d.extra_data['Jenis Kelamin']).toLowerCase();
                c4Val = (s.includes('perempuan') || s === 'p' || s === '2') ? '2' : '1';
            }
            document.getElementById('inputC4').value = c4Val;
        }
        // C5. Jumlah Tanggungan
        if (document.getElementById('c5')) {
            const v5 = d.c5 !== undefined && d.c5 !== null ? d.c5 : (d.c5_tanggungan !== undefined ? d.c5_tanggungan : (d.extra_data?.['C5'] || d.extra_data?.['c5'] || ''));
            document.getElementById('c5').value = v5 !== '' ? Math.round(Number(v5) || 0) : '';
        }
        // C6. Status Pernikahan (1 = Belum Menikah, 2 = Menikah, 3 = Cerai)
        if (document.getElementById('inputC6')) {
            let c6Val = '2';
            if (d.c6 !== undefined && d.c6 !== null && String(d.c6) !== '') c6Val = String(d.c6);
            else if (d.c6_status_pernikahan !== undefined && d.c6_status_pernikahan !== null) c6Val = String(d.c6_status_pernikahan);
            else if (d.status_pernikahan || d.extra_data?.['Status Pernikahan']) {
                const s = String(d.status_pernikahan || d.extra_data?.['Status Pernikahan']).toLowerCase();
                if (s.includes('belum') || s === '1') c6Val = '1';
                else if (s.includes('cerai') || s === '3') c6Val = '3';
                else c6Val = '2';
            }
            document.getElementById('inputC6').value = c6Val;
        }
        // C7. Kepemilikan Anak Sekolah
        if (document.getElementById('c7')) {
            const v7 = d.c7 !== undefined && d.c7 !== null ? d.c7 : (d.c7_kepemilikan_anak !== undefined ? d.c7_kepemilikan_anak : (d.c7_anak_sekolah !== undefined ? d.c7_anak_sekolah : (d.extra_data?.['C7'] || d.extra_data?.['c7'] || '')));
            document.getElementById('c7').value = v7 !== '' ? Math.round(Number(v7) || 0) : '';
        }
        // C8. Status Tempat Tinggal (1 = Milik Sendiri, 2 = Sewa/Kontrak, 3 = Menumpang/Tidak Layak)
        if (document.getElementById('inputC8')) {
            let c8Val = '1';
            if (d.c8 !== undefined && d.c8 !== null && String(d.c8) !== '') c8Val = String(d.c8);
            else if (d.c8_tempat_tinggal !== undefined && d.c8_tempat_tinggal !== null) c8Val = String(d.c8_tempat_tinggal);
            else if (d.status_tempat_tinggal || d.extra_data?.['Status Tempat Tinggal']) {
                const s = String(d.status_tempat_tinggal || d.extra_data?.['Status Tempat Tinggal']).toLowerCase();
                if (s.includes('sewa') || s.includes('kontrak') || s === '2') c8Val = '2';
                else if (s.includes('numpang') || s.includes('tidak layak') || s === '3') c8Val = '3';
                else c8Val = '1';
            }
            document.getElementById('inputC8').value = c8Val;
        }
        // C9. Tingkat Pendidikan Terakhir (1 = SD/Tidak Sekolah, 2 = SMP, 3 = SMA/SMK, 4 = Sarjana/Diploma)
        if (document.getElementById('inputC9')) {
            let c9Val = '1';
            if (d.c9 !== undefined && d.c9 !== null && String(d.c9) !== '') c9Val = String(d.c9);
            else if (d.c9_pendidikan !== undefined && d.c9_pendidikan !== null) c9Val = String(d.c9_pendidikan);
            else if (d.pendidikan || d.extra_data?.['Pendidikan']) {
                const s = String(d.pendidikan || d.extra_data?.['Pendidikan']).toLowerCase();
                if (s.includes('sarjana') || s.includes('diploma') || s.includes('s1') || s === '4') c9Val = '4';
                else if (s.includes('sma') || s.includes('smk') || s === '3') c9Val = '3';
                else if (s.includes('smp') || s === '2') c9Val = '2';
                else c9Val = '1';
            }
            document.getElementById('inputC9').value = c9Val;
        }
        // C10. Status Kesehatan (1 = Sehat, 2 = Sakit Menahun / Disabilitas Fisik)
        if (document.getElementById('inputC10')) {
            let c10Val = '1';
            if (d.c10 !== undefined && d.c10 !== null && String(d.c10) !== '') c10Val = String(d.c10);
            else if (d.c10_kesehatan !== undefined && d.c10_kesehatan !== null) c10Val = String(d.c10_kesehatan);
            else if (d.status_kesehatan || d.extra_data?.['Status Kesehatan']) {
                const s = String(d.status_kesehatan || d.extra_data?.['Status Kesehatan']).toLowerCase();
                if (s.includes('sakit') || s.includes('disabilitas') || s === '2') c10Val = '2';
                else c10Val = '1';
            }
            document.getElementById('inputC10').value = c10Val;
        }

        // 10. Catatan Lapangan Tambahan (Lengkap)
        if (document.getElementById('catatan')) {
            document.getElementById('catatan').value = d.catatan || d.keterangan || d.catatan_lapangan || d.extra_data?.['Catatan'] || d.extra_data?.['Catatan Lapangan'] || '';
        }

        // Tampilkan notifikasi sukses dengan keseluruhan rincian arsip
        const jkLabel = (d.c4 == 2 || String(d.jenis_kelamin).toLowerCase().includes('perempuan')) ? 'Perempuan (2)' : 'Laki-laki (1)';
        const formattedC1 = d.c1 !== undefined && d.c1 !== null && d.c1 !== '' ? `Rp ${Number(d.c1).toLocaleString('id-ID')}` : '-';
        const formattedC2 = d.c2 !== undefined && d.c2 !== null && d.c2 !== '' ? `Rp ${Number(d.c2).toLocaleString('id-ID')}` : '-';
        
        const nikVal = d.nik || nik;
        const namaVal = d.nama || d.nama_lengkap || 'Warga Terdata';
        const ttlVal = `${d.tempat_lahir || d.tempatLahir || 'Sidoarjo'}, ${tglLahirFormatted || '-'}`;
        const kontakVal = d.no_hp || d.telepon || d.hp || d.noHp || '-';
        const emailVal = d.email || '-';
        const alamatVal = d.alamat || '-';
        const geoVal = (latVal && lngVal) ? `${latVal}, ${lngVal}` : 'Belum Tersemat';
        const catatanVal = d.catatan || d.keterangan || d.catatan_lapangan || '-';

        const nikahLabel = (document.getElementById('inputC6')?.options[document.getElementById('inputC6')?.selectedIndex]?.text) || 'Menikah (2)';
        const rumahLabel = (document.getElementById('inputC8')?.options[document.getElementById('inputC8')?.selectedIndex]?.text) || 'Milik Sendiri (1)';
        const pendLabel = (document.getElementById('inputC9')?.options[document.getElementById('inputC9')?.selectedIndex]?.text) || 'Tidak Sekolah / SD (1)';
        const sehatLabel = (document.getElementById('inputC10')?.options[document.getElementById('inputC10')?.selectedIndex]?.text) || 'Sehat (1)';

        // Tampilkan modal hasil verifikasi HANYA dengan tombol 'Selesai' (TIDAK ADA tombol Cancel)
        showAdminAlert({
            icon: 'success',
            title: 'Data Arsip Warga Ditemukan!',
            html: `
                <div style="text-align:left; font-size:0.86rem; line-height:1.6; background:#f8fafc; padding:14px 16px; border-radius:12px; border:1px solid #e2e8f0; margin-top:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #cbd5e1; padding-bottom:8px;">
                        <span style="font-weight:800; font-size:0.98rem; color:#0f172a;">${namaVal}</span>
                        <span style="background:#dcfce7; color:#15803d; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem;"><i class="fas fa-check-circle mr-1"></i> Arsip Terverifikasi</span>
                    </div>

                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:6px; margin-bottom:10px;">
                        <div><span style="color:#64748b;">NIK:</span> <b>${nikVal}</b></div>
                        <div><span style="color:#64748b;">TTL:</span> <b>${ttlVal}</b></div>
                        <div><span style="color:#64748b;">Jenis Kelamin:</span> <b>${jkLabel}</b></div>
                        <div><span style="color:#64748b;">Kontak:</span> <b>${kontakVal}</b></div>
                        <div><span style="color:#64748b;">Email:</span> <b>${emailVal}</b></div>
                        <div><span style="color:#64748b;">Titik Geotagging:</span> <b style="font-family:monospace; color:#0284c7;">${geoVal}</b></div>
                    </div>

                    <div style="margin-bottom:10px;"><span style="color:#64748b;">Alamat Lengkap:</span><br><b>${alamatVal}</b></div>

                    <div style="background:#f1f5f9; padding:10px 12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:10px;">
                        <div style="font-weight:800; color:#0f172a; margin-bottom:6px; font-size:0.84rem; display:flex; align-items:center; gap:6px;">
                            <i class="fas fa-list-check" style="color:#009846;"></i> Ringkasan 10 Kriteria Kelayakan:
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:4px; font-size:0.82rem;">
                            <div><b>C1. Ekonomi:</b> ${formattedC1}</div>
                            <div><b>C2. Aset:</b> ${formattedC2}</div>
                            <div><b>C3. Usia:</b> ${d.c3 !== undefined && d.c3 !== null ? d.c3 : '-'} Tahun</div>
                            <div><b>C4. Gender:</b> ${jkLabel}</div>
                            <div><b>C5. Tanggungan:</b> ${d.c5 !== undefined && d.c5 !== null ? d.c5 : '-'} Jiwa</div>
                            <div><b>C6. Pernikahan:</b> ${nikahLabel}</div>
                            <div><b>C7. Anak Sekolah:</b> ${d.c7 !== undefined && d.c7 !== null ? d.c7 : '-'} Anak</div>
                            <div><b>C8. Tempat Tinggal:</b> ${rumahLabel}</div>
                            <div><b>C9. Pendidikan:</b> ${pendLabel}</div>
                            <div><b>C10. Kesehatan:</b> ${sehatLabel}</div>
                        </div>
                    </div>

                    <div style="background:#fff7ed; padding:8px 12px; border-radius:8px; border:1px solid #fed7aa; margin-bottom:10px; font-size:0.82rem; color:#9a3412;">
                        <b><i class="fas fa-sticky-note mr-1"></i> Catatan Lapangan:</b> ${catatanVal}
                    </div>

                    <div style="padding-top:6px; border-top:1px dashed #cbd5e1; color:#059669; font-weight:700; font-size:0.84rem; text-align:center;">
                        <i class="fas fa-check-double mr-1"></i> Seluruh data arsip warga telah otomatis dimasukkan ke dalam Formulir Pendataan Warga.
                    </div>
                </div>
            `,
            showCancelButton: false,
            showCloseButton: false,
            confirmButtonColor: '#009846',
            confirmButtonText: 'Selesai',
            customClass: {
                popup: 'swal-modern-rounded swal-no-cancel',
                confirmButton: 'swal-btn-pill-confirm',
                cancelButton: 'swal-btn-hidden-force'
            },
            didOpen: (popup) => {
                popup?.querySelector('.swal2-cancel')?.remove();
                popup?.querySelector('.swal2-close')?.remove();
            }
        });

    } catch (err) {
        console.error('Error saat memeriksa data warga:', err);
        showAdminAlert({ 
            icon: 'error', 
            title: 'Gagal Memeriksa Data', 
            text: 'Terjadi kendala saat memeriksa data ke basis data arsip.' 
        });
    }
};

// =========================================================================
// 9. GEOTAGGING FORM PENDAFTARAN WARGA
// =========================================================================
window.initFormMapPicker = function () {
    const mapBox = document.getElementById('formCoordMap');
    if (!mapBox || typeof L === 'undefined') return;

    if (mapBox._leaflet_id) {
        try {
            if (formMap) formMap.remove();
        } catch (e) {}
        mapBox._leaflet_id = null;
        formMap = null;
    }

    formMap = L.map('formCoordMap', { attributionControl: false }).setView(window.MAP_CENTER_SIDOARJO, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(formMap);

    formMarker = L.marker(window.MAP_CENTER_SIDOARJO, { draggable: true }).addTo(formMap);

    formMarker.on('dragend', function (e) {
        const pos = e.target.getLatLng();
        window.updateLocationAndAddress(pos.lat, pos.lng);
    });

    formMap.on('click', function (e) {
        formMarker.setLatLng(e.latlng);
        window.updateLocationAndAddress(e.latlng.lat, e.latlng.lng);
    });

    window.setFormCoords(window.MAP_CENTER_SIDOARJO[0], window.MAP_CENTER_SIDOARJO[1]);
};

window.setFormCoords = function (lat, lng) {
    const latEl = document.getElementById('lat');
    const lngEl = document.getElementById('lng');
    if (latEl) latEl.value = Number(lat || window.MAP_CENTER_SIDOARJO[0]).toFixed(6);
    if (lngEl) lngEl.value = Number(lng || window.MAP_CENTER_SIDOARJO[1]).toFixed(6);
};

window.updateLocationAndAddress = async function (lat, lng) {
    window.setFormCoords(lat, lng);
    const alamatEl = document.getElementById('alamat');

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.display_name && alamatEl && (!alamatEl.value || alamatEl.value === 'Sidoarjo')) {
                alamatEl.value = data.display_name;
            }
        }
    } catch (err) { }
};

window.cariAlamatDiPeta = async function (query) {
    if (!query || String(query).trim().length < 4) return;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Kabupaten Sidoarjo')}&limit=1`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                if (formMap && formMarker) {
                    formMap.setView([lat, lng], 16);
                    formMarker.setLatLng([lat, lng]);
                }
                window.setFormCoords(lat, lng);
            }
        }
    } catch (e) { }
};

window.ambilLokasiGPS = function () {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                if (formMap && formMarker) {
                    formMap.setView([lat, lng], 16);
                    formMarker.setLatLng([lat, lng]);
                }
                window.updateLocationAndAddress(lat, lng);
            },
            () => showAdminAlert({ icon: 'error', title: 'GPS Gagal', text: 'Izinkan akses geolokasi pada peramban Anda.' })
        );
    }
};

// =========================================================================


// 12. PENDAFTARAN DATA WARGA BARU
// =========================================================================
window.tambahData = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const payload = {
        nama: document.getElementById('nama')?.value.trim(),
        nik: document.getElementById('nik')?.value.trim(),
        no_hp: document.getElementById('no_hp')?.value.trim() || '',
        email: document.getElementById('email')?.value.trim() || '',
        tempat_lahir: document.getElementById('tempatLahir')?.value.trim() || 'Sidoarjo',
        tanggal_lahir: document.getElementById('tglLahir')?.value || null,
        alamat: document.getElementById('alamat')?.value.trim() || 'Sidoarjo',
        lat: document.getElementById('lat')?.value || '',
        lng: document.getElementById('lng')?.value || '',
        c1: parseFloat(document.getElementById('c1')?.value || 0),
        c2: parseInt(document.getElementById('c2')?.value || 0),
        c3: parseInt(document.getElementById('c3')?.value || 0),
        c4: parseInt(document.getElementById('inputC4')?.value || 1),
        c5: parseInt(document.getElementById('c5')?.value || 0),
        c6: parseInt(document.getElementById('inputC6')?.value || 1),
        c7: parseInt(document.getElementById('c7')?.value || 0),
        c8: parseInt(document.getElementById('inputC8')?.value || 1),
        c9: parseInt(document.getElementById('inputC9')?.value || 1),
        c10: parseInt(document.getElementById('inputC10')?.value || 1),
        catatan: document.getElementById('catatan')?.value.trim() || ''
    };

    if (!payload.nik || !payload.nama) {
        return showAdminAlert({ icon: 'warning', title: 'Peringatan', text: 'NIK dan Nama Lengkap wajib diisi.' });
    }

    const abortController = new AbortController();
    let isCancelled = false;

    showAdminAlert({ 
        title: 'Menyimpan Data Warga...', 
        subtitle: `Menyimpan data warga atas nama ${payload.nama} ke dalam sistem...`,
        totalItems: 1,
        isBulk: false,
        allowOutsideClick: false, 
        abortController: abortController,
        initialStage: 'Memvalidasi data & menghubungi peladen...',
        onCancel: () => {
            isCancelled = true;
            try { abortController.abort('Penginputan dibatalkan oleh pengguna'); } catch (e) {}
        },
        didOpen: () => Swal?.showLoading() 
    });

    try {
        let res = await fetch(`${window.BASE_URL}/api/warga`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
            body: JSON.stringify(payload),
            signal: abortController.signal
        });

        if (!res.ok) {
            res = await fetch(`${window.BASE_URL}/warga`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
                body: JSON.stringify(payload),
                signal: abortController.signal
            });
        }

        const json = await res.json();
        if (res && res.ok) {
            showAdminAlert({ icon: 'success', title: 'Berhasil', text: json.message || 'Data warga berhasil disimpan!' });
            document.getElementById('bansosForm')?.reset();
            window.loadDashboardData();
        } else {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: json.message || 'Gagal menyimpan data.' });
        }
    } catch (err) {
        if (err.name === 'AbortError' || isCancelled) {
            return showAdminAlert({
                icon: 'info',
                title: 'Penginputan Dibatalkan',
                text: 'Proses penginputan data warga berhasil dibatalkan. Isian pada formulir tetap tersimpan.'
            });
        }
        showAdminAlert({ icon: 'error', title: 'Error', text: 'Kendala komunikasi ke peladen backend.' });
    }
};

window.applyFilter = function (filterType, btn) {
    window.currentFilter = filterType;
    document.querySelectorAll('.filter-kategori').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window.filterAndRenderData();
};

window.applySort = function (sortType, btn) {
    window.currentSort = sortType;
    document.querySelectorAll('.filter-btn:not(.filter-kategori)').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window.filterAndRenderData();
};

window.toggleSortNik = function () {
    window.sortNikAsc = !window.sortNikAsc;
    const btn = document.getElementById('btnSortNik');
    if (btn) {
        btn.innerHTML = window.sortNikAsc 
            ? '<i class="fas fa-sort-numeric-down"></i> NIK Terkecil' 
            : '<i class="fas fa-sort-numeric-up"></i> NIK Terbesar';
    }
    window.applySort(window.sortNikAsc ? 'nik_asc' : 'nik_desc', btn);
};

window.toggleSortAz = function (btnEl) {
    window.sortAzAsc = !window.sortAzAsc;
    const btn = btnEl || document.getElementById('btnSortAz');
    if (btn) {
        btn.innerHTML = window.sortAzAsc 
            ? '<i class="fas fa-sort-alpha-down"></i> Nama A - Z' 
            : '<i class="fas fa-sort-alpha-up"></i> Nama Z - A';
    }
    window.applySort(window.sortAzAsc ? 'az' : 'za', btn);
};

// =========================================================================


// 14. OPERASI STATUS VERIFIKASI (SATUAN & MASSAL)
// =========================================================================
window.ubahStatusVerifikasiWarga = async function (idOrNik, statusSetuju) {
    let targetId = idOrNik;
    if (typeof targetId === 'string' && targetId.length === 16 && /^\d+$/.test(targetId)) {
        try {
            if (window.jQuery && $.fn.DataTable && $.fn.DataTable.isDataTable('#dataTable')) {
                const allRows = $('#dataTable').DataTable().rows().data().toArray();
                const found = allRows.find(r => String(r.nik).trim() === targetId.trim());
                if (found && found.id) targetId = found.id;
            }
        } catch (e) {}
    }

    showAdminAlert({
        title: statusSetuju ? 'Menyetujui Warga...' : 'Membatalkan Persetujuan...',
        allowOutsideClick: false,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const payload = { is_verified: statusSetuju, status_validasi: statusSetuju ? 'Disetujui' : 'Menunggu' };
        let res = await fetch(`${window.BASE_API_URL}/api/warga/${targetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            res = await fetch(`${window.BASE_API_URL}/warga/${targetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            showAdminAlert({
                icon: 'success',
                title: statusSetuju ? 'Disetujui!' : 'Dibatalkan!',
                timer: 1300,
                showConfirmButton: false,
                customClass: { popup: 'swal-modern-rounded' }
            });
            if (typeof window.loadDashboardData === 'function') window.loadDashboardData(false);
            else location.reload();
        } else {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.message || 'Gagal mengubah status verifikasi.');
        }
    } catch (e) {
        showAdminAlert({ 
            icon: 'error', 
            title: 'Gagal', 
            text: e.message, 
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger' }, 
            buttonsStyling: false 
        });
    }
};

window.setujuiWarga = (id) => window.ubahStatusVerifikasiWarga(id, true);
window.batalkanWarga = (id) => window.ubahStatusVerifikasiWarga(id, false);
window.toggleVerifySingle = (id, namaWarga) => {
    const dataList = window.globalDataWarga || [];
    const w = dataList.find(item => item.id === id);
    window.ubahStatusVerifikasiWarga(id, !w?.is_verified);
};

window.setujuiSemuaWargaInstan = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const k = await Swal.fire({
        title: 'Setujui Seluruh Warga?',
        text: 'Seluruh data warga terdaftar akan disetujui bersamaan.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Setujui',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-confirm', cancelButton: 'swal-btn-pill-cancel' }
    });
    if (k.isConfirmed) {
        showAdminAlert({ title: 'Memproses...', customClass: { popup: 'swal-modern-rounded' }, didOpen: () => Swal?.showLoading() });
        try {
            await fetch(`${window.BASE_API_URL}/api/warga/verify-all`, { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` } 
            });
            if (typeof window.loadDashboardData === 'function') window.loadDashboardData(false);
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: err.message });
        }
    }
};

window.batalkanSemuaWargaInstan = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const k = await Swal.fire({
        title: 'Batalkan Semua Persetujuan?',
        text: 'Status verifikasi akan dikembalikan ke status Menunggu.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Batalkan',
        cancelButtonText: 'Tutup',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-warning', cancelButton: 'swal-btn-pill-cancel' }
    });
    if (k.isConfirmed) {
        showAdminAlert({ title: 'Memproses...', customClass: { popup: 'swal-modern-rounded' }, didOpen: () => Swal?.showLoading() });
        try {
            await fetch(`${window.BASE_API_URL}/api/warga/unverify-all`, { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` } 
            });
            if (typeof window.loadDashboardData === 'function') window.loadDashboardData(false);
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: err.message });
        }
    }
};

window.hapusSemuaWargaAman = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const k = await Swal.fire({
        title: 'Hapus Semua Data Arsip Warga?',
        text: 'Seluruh data warga dalam arsip akan dikosongkan. Pastikan Anda telah menyimpan cadangan jika diperlukan.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus Semua Data',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger', cancelButton: 'swal-btn-pill-cancel' }
    });
    if (k.isConfirmed) {
        showAdminAlert({ title: 'Menghapus Seluruh Arsip...', customClass: { popup: 'swal-modern-rounded' }, didOpen: () => Swal?.showLoading() });
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

            // Bersihkan state memori frontend
            window.globalDataWarga = [];
            window.cachedWarga = [];
            localStorage.removeItem('bansos_warga_cache');
            localStorage.removeItem('bansos_data_warga');

            // Kosongkan tabel DataTables
            if (window.$ && $.fn && $.fn.DataTable && $.fn.DataTable.isDataTable('#dataTable')) {
                $('#dataTable').DataTable().clear().draw();
            } else {
                const tbody = document.querySelector('#dataTable tbody');
                if (tbody) tbody.innerHTML = '';
            }

            // Kosongkan marker pada peta Leaflet
            if (window.clusterWargaGroup && typeof window.clusterWargaGroup.clearLayers === 'function') {
                window.clusterWargaGroup.clearLayers();
            }

            // Perbarui indikator statistik ke 0
            if (typeof window.updateStatsAndCards === 'function') {
                window.updateStatsAndCards(0, 0, 0, 0, false);
            } else {
                ['statTotal', 'statValid', 'statTotalRef', 'statValidBadge', 'statMenungguBadge', 'statTelahSalur', 'statBelumSalurBadge', 'statSengketa', 'statBebasSengketaBadge'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = '0';
                });
            }

            // Perbarui grafik statistik ke 0
            if (typeof window.render3DashboardCharts === 'function') {
                try { window.render3DashboardCharts([]); } catch (_) {}
            }

            // Status database pill
            const statusText = document.getElementById('cmdDbStatusText');
            const statusPill = document.getElementById('cmdDbStatusPill');
            if (statusText && statusPill) {
                statusText.innerText = 'Database Kosong';
                statusPill.style.background = '#fffbeb';
                statusPill.style.borderColor = '#fde68a';
                statusPill.style.color = '#b45309';
            }

            Swal.fire({
                icon: 'success',
                title: 'Arsip Dikosongkan!',
                text: 'Seluruh data warga di dalam arsip telah berhasil dihapus.',
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menghapus',
                text: err.message || 'Terjadi kendala saat mengosongkan data arsip.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    }
};

window.bulkProcess = async function (action) {
    const checkedBoxes = Array.from(document.querySelectorAll('.row-checkbox:checked'));
    const checked = checkedBoxes.map(cb => cb.value).filter(Boolean);
    if (!checked.length) {
        return showAdminAlert({ icon: 'warning', title: 'Pilih Data', text: 'Pilih minimal satu baris warga terlebih dahulu.' });
    }

    if (action === 'verify') {
        return window.setujuiSemuaWargaInstan();
    } else if (action === 'delete') {
        const k = await Swal.fire({
            title: `Hapus ${checked.length} Data Terpilih?`,
            text: `Sebanyak ${checked.length} data arsip warga akan dihapus dari sistem. Tindakan ini tidak dapat dibatalkan.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus Data',
            cancelButtonText: 'Batal',
            buttonsStyling: false,
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger', cancelButton: 'swal-btn-pill-cancel' }
        });
        if (k.isConfirmed) {
            showAdminAlert({ title: 'Menghapus Data Terpilih...', customClass: { popup: 'swal-modern-rounded' }, didOpen: () => Swal?.showLoading() });
            try {
                const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
                let res = await fetch(`${base}/api/warga/bulk-delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
                    body: JSON.stringify({ ids: checked })
                });
                if (!res.ok) {
                    res = await fetch(`${base}/warga/bulk-delete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
                        body: JSON.stringify({ ids: checked })
                    });
                }

                // Hapus langsung dari state memori frontend
                if (window.globalDataWarga) {
                    window.globalDataWarga = window.globalDataWarga.filter(w => !checked.includes(String(w.id)) && !checked.includes(String(w.nik)));
                }

                await window.loadDashboardData(false);
                Swal.fire({
                    icon: 'success',
                    title: 'Data Berhasil Dihapus',
                    text: `Sebanyak ${checked.length} data warga telah berhasil dihapus dari arsip.`,
                    buttonsStyling: false,
                    confirmButtonText: 'Oke, Mengerti',
                    customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
                });
            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal Menghapus',
                    text: err.message || 'Terjadi kesalahan saat menghapus data.',
                    buttonsStyling: false,
                    confirmButtonText: 'Oke',
                    customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
                });
            }
        }
    }
};

window.verifyAllData = (e) => window.setujuiSemuaWargaInstan(e);
window.unverifyAllData = (e) => window.batalkanSemuaWargaInstan(e);
window.hapusSemuaWarga = () => window.hapusSemuaWargaAman();

window.syncBPS = async function () {
    showAdminAlert({ title: 'Sinkronisasi Data BPS Sidoarjo...', didOpen: () => Swal?.showLoading() });
    try {
        const res = await fetch(`${window.BASE_URL}/api/bps/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        const json = await res.json();
        Swal?.close();
        showAdminAlert({ icon: 'success', title: 'BPS Terhubung', text: json.message || 'Indikator kemiskinan makro BPS Kabupaten Sidoarjo berhasil disinkronkan.' });
    } catch (e) {
        showAdminAlert({ icon: 'info', title: 'Data BPS Termutakhir', text: 'Indikator kemiskinan makro BPS Kabupaten Sidoarjo telah aktif pada sistem.' });
    }
};

// =========================================================================


// 18. MODAL EDIT & BUKTI SALUR DENGAN DUKUNGAN PULUHAN VARIABEL (20, 39, 50+)
// =========================================================================
window.activeEditTab = 'identitas';

window.switchEditTab = function (tabName) {
    window.activeEditTab = tabName;
    const tabs = ['identitas', 'kriteria', 'kustom', 'status'];
    const btnAll = document.getElementById('tabBtnEditAll');
    if (btnAll) {
        if (tabName === 'all') btnAll.classList.add('active');
        else btnAll.classList.remove('active');
    }

    tabs.forEach(t => {
        const btn = document.getElementById(`tabBtnEdit${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const panel = document.getElementById(`sectionEdit${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn) {
            if (t === tabName && tabName !== 'all') btn.classList.add('active');
            else btn.classList.remove('active');
        }
        if (panel) {
            panel.style.display = (tabName === 'all' || t === tabName) ? 'block' : 'none';
        }
    });
};

window.filterEditVariables = function (query) {
    const q = (query || '').toLowerCase().trim();
    const cards = document.querySelectorAll('#editForm .edit-var-card');
    cards.forEach(card => {
        if (!q) {
            card.style.display = '';
            return;
        }
        const text = (card.innerText || '').toLowerCase();
        const fieldName = (card.getAttribute('data-fieldname') || '').toLowerCase();
        const inputs = Array.from(card.querySelectorAll('input, select, textarea')).map(i => (i.value || '') + ' ' + (i.placeholder || '')).join(' ').toLowerCase();
        const match = text.includes(q) || fieldName.includes(q) || inputs.includes(q);
        card.style.display = match ? '' : 'none';
    });
};

window.bukaModalEdit = function (id) {
    const dataList = window.globalDataWarga || [];
    const w = dataList.find(item => String(item.id) === String(id));
    if (!w) {
        return showAdminAlert({ icon: 'error', title: 'Data Tidak Ditemukan', text: 'Data warga ini tidak ditemukan di memori arsip.' });
    }

    if (document.getElementById('editId')) document.getElementById('editId').value = w.id;
    if (document.getElementById('editNama')) document.getElementById('editNama').value = w.nama || '';
    if (document.getElementById('editNik')) document.getElementById('editNik').value = w.nik || '';
    if (document.getElementById('editNoHp')) document.getElementById('editNoHp').value = w.no_hp || '';
    if (document.getElementById('editEmail')) document.getElementById('editEmail').value = w.email || '';
    if (document.getElementById('editTempatLahir')) document.getElementById('editTempatLahir').value = w.tempat_lahir || '';
    if (document.getElementById('editTglLahir')) document.getElementById('editTglLahir').value = w.tanggal_lahir || '';
    if (document.getElementById('editAlamat')) document.getElementById('editAlamat').value = w.alamat || '';

    if (document.getElementById('editC1')) document.getElementById('editC1').value = w.c1 !== undefined ? w.c1 : 1500000;
    if (document.getElementById('editC2')) document.getElementById('editC2').value = w.c2 !== undefined ? w.c2 : 5000000;
    if (document.getElementById('editC3')) document.getElementById('editC3').value = w.c3 !== undefined ? w.c3 : 45;
    if (document.getElementById('editC4')) document.getElementById('editC4').value = w.c4 !== undefined ? w.c4 : 1;
    if (document.getElementById('editC5')) document.getElementById('editC5').value = w.c5 !== undefined ? w.c5 : 3;
    if (document.getElementById('editC6')) document.getElementById('editC6').value = w.c6 !== undefined ? w.c6 : 2;
    if (document.getElementById('editC7')) document.getElementById('editC7').value = w.c7 !== undefined ? w.c7 : 2;
    if (document.getElementById('editC8')) document.getElementById('editC8').value = w.c8 !== undefined ? w.c8 : 2;
    if (document.getElementById('editC9')) document.getElementById('editC9').value = w.c9 !== undefined ? w.c9 : 1;
    if (document.getElementById('editC10')) document.getElementById('editC10').value = w.c10 !== undefined ? w.c10 : 1;
    if (document.getElementById('editCatatan')) document.getElementById('editCatatan').value = w.catatan || '';

    // Perbarui judul & badge NIK
    const namaTitle = document.getElementById('editWargaNamaTitle');
    const nikBadge = document.getElementById('editWargaNikBadge');
    if (namaTitle) namaTitle.innerText = w.nama || 'Warga';
    if (nikBadge) nikBadge.innerText = `NIK: ${w.nik || '-'}`;

    // Ekstraksi SELURUH Variabel Tambahan / Dinamis (Mendukung 20, 39, 50, atau 100+ variabel!)
    const coreKeys = new Set([
        'id', 'nama', 'nama_lengkap', 'nik', 'no_hp', 'email', 'tempat_lahir', 'tanggal_lahir', 'alamat',
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10',
        'catatan', 'nominal_bantuan', 'status_validasi', 'status_salur', 'tanggal_salur',
        'is_verified', 'is_layak', 'created_at', 'bukti_salur', 'keterangan_salur', 'konfirmasi_warga', 'waktu_konfirmasi_warga',
        'skor_saw', 'desil', 'rank_saw', 'ranking_saw', 'lat', 'lng',
        'extra_data', 'custom_fields'
    ]);

    // Kumpulkan SEMUA nama variabel dinamis dari seluruh data yang ada dan data yang pernah diimpor
    const allDatasetVars = new Set();

    // 1. Dari header impor yang pernah dimasukkan
    if (Array.isArray(window.stagedUnifiedHeaders)) {
        window.stagedUnifiedHeaders.forEach(h => {
            if (!h) return;
            const hClean = h.trim();
            const hLow = hClean.toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (!coreKeys.has(hLow) && !coreKeys.has(hClean) && !hClean.startsWith('_')) {
                allDatasetVars.add(hClean);
            }
        });
    }

    // 2. Dari seluruh warga kependudukan di memori sistem
    (window.globalDataWarga || []).forEach(item => {
        Object.keys(item).forEach(k => {
            const kClean = k.trim();
            const kLow = kClean.toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (!coreKeys.has(kLow) && !coreKeys.has(kClean) && !kClean.startsWith('_')) {
                allDatasetVars.add(kClean);
            }
        });
        if (item.extra_data && typeof item.extra_data === 'object') {
            Object.keys(item.extra_data).forEach(ek => {
                const ekClean = ek.trim();
                const ekLow = ekClean.toLowerCase().replace(/[^a-z0-9]/g, '_');
                if (!coreKeys.has(ekLow) && !coreKeys.has(ekClean) && !ekClean.startsWith('_')) {
                    allDatasetVars.add(ekClean);
                }
            });
        }
    });

    // 3. Tambahkan juga properti khusus milik warga ini jika ada yang unik
    Object.keys(w).forEach(k => {
        const kClean = k.trim();
        const kLow = kClean.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (!coreKeys.has(kLow) && !coreKeys.has(kClean) && !kClean.startsWith('_')) {
            allDatasetVars.add(kClean);
        }
    });
    if (w.extra_data && typeof w.extra_data === 'object') {
        Object.keys(w.extra_data).forEach(ek => {
            const ekClean = ek.trim();
            const ekLow = ekClean.toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (!coreKeys.has(ekLow) && !coreKeys.has(ekClean) && !ekClean.startsWith('_')) {
                allDatasetVars.add(ekClean);
            }
        });
    }

    // 4. Siapkan array entri variabel untuk warga ini
    const dynamicEntries = [];
    allDatasetVars.forEach(varKey => {
        let val = '';
        if (w[varKey] !== undefined && w[varKey] !== null) {
            val = w[varKey];
        } else if (w.extra_data && w.extra_data[varKey] !== undefined && w.extra_data[varKey] !== null) {
            val = w.extra_data[varKey];
        } else {
            // Cek variasi lower/underscore
            const lowerK = varKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (w[lowerK] !== undefined && w[lowerK] !== null) {
                val = w[lowerK];
            } else if (w.extra_data && w.extra_data[lowerK] !== undefined && w.extra_data[lowerK] !== null) {
                val = w.extra_data[lowerK];
            }
        }
        dynamicEntries.push({ key: varKey, value: val });
    });

    // 3. Render kartu input dinamis untuk setiap variabel
    const dynamicContainer = document.getElementById('editDynamicVarsContainer');
    const emptyNotice = document.getElementById('editDynamicVarsEmptyNotice');
    
    if (dynamicContainer) {
        dynamicContainer.innerHTML = '';
        if (dynamicEntries.length > 0) {
            dynamicEntries.forEach(entry => {
                dynamicContainer.appendChild(window.buatElemenKartuVariabelDinamis(entry.key, entry.value));
            });
            if (emptyNotice) emptyNotice.style.display = 'none';
        } else {
            if (emptyNotice) emptyNotice.style.display = 'block';
        }
    }

    // Hitung total seluruh variabel (Identitas 7 + Kriteria 10 + Status 3 + Kustom N)
    const totalCount = 7 + 10 + 3 + dynamicEntries.length;
    const totalEl = document.getElementById('editTotalVarsCount');
    const customBadge = document.getElementById('editCustomVarsCountBadge');
    if (totalEl) totalEl.innerText = `${totalCount}`;
    if (customBadge) customBadge.innerText = `${dynamicEntries.length}`;

    // Reset pencarian & kembali ke tab pertama
    const searchInp = document.getElementById('editVarSearchInput');
    if (searchInp) searchInp.value = '';
    window.switchEditTab('identitas');

    const modal = document.getElementById('modalEdit');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

window.buatElemenKartuVariabelDinamis = function (keyName, val) {
    const card = document.createElement('div');
    card.className = 'edit-var-card custom-var-card edit-searchable-field';
    card.setAttribute('data-fieldname', `${keyName} ${val}`);

    card.innerHTML = `
        <div class="edit-var-header">
            <input type="text" class="custom-var-key form-input" value="${window.escapeInlineJS(keyName)}" placeholder="Nama Variabel" style="border-radius:8px; padding:4px 8px; font-weight:800; font-size:0.78rem; text-transform:uppercase; background:#f5f3ff; border:1px solid #c4b5fd; color:#6d28d9; max-width:180px;">
            <button type="button" onclick="window.hapusInputVariabelKustomEdit(this)" class="btn btn-sm" style="background:#fee2e2; color:#dc2626; border:none; border-radius:6px; padding:3px 8px; font-size:0.75rem;" title="Hapus Variabel Ini">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
        <input type="text" class="custom-var-val form-input" value="${window.escapeInlineJS(String(val !== undefined && val !== null ? val : ''))}" placeholder="Nilai data variabel..." style="border-radius:10px; margin-top:2px;">
    `;
    return card;
};

window.tambahInputVariabelKustomEdit = function () {
    const container = document.getElementById('editDynamicVarsContainer');
    const emptyNotice = document.getElementById('editDynamicVarsEmptyNotice');
    if (!container) return;

    if (emptyNotice) emptyNotice.style.display = 'none';
    const varCount = container.querySelectorAll('.custom-var-card').length + 1;
    const defaultName = `VARIABEL_BARU_${varCount}`;
    const newCard = window.buatElemenKartuVariabelDinamis(defaultName, '');
    container.appendChild(newCard);

    // Fokuskan input nama variabel baru
    const keyInput = newCard.querySelector('.custom-var-key');
    if (keyInput) {
        keyInput.focus();
        keyInput.select();
    }

    // Perbarui counter
    const currentCustom = container.querySelectorAll('.custom-var-card').length;
    const customBadge = document.getElementById('editCustomVarsCountBadge');
    const totalEl = document.getElementById('editTotalVarsCount');
    if (customBadge) customBadge.innerText = `${currentCustom}`;
    if (totalEl) totalEl.innerText = `${20 + currentCustom}`;
};

window.hapusInputVariabelKustomEdit = function (btn) {
    const card = btn.closest('.custom-var-card');
    if (card) {
        card.remove();
        const container = document.getElementById('editDynamicVarsContainer');
        const emptyNotice = document.getElementById('editDynamicVarsEmptyNotice');
        const currentCustom = container ? container.querySelectorAll('.custom-var-card').length : 0;
        if (currentCustom === 0 && emptyNotice) {
            emptyNotice.style.display = 'block';
        }
        const customBadge = document.getElementById('editCustomVarsCountBadge');
        const totalEl = document.getElementById('editTotalVarsCount');
        if (customBadge) customBadge.innerText = `${currentCustom}`;
        if (totalEl) totalEl.innerText = `${20 + currentCustom}`;
    }
};

window.simpanEdit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const id = document.getElementById('editId').value;
    const existing = (window.globalDataWarga || []).find(x => String(x.id) === String(id));

    // Kumpulkan seluruh data standar
    const payload = {
        nama: document.getElementById('editNama').value.trim(),
        nik: document.getElementById('editNik').value.trim(),
        no_hp: document.getElementById('editNoHp')?.value.trim() || existing?.no_hp || '',
        email: document.getElementById('editEmail')?.value.trim() || existing?.email || '',
        tempat_lahir: document.getElementById('editTempatLahir')?.value.trim() || existing?.tempat_lahir || 'Sidoarjo',
        tanggal_lahir: document.getElementById('editTglLahir')?.value || existing?.tanggal_lahir || null,
        alamat: document.getElementById('editAlamat')?.value.trim() || existing?.alamat || '',
        c1: document.getElementById('editC1') ? parseFloat(document.getElementById('editC1').value) : (existing?.c1 ?? 1500000),
        c2: document.getElementById('editC2') ? parseInt(document.getElementById('editC2').value) : (existing?.c2 ?? 5000000),
        c3: document.getElementById('editC3') ? parseInt(document.getElementById('editC3').value) : (existing?.c3 ?? 45),
        c4: document.getElementById('editC4') ? parseInt(document.getElementById('editC4').value) : (existing?.c4 ?? 1),
        c5: document.getElementById('editC5') ? parseInt(document.getElementById('editC5').value) : (existing?.c5 ?? 3),
        c6: document.getElementById('editC6') ? parseInt(document.getElementById('editC6').value) : (existing?.c6 ?? 2),
        c7: document.getElementById('editC7') ? parseInt(document.getElementById('editC7').value) : (existing?.c7 ?? 2),
        c8: document.getElementById('editC8') ? parseInt(document.getElementById('editC8').value) : (existing?.c8 ?? 2),
        c9: document.getElementById('editC9') ? parseInt(document.getElementById('editC9').value) : (existing?.c9 ?? 1),
        c10: document.getElementById('editC10') ? parseInt(document.getElementById('editC10').value) : (existing?.c10 ?? 1),
        catatan: document.getElementById('editCatatan')?.value.trim() || existing?.catatan || '',
        extra_data: {}
    };

    // Kumpulkan SELURUH Variabel Dinamis & Kustom dari Kartu Input
    const dynamicCards = document.querySelectorAll('#editDynamicVarsContainer .custom-var-card');
    let customCount = 0;
    dynamicCards.forEach(card => {
        const keyInp = card.querySelector('.custom-var-key');
        const valInp = card.querySelector('.custom-var-val');
        if (keyInp && keyInp.value.trim()) {
            const rawKey = keyInp.value.trim();
            const cleanKey = rawKey.replace(/\s+/g, '_');
            const val = valInp ? valInp.value.trim() : '';
            payload.extra_data[cleanKey] = val;
            payload[cleanKey] = val;
            payload.extra_data[rawKey] = val;
            payload[rawKey] = val;
            customCount++;
        }
    });

    showAdminAlert({
        title: 'Menyimpan Perubahan Data...',
        text: `Memperbarui data dan menyinkronkan ${20 + customCount} variabel kependudukan...`,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        let res = await fetch(`${base}/api/warga/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            res = await fetch(`${base}/warga/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.getCleanToken()}`
                },
                body: JSON.stringify(payload)
            });
        }

        const json = await res.json().catch(() => ({}));

        window.closeModal('modalEdit');
        await window.loadDashboardData(false);

        Swal.fire({
            icon: 'success',
            title: 'Perubahan Data Tersimpan!',
            text: json.message || `Data warga dan ${20 + customCount} variabel arsip kependudukan berhasil diperbarui.`,
            buttonsStyling: false,
            confirmButtonText: 'Oke, Mengerti',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menyimpan',
            text: err.message || 'Terjadi kendala saat memperbarui data warga.',
            buttonsStyling: false,
            confirmButtonText: 'Oke',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    }
};

// HAPUS SATU BARIS DATA WARGA DENGAN POPUP OKE MODERN & MEMBULAT
window.hapusData = async function (id, nikParam) {
    const target = (window.globalDataWarga || []).find(w => String(w.id) === String(id) || (nikParam && w.nik === nikParam) || (w.nik === String(id)));
    const namaTarget = target ? target.nama : 'warga terpilih';
    const targetNik = target ? target.nik : (nikParam || (String(id).length === 16 ? String(id) : ''));

    const k = await Swal.fire({
        title: 'Hapus Data Warga Ini?',
        text: `Data arsip atas nama "${namaTarget}" akan dihapus permanen dari sistem.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus Data',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        showAdminAlert({
            title: 'Menghapus Data...',
            customClass: { popup: 'swal-modern-rounded' },
            didOpen: () => Swal?.showLoading()
        });

        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            let res = await fetch(`${base}/api/warga/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                }
            });

            if (!res.ok && targetNik) {
                res = await fetch(`${base}/api/warga/${targetNik}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
                });
            }

            if (!res.ok) {
                res = await fetch(`${base}/api/warga/${id}/delete`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
                });
            }

            if (!res.ok && targetNik) {
                res = await fetch(`${base}/api/warga/${targetNik}/delete`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
                });
            }

            // Hapus dari state lokal seketika
            if (window.globalDataWarga) {
                window.globalDataWarga = window.globalDataWarga.filter(w => String(w.id) !== String(id) && (!targetNik || w.nik !== targetNik));
            }

            await window.loadDashboardData(false);

            Swal.fire({
                icon: 'success',
                title: 'Data Berhasil Dihapus',
                text: `Data arsip warga "${namaTarget}" telah berhasil dibersihkan dari arsip.`,
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menghapus',
                text: err.message || 'Terjadi kesalahan saat menghapus data warga.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    }
};

window.bukaUploadBuktiSalur = function (id) {
    const dataList = window.globalDataWarga || [];
    const w = dataList.find(item => String(item.id) === String(id));
    if (!w) return;

    window.activeBuktiSalurWarga = w;
    const idEl = document.getElementById('buktiSalurWargaId');
    const namaEl = document.getElementById('buktiSalurNama');
    const nikEl = document.getElementById('buktiSalurNik');
    const alamatEl = document.getElementById('buktiSalurAlamat');
    const avatarEl = document.getElementById('buktiSalurAvatar');

    if (idEl) idEl.value = w.id;
    if (namaEl) namaEl.innerText = w.nama || 'Warga';
    if (nikEl) nikEl.innerText = `NIK: ${w.nik || '-'}`;
    if (alamatEl) alamatEl.innerText = w.alamat || 'Sidoarjo';
    if (avatarEl) avatarEl.innerText = (w.nama || 'W').charAt(0).toUpperCase();

    const isDisalurkan = w.status_salur === 'Disalurkan' || w.status_salur === 'Telah Menerima' || Boolean(w.bukti_salur);
    const badge = document.getElementById('buktiSalurStatusBadge');
    const konfBadge = document.getElementById('buktiSalurKonfirmasiBadge');

    if (badge) {
        if (w.status_salur === 'Telah Menerima') {
            badge.innerHTML = '<i class="fas fa-check-double text-blue-600"></i> Telah Menerima (Dikonfirmasi Warga)';
            badge.style.background = '#eff6ff';
            badge.style.color = '#1e40af';
            badge.style.borderColor = '#93c5fd';
        } else if (isDisalurkan) {
            badge.innerHTML = '<i class="fas fa-truck text-emerald-600"></i> Sudah Disalurkan (Menunggu Konfirmasi Warga)';
            badge.style.background = '#ecfdf5';
            badge.style.color = '#065f46';
            badge.style.borderColor = '#6ee7b7';
        } else {
            badge.innerHTML = '<i class="fas fa-clock text-amber-600"></i> Belum Disalurkan';
            badge.style.background = '#fffbeb';
            badge.style.color = '#b45309';
            badge.style.borderColor = '#fde68a';
        }
    }

    if (konfBadge) {
        if (w.konfirmasi_warga) {
            konfBadge.innerHTML = `<span class="badge" style="background:#dbeafe; color:#1e40af; font-size:0.7rem;"><i class="fas fa-user-check"></i> Warga Telah Konfirmasi (${w.waktu_konfirmasi_warga || 'Sah'})</span>`;
        } else if (w.status_salur === 'Disalurkan' || isDisalurkan) {
            konfBadge.innerHTML = `<span class="badge" style="background:#fef3c7; color:#b45309; font-size:0.7rem;"><i class="fas fa-hourglass-half"></i> Menunggu Konfirmasi Warga</span>`;
        } else {
            konfBadge.innerHTML = '';
        }
    }

    const previewBox = document.getElementById('buktiSalurPreviewBox');
    const previewImg = document.getElementById('buktiSalurImgPreview');
    const fileInp = document.getElementById('inputFotoBuktiSalur');
    if (fileInp) fileInp.value = '';

    if (w.bukti_salur) {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        if (previewImg) previewImg.src = `${base}/uploads/${w.bukti_salur}`;
        if (previewBox) previewBox.style.display = 'block';
    } else {
        if (previewBox) previewBox.style.display = 'none';
    }

    const ketInp = document.getElementById('inputKeteranganSalur');
    if (ketInp) {
        ketInp.value = w.keterangan_salur || `Bantuan sosial berupa ${w.nominal_bantuan || 'Beras 10 Kg dan BLT Tunai'} telah diserahkan langsung kepada ${w.nama} (NIK: ${w.nik}) di kantor balai desa pada kondisi baik.`;
    }

    const tglInp = document.getElementById('inputTanggalSalur');
    if (tglInp) {
        const d = new Date();
        const formatted = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} WIB`;
        tglInp.value = w.tanggal_salur && w.tanggal_salur !== '-' ? w.tanggal_salur : formatted;
    }

    const modal = document.getElementById('modalBuktiSalur');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

window.previewFotoBuktiSalur = function (inp) {
    if (inp.files && inp.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const previewBox = document.getElementById('buktiSalurPreviewBox');
            const previewImg = document.getElementById('buktiSalurImgPreview');
            if (previewImg) previewImg.src = e.target.result;
            if (previewBox) previewBox.style.display = 'block';
        };
        reader.readAsDataURL(inp.files[0]);
    }
};

window.hapusFotoBuktiSalur = function () {
    const fileInp = document.getElementById('inputFotoBuktiSalur');
    if (fileInp) fileInp.value = '';
    const previewBox = document.getElementById('buktiSalurPreviewBox');
    if (previewBox) previewBox.style.display = 'none';
};

window.simpanBuktiPenyaluranLengkap = async function () {
    const id = document.getElementById('buktiSalurWargaId')?.value;
    if (!id) return;

    const fileInp = document.getElementById('inputFotoBuktiSalur');
    const file = fileInp?.files?.[0];
    const keterangan = document.getElementById('inputKeteranganSalur')?.value.trim() || 'Bantuan bansos telah disalurkan.';
    const tanggalSalur = document.getElementById('inputTanggalSalur')?.value.trim() || '';

    const w = (window.globalDataWarga || []).find(item => String(item.id) === String(id));
    if (!file && (!w || !w.bukti_salur)) {
        return showAdminAlert({
            icon: 'warning',
            title: 'Foto Belum Dipilih',
            text: 'Silakan ambil foto bukti penyaluran atau pilih foto dokumentasi dari perangkat Anda.'
        });
    }

    showAdminAlert({
        title: 'Menyimpan Bukti Penyaluran...',
        text: 'Memproses dokumentasi serah terima dan memperbarui status menjadi Disalurkan...',
        didOpen: () => Swal?.showLoading()
    });

    try {
        const formData = new FormData();
        if (file) {
            formData.append('file', file);
        } else if (w?.bukti_salur) {
            formData.append('existing_file', w.bukti_salur);
        }
        formData.append('keterangan_salur', keterangan);
        formData.append('tanggal_salur', tanggalSalur);

        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        let res = await fetch(`${base}/api/warga/${id}/bukti-salur`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` },
            body: formData
        });

        if (!res.ok) {
            res = await fetch(`${base}/warga/${id}/bukti-salur`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` },
                body: formData
            });
        }

        window.closeModal('modalBuktiSalur');

        // Muat ulang data agar tabel dan kartu warga terupdate
        await window.loadDashboardData(false);

        Swal.fire({
            icon: 'success',
            title: 'Penyaluran Berhasil Dicatat!',
            html: `
                <div style="font-size:0.9rem; line-height:1.6; color:#1e293b;">
                    Status warga telah diperbarui menjadi <b>Disalurkan</b>.<br>
                    Tombol kamera telah berubah menjadi <b>tombol ceklis</b> dan keterangan sudah disalurkan tampil pada data warga.
                </div>
            `,
            buttonsStyling: false,
            confirmButtonText: 'Oke, Mengerti',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    } catch (err) {
        showAdminAlert({
            icon: 'error',
            title: 'Gagal Menyimpan',
            text: err.message || 'Terjadi gangguan saat menyimpan bukti penyaluran.'
        });
    }
};

window.bukaAksiCepatSengketa = function (id, namaWarga, nik) {
    const dataList = window.globalDataWarga || [];
    const w = dataList.find(item => item.id === id);
    const catatanSengketa = w?.catatan || 'Warga melaporkan kendala pada data penerimaan bansos.';

    showAdminAlert({
        title: '<i class="fas fa-shield-alt text-danger"></i> Mediasi Sengketa Bansos',
        html: `
            <div style="text-align:left; font-size:0.88rem; line-height:1.6; color:#1e293b;">
                <div style="background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:12px;">
                    <div><b>Warga:</b> ${window.safeHtml(namaWarga)} (NIK: ${nik})</div>
                    <div><b>Status Saat Ini:</b> <span style="color:#dc2626; font-weight:700;">${w?.status_salur || 'Sengketa'}</span></div>
                    <div style="margin-top:6px; font-size:0.82rem; color:#475569;"><b>Rincian Aduan:</b><br>${window.safeHtml(catatanSengketa)}</div>
                </div>
                <p style="margin:0; font-size:0.84rem; color:#334155;">Pilih tindakan penanganan untuk menyelesaikan sengketa ini:</p>
            </div>
        `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fas fa-check-circle"></i> Selesai (Bansos Diterima)',
        denyButtonText: '<i class="fas fa-sync-alt"></i> Verifikasi Ulang Kriteria (Sanggah Desil)',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#009846',
        denyButtonColor: '#0284c7'
    }).then(async (result) => {
        if (result.isConfirmed) {
            let res = await fetch(`${window.BASE_URL}/api/warga/${id}/lapor-sengketa`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ aksi: 'selesai' })
            });

            if (!res.ok) {
                await fetch(`${window.BASE_URL}/warga/${id}/lapor-sengketa`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${window.getCleanToken()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ aksi: 'selesai' })
                });
            }

            await window.loadDashboardData(false);
            showAdminAlert({ icon: 'success', title: 'Sengketa Selesai', text: `Status bantuan untuk ${namaWarga} telah diperbarui menjadi Telah Menerima.` });
        } else if (result.isDenied) {
            window.bukaModalEdit(id);
        }
    });
};

// =========================================================================
