/**
 * ============================================================================
 * MODUL TRANSPARANSI REKAPITULASI PENYALURAN 3 BULANAN (WARGA / PUBLIK REALTIME)
 * ============================================================================
 * Fitur Utama:
 * 1. Menampilkan laporan rekap penyaluran 3 bulanan (Triwulan I - IV) yang sudah
 *    diterbitkan (published) oleh Admin / Petugas / Superadmin secara realtime.
 * 2. Penjelajah Arsip Adaptif (>20 Tahun Ke Belakang hingga >20 Tahun Ke Depan,
 *    rentang 1900 - 2150) beserta 4 Triwulan per tahunnya.
 * 3. Active Highlighting pada setiap opsi yang diklik (Rentang, Tahun, Triwulan,
 *    Filter Kategori, dan Baris Warga).
 * 4. Sinkronisasi Realtime SSE ketika laporan baru diterbitkan atau data mutasi
 *    warga diperbarui otomatis.
 * 5. Unduhan Laporan Resmi (PDF, Word .doc, dan Excel .xlsx).
 */
(function () {
    'use strict';

    var stateRekapWarga = {
        report: null,
        daftarTahun: [],
        selectedTahun: 2026,
        selectedTriwulan: 'TW4',
        selectedRangeMode: 'around_now',
        activeFilter: 'ALL',
        selectedNikRow: null,
        publishedPeriods: [],
        verifiedIdentity: null,
        isIdentityVerified: false
    };

    function escapeHtml(val) {
        return String(val === undefined || val === null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeTriwulanKode(tw) {
        if (!tw) return 'TW4';
        var s = String(tw).toUpperCase().trim();
        if (s === '1' || s.indexOf('TW1') === 0) return 'TW1';
        if (s === '2' || s.indexOf('TW2') === 0) return 'TW2';
        if (s === '3' || s.indexOf('TW3') === 0) return 'TW3';
        if (s === '4' || s.indexOf('TW4') === 0) return 'TW4';
        return 'TW4';
    }

    function normalizeReportData(raw) {
        if (!raw) return null;
        var ring = raw.ringkasan || {};
        var twKode = normalizeTriwulanKode(raw.triwulan_kode || raw.triwulan_ke || raw.kode_periode);
        var items = Array.isArray(raw.items) ? raw.items.map(function (it) {
            var katUtama = String(it.kategori_utama || it.kategori_data || '').toLowerCase();
            var isBaru = katUtama === 'warga_baru' || String(it.kategori_data || '').toUpperCase() === 'DATA_BARU';
            var arah = String(it.arah_perubahan_desil || it.arah_desil || '').toLowerCase();
            var isTurun = arah.indexOf('turun') !== -1;
            var isNonaktif = arah.indexOf('henti') !== -1 || arah.indexOf('nonaktif') !== -1 || katUtama === 'meninggal' || katUtama === 'pindah_kota';
            var dLama = it.desil_lama_label || ('Desil ' + (it.desil_lama || '-'));
            var dBaru = it.desil_baru_label || (it.desil_baru === 0 ? 'Nonaktif' : ('Desil ' + (it.desil_baru || '-')));
            var rekom = it.rekomendasi_penyaluran || (it.status_bansos_baru ? (it.status_bansos_baru + ' (' + (it.status_salur_baru || 'Evaluasi') + ')') : 'Dievaluasi');
            var ringkasanPerubahan = it.ringkasan_perubahan || it.keterangan_desil_otomatis || it.catatan_perubahan || 'Evaluasi rutin 3 bulanan';

            return {
                nik: it.nik || '-',
                nama: it.nama || '-',
                email_warga: it.email_warga || '-',
                kategori_data: isBaru ? 'DATA_BARU' : 'DATA_LAMA',
                kategori_utama: katUtama,
                alamat_baru: it.alamat_baru || '-',
                kota_baru: it.kota_baru || 'Kabupaten Sidoarjo',
                kondisi_tempat_tinggal_baru: it.kondisi_tempat_tinggal_baru || it.tempat_tinggal_baru || '-',
                desil_lama_label: dLama,
                desil_baru_label: dBaru,
                arah_perubahan_desil: isTurun ? 'TURUN_DESIL_PRIORITAS_NAIK' : (isNonaktif ? 'NONAKTIF_MENINGGAL_ATAU_PINDAH' : 'TETAP_ATAU_NAIK'),
                ringkasan_perubahan: ringkasanPerubahan,
                rekomendasi_penyaluran: rekom,
                penyaluran_awal_periode: it.penyaluran_awal_periode || ('Triwulan I (Tahap 1) (Januari – Maret ' + (raw.tahun || 2026) + ')'),
                nominal_penyaluran_awal: Number(it.nominal_penyaluran_awal || 750000),
                nominal_penyaluran_awal_label: it.nominal_penyaluran_awal_label || 'Rp 750.000',
                bentuk_bantuan_awal: it.bentuk_bantuan_awal || 'Uang Tunai PKH/BLT (Bank Himbara) + Pangan Sembako (Beras 10 Kg)',
                penyaluran_akhir_periode: it.penyaluran_akhir_periode || ('Triwulan IV (Tahap 4) (Oktober – Desember ' + (raw.tahun || 2026) + ')'),
                nominal_penyaluran_akhir: typeof it.nominal_penyaluran_akhir === 'number' ? it.nominal_penyaluran_akhir : 750000,
                nominal_penyaluran_akhir_label: it.nominal_penyaluran_akhir_label || 'Rp 750.000',
                bentuk_bantuan_akhir: it.bentuk_bantuan_akhir || 'Uang Tunai PKH/BLT (Bank Himbara) + Pangan Sembako (Beras 10 Kg)',
                total_nominal_awal_sampai_akhir: Number(it.total_nominal_awal_sampai_akhir || 3000000),
                total_nominal_awal_sampai_akhir_label: it.total_nominal_awal_sampai_akhir_label || 'Rp 3.000.000',
                jenis_perubahan: Array.isArray(it.jenis_perubahan) ? it.jenis_perubahan : (Array.isArray(it.kategori_list) ? it.kategori_list : [katUtama])
            };
        }) : [];

        return {
            tahun: Number(raw.tahun || 2026),
            triwulan_kode: twKode,
            triwulan: raw.triwulan || raw.nama_triwulan || twKode,
            periode_label: raw.periode_label || raw.nama_periode || (twKode + ' ' + (raw.tahun || 2026)),
            is_published: raw.is_published !== false,
            published_at: raw.published_at || raw.waktu_rekap || '',
            published_by: raw.published_by || 'Dinas Sosial Kab. Sidoarjo',
            total_warga_dievaluasi: raw.total_warga_dievaluasi || raw.total_data_baru || items.length,
            total_data_lama: raw.total_data_lama || 0,
            total_data_baru_masuk: raw.total_data_baru_masuk !== undefined ? raw.total_data_baru_masuk : (ring.warga_baru !== undefined ? ring.warga_baru : Math.max(0, (raw.total_data_baru || 0) - (raw.total_data_lama || 0))),
            total_desil_diturunkan_prioritas_naik: raw.total_desil_diturunkan_prioritas_naik !== undefined ? raw.total_desil_diturunkan_prioritas_naik : (ring.desil_diturunkan_prioritas || 0),
            total_ekonomi_membaik: raw.total_ekonomi_membaik !== undefined ? raw.total_ekonomi_membaik : (ring.ekonomi_membaik || 0),
            total_berubah_alamat: raw.total_berubah_alamat !== undefined ? raw.total_berubah_alamat : ((ring.pindah_alamat || 0) + (ring.pindah_tempat_tinggal || 0)),
            total_pindah_kota: raw.total_pindah_kota !== undefined ? raw.total_pindah_kota : (ring.pindah_kota || 0),
            total_layak_salur_triwulan_ini: raw.total_layak_salur_triwulan_ini !== undefined ? raw.total_layak_salur_triwulan_ini : (ring.layak_penyaluran_triwulan || 0),
            items: items
        };
    }

    /**
     * Verifikasi Identitas Privasi Warga (Nama, NIK 16 Digit, & Alamat Email)
     */
    window.verifikasiIdentitasRekapWarga = async function (ev) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        var namaEl = document.getElementById('wargaRekapInputNama');
        var nikEl = document.getElementById('wargaRekapInputNik');
        var emailEl = document.getElementById('wargaRekapInputEmail');

        var nama = namaEl ? String(namaEl.value || '').trim() : '';
        var nik = nikEl ? String(nikEl.value || '').replace(/\D/g, '').trim() : '';
        var email = emailEl ? String(emailEl.value || '').trim() : '';

        if (!nama || nik.length < 8 || !email || email.indexOf('@') === -1) {
            if (window.Swal) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Identitas Belum Lengkap',
                    text: 'Silakan masukkan Nama Lengkap, NIK (16 Digit), dan Alamat Email yang valid untuk menampilkan data rekapitulasi 3 bulanan Anda.'
                });
            }
            return;
        }

        stateRekapWarga.verifiedIdentity = { nama: nama, nik: nik, email: email };
        await window.muatRekapPublikWarga(true);
    };

    window.isiCepatVerifikasiRekapWarga = function (nama, nik, email) {
        var namaEl = document.getElementById('wargaRekapInputNama');
        var nikEl = document.getElementById('wargaRekapInputNik');
        var emailEl = document.getElementById('wargaRekapInputEmail');
        if (namaEl) namaEl.value = nama || '';
        if (nikEl) nikEl.value = nik || '';
        if (emailEl) emailEl.value = email || '';
        window.verifikasiIdentitasRekapWarga(null);
    };

    window.resetVerifikasiRekapWarga = function () {
        stateRekapWarga.verifiedIdentity = null;
        stateRekapWarga.isIdentityVerified = false;
        var namaEl = document.getElementById('wargaRekapInputNama');
        var nikEl = document.getElementById('wargaRekapInputNik');
        var emailEl = document.getElementById('wargaRekapInputEmail');
        if (namaEl) namaEl.value = '';
        if (nikEl) nikEl.value = '';
        if (emailEl) emailEl.value = '';
        updateTampilanPrivasiRekapWarga(null);
    };

    function updateTampilanPrivasiRekapWarga(jsonResp) {
        var boxHasil = document.getElementById('wargaRekapHasilTerverifikasiBox');
        var boxNotice = document.getElementById('wargaRekapBelumVerifikasiNotice');
        var btnReset = document.getElementById('btnResetVerifikasiRekapWarga');
        var badgePrivasi = document.getElementById('wargaRekapStatusPrivasiBadge');
        var bannerIdentitas = document.getElementById('wargaRekapIdentitasTerverifikasiBanner');
        var exportBtns = document.getElementById('wargaRekapExportBtnsGroup');

        var isVerified = Boolean(
            stateRekapWarga.verifiedIdentity &&
            jsonResp &&
            jsonResp.identity_verified === true &&
            stateRekapWarga.report &&
            Array.isArray(stateRekapWarga.report.items) &&
            stateRekapWarga.report.items.length > 0
        );
        stateRekapWarga.isIdentityVerified = isVerified;

        if (isVerified) {
            var myItem = stateRekapWarga.report.items[0];
            if (boxHasil) boxHasil.style.display = 'block';
            if (boxNotice) boxNotice.style.display = 'none';
            if (btnReset) btnReset.style.display = 'inline-flex';
            if (exportBtns) exportBtns.style.display = 'flex';
            if (badgePrivasi) {
                badgePrivasi.style.background = '#dcfce7';
                badgePrivasi.style.color = '#166534';
                badgePrivasi.style.border = '1px solid #86efac';
                badgePrivasi.innerHTML = '<i class="fas fa-check-circle"></i> Identitas Terverifikasi: Hanya Menampilkan Data Anda';
            }
            if (bannerIdentitas && myItem) {
                bannerIdentitas.innerHTML =
                    '<div><i class="fas fa-user-check" style="color:#059669;"></i> Menampilkan Rekap 3 Bulanan Milik: <b>' +
                    escapeHtml(myItem.nama) + '</b> &bull; NIK: <b style="font-family:monospace;">' + escapeHtml(myItem.nik) +
                    '</b> &bull; Email: <b>' + escapeHtml(myItem.email_warga || stateRekapWarga.verifiedIdentity.email) + '</b></div>' +
                    '<span style="background:#ffffff; color:#047857; border:1px solid #6ee7b7; padding:3px 12px; border-radius:999px; font-size:0.72rem; font-weight:900; display:inline-flex; align-items:center; gap:5px;">' +
                    '<i class="fas fa-id-badge"></i> Data Warga' +
                    '</span>';
            }
        } else {
            if (boxHasil) boxHasil.style.display = 'none';
            if (boxNotice) boxNotice.style.display = 'block';
            if (btnReset) btnReset.style.display = 'none';
            if (exportBtns) exportBtns.style.display = 'none';
            if (badgePrivasi) {
                badgePrivasi.style.background = '#fef3c7';
                badgePrivasi.style.color = '#b45309';
                badgePrivasi.style.border = '1px solid #fde68a';
                badgePrivasi.innerHTML = '<i class="fas fa-lock"></i> Privasi Aktif: Masukkan Nama, NIK &amp; Email';
            }
        }
    }

    /**
     * Memuat laporan rekap 3 bulanan yang telah diterbitkan untuk Warga
     */
    window.muatRekapPublikWarga = async function (showToast) {
        try {
            var twNum = String(stateRekapWarga.selectedTriwulan || 'TW4').replace(/\D/g, '') || '4';
            var url = '/api/rekap-penyaluran/publik?tahun=' + encodeURIComponent(stateRekapWarga.selectedTahun) +
                      '&triwulan=' + encodeURIComponent(twNum) +
                      '&custom_year=' + encodeURIComponent(stateRekapWarga.selectedTahun);
            if (stateRekapWarga.verifiedIdentity) {
                url += '&nama=' + encodeURIComponent(stateRekapWarga.verifiedIdentity.nama) +
                       '&nik=' + encodeURIComponent(stateRekapWarga.verifiedIdentity.nik) +
                       '&email=' + encodeURIComponent(stateRekapWarga.verifiedIdentity.email);
            }
            var res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            var json = await res.json();
            if (!json || (json.status !== 'success' && !json.sukses)) return;

            var arrTahun = json.daftar_tahun_adaptif || json.daftar_tahun_20_tahun || json.daftar_tahun_20;
            if (Array.isArray(arrTahun) && arrTahun.length > 0) {
                stateRekapWarga.daftarTahun = arrTahun;
            }
            if (Array.isArray(json.published_periods)) {
                stateRekapWarga.publishedPeriods = json.published_periods;
            }
            var rawReport = json.rekap_publik || json.data || json.rekap_aktif;
            if (rawReport) {
                stateRekapWarga.report = normalizeReportData(rawReport);
                if (stateRekapWarga.report.tahun) stateRekapWarga.selectedTahun = Number(stateRekapWarga.report.tahun);
                if (stateRekapWarga.report.triwulan_kode) stateRekapWarga.selectedTriwulan = String(stateRekapWarga.report.triwulan_kode);
            }

            if (stateRekapWarga.verifiedIdentity && json.identity_verified === false) {
                updateTampilanPrivasiRekapWarga(json);
                if (window.Swal) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Data Tidak Ditemukan / Tidak Cocok',
                        text: json.verification_message || 'Kombinasi Nama Lengkap, NIK, dan Alamat Email yang Anda masukkan tidak ditemukan dalam data rekapitulasi 3 bulanan.'
                    });
                }
                return;
            }

            updateTampilanPrivasiRekapWarga(json);
            renderPenjelajahTahunWarga();
            renderRingkasanRekapWarga();
            window.renderTabelRekapPublikWarga();
            sinkronkanKartuDashboardPribadiWarga();

            if (showToast && stateRekapWarga.isIdentityVerified && window.Swal) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Data Rekap 3 Bulanan Anda berhasil diverifikasi & ditampilkan',
                    showConfirmButton: false,
                    timer: 2200
                });
            }
        } catch (err) {
            console.warn('[RekapPublikWarga] Gagal memuat rekap:', err);
        }
    };

    /**
     * Render Penjelajah Tahun Adaptif (>20 Tahun Ke Belakang & >20 Tahun Ke Depan) + 4 Triwulan
     */
    function renderPenjelajahTahunWarga() {
        var r = stateRekapWarga.report;
        var tahunAktif = Number(stateRekapWarga.selectedTahun || 2026);
        var twAktif = normalizeTriwulanKode(stateRekapWarga.selectedTriwulan);
        var currentYear = 2026;

        // Pastikan tahun aktif ada di daftarTahun
        var exists = stateRekapWarga.daftarTahun.some(function (t) { return Number(t.tahun) === tahunAktif; });
        if (!exists) {
            stateRekapWarga.daftarTahun.push({
                tahun: tahunAktif,
                label: 'Tahun ' + tahunAktif,
                is_current_year: tahunAktif === currentYear,
                is_future_year: tahunAktif > currentYear
            });
            stateRekapWarga.daftarTahun.sort(function (a, b) { return Number(a.tahun) - Number(b.tahun); });
        }

        // Update badge aktif
        var badgeEl = document.getElementById('wargaBadgeAktifTahunTriwulan');
        if (badgeEl) {
            var twNama = r && r.triwulan ? r.triwulan : twAktif;
            var statusPub = (r && r.is_published !== false) ? 'DITERBITKAN RESMI' : 'ARSIP TERBUKA';
            badgeEl.innerHTML = '<i class="fas fa-check-circle"></i> Sedang Melihat: <b>Tahun ' + tahunAktif + ' • ' + escapeHtml(twNama) + '</b> (' + statusPub + ')';
        }

        var pubInfoEl = document.getElementById('wargaInfoPublishedAt');
        if (pubInfoEl && r) {
            pubInfoEl.innerHTML = '<i class="fas fa-broadcast-tower" style="color:#10b981;"></i> Diterbitkan oleh: <b>' +
                escapeHtml(r.published_by || 'Dinas Sosial Kab. Sidoarjo') + '</b>';
        }

        var jumpInput = document.getElementById('wargaInputLoncatTahun');
        if (jumpInput && document.activeElement !== jumpInput) {
            jumpInput.value = String(tahunAktif);
        }

        // Highlight tab rentang adaptif
        var rangeBtns = document.querySelectorAll('#wargaBarRentangAdaptif .btn-rentang-warga');
        for (var i = 0; i < rangeBtns.length; i++) {
            var btn = rangeBtns[i];
            var isAct = btn.getAttribute('data-range') === stateRekapWarga.selectedRangeMode;
            if (isAct) {
                btn.classList.add('active');
                btn.style.background = '#0284c7';
                btn.style.color = '#ffffff';
                btn.style.border = '1.5px solid #0369a1';
                btn.style.boxShadow = '0 0 0 2px #bae6fd';
            } else {
                btn.classList.remove('active');
                btn.style.background = '#ffffff';
                btn.style.color = '#475569';
                btn.style.border = '1px solid #cbd5e1';
                btn.style.boxShadow = 'none';
            }
        }

        // Filter daftar tahun sesuai mode rentang adaptif
        var filteredYears = stateRekapWarga.daftarTahun.filter(function (item) {
            var y = Number(item.tahun);
            if (y === tahunAktif) return true;
            var mode = stateRekapWarga.selectedRangeMode;
            if (mode === 'past_deep') return y < currentYear - 15;
            if (mode === 'past_20') return y >= currentYear - 20 && y <= currentYear;
            if (mode === 'around_now') return y >= currentYear - 10 && y <= currentYear + 10;
            if (mode === 'future_20') return y >= currentYear && y <= currentYear + 20;
            if (mode === 'future_deep') return y > currentYear + 15;
            return true;
        });

        var tahunCont = document.getElementById('wargaDaftarTahunContainer');
        if (tahunCont) {
            tahunCont.innerHTML = filteredYears.map(function (item) {
                var isSelected = Number(item.tahun) === tahunAktif;
                var bg = isSelected
                    ? 'linear-gradient(135deg, #0284c7, #1d4ed8)'
                    : (item.tahun > currentYear ? '#f5f3ff' : '#ffffff');
                var color = isSelected ? '#ffffff' : (item.tahun > currentYear ? '#6d28d9' : '#334155');
                var border = isSelected ? '2px solid #38bdf8' : '1px solid #cbd5e1';
                var shadow = isSelected ? '0 4px 12px rgba(2,132,199,0.28)' : 'none';
                var tag = isSelected ? ' • AKTIF' : (item.tahun === currentYear ? ' • Kini' : '');
                return '<button type="button" onclick="window.pilihTahunTriwulanWarga(' + item.tahun + ', \'' + twAktif + '\')" ' +
                    'style="flex:0 0 auto; background:' + bg + '; color:' + color + '; border:' + border + '; box-shadow:' + shadow + '; ' +
                    'border-radius:10px; padding:6px 12px; font-size:0.75rem; font-weight:' + (isSelected ? '900' : '700') + '; cursor:pointer;">' +
                    (isSelected ? '<i class="fas fa-check-circle"></i> ' : '') + item.tahun + tag +
                    '</button>';
            }).join('');
        }

        // Render 4 kartu Triwulan
        var twCont = document.getElementById('wargaDaftarTriwulanContainer');
        if (twCont) {
            var twDefs = [
                { kode: 'TW1', nama: 'Triwulan I (Jan - Mar)', rentang: 'Januari - Maret ' + tahunAktif },
                { kode: 'TW2', nama: 'Triwulan II (Apr - Jun)', rentang: 'April - Juni ' + tahunAktif },
                { kode: 'TW3', nama: 'Triwulan III (Jul - Sep)', rentang: 'Juli - September ' + tahunAktif },
                { kode: 'TW4', nama: 'Triwulan IV (Okt - Des)', rentang: 'Oktober - Desember ' + tahunAktif }
            ];
            twCont.innerHTML = twDefs.map(function (tw) {
                var isSelected = tw.kode === twAktif;
                var bg = isSelected ? 'linear-gradient(135deg, #047857, #0284c7)' : '#ffffff';
                var color = isSelected ? '#ffffff' : '#0f172a';
                var subColor = isSelected ? '#e0f2fe' : '#64748b';
                var border = isSelected ? '2px solid #34d399' : '1.5px solid #cbd5e1';
                var shadow = isSelected ? '0 6px 16px rgba(4,120,87,0.22)' : 'none';
                return '<button type="button" onclick="window.pilihTahunTriwulanWarga(' + tahunAktif + ', \'' + tw.kode + '\')" ' +
                    'style="text-align:left; background:' + bg + '; color:' + color + '; border:' + border + '; box-shadow:' + shadow + '; ' +
                    'border-radius:12px; padding:10px 12px; cursor:pointer; transition:all 0.18s;">' +
                    '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">' +
                        '<span style="font-size:0.78rem; font-weight:900;">' + escapeHtml(tw.nama) + '</span>' +
                        (isSelected ? '<span style="background:rgba(255,255,255,0.22); padding:2px 7px; border-radius:999px; font-size:0.65rem; font-weight:900;">AKTIF</span>' : '') +
                    '</div>' +
                    '<div style="font-size:0.7rem; color:' + subColor + '; font-weight:700;">' + escapeHtml(tw.rentang) + '</div>' +
                '</button>';
            }).join('');
        }
    }

    /**
     * Pilih Tahun & Triwulan pada Portal Warga
     */
    window.pilihTahunTriwulanWarga = function (tahun, triwulanKode) {
        var y = Number(tahun);
        if (!isFinite(y) || y < 1900 || y > 2150) return;
        stateRekapWarga.selectedTahun = y;
        if (triwulanKode) stateRekapWarga.selectedTriwulan = normalizeTriwulanKode(triwulanKode);
        window.muatRekapPublikWarga(false);
    };

    window.pilihRentangTahunWarga = function (mode) {
        stateRekapWarga.selectedRangeMode = mode || 'around_now';
        var currentYear = 2026;
        if (mode === 'past_deep' && stateRekapWarga.selectedTahun >= currentYear - 15) {
            stateRekapWarga.selectedTahun = 1998;
            window.muatRekapPublikWarga(false);
            return;
        }
        if (mode === 'future_deep' && stateRekapWarga.selectedTahun <= currentYear + 15) {
            stateRekapWarga.selectedTahun = 2050;
            window.muatRekapPublikWarga(false);
            return;
        }
        renderPenjelajahTahunWarga();
    };

    window.navigasiTahunRekapWarga = function (delta) {
        if (delta === 0) {
            stateRekapWarga.selectedTahun = 2026;
            stateRekapWarga.selectedTriwulan = 'TW4';
            stateRekapWarga.selectedRangeMode = 'around_now';
        } else {
            var target = Number(stateRekapWarga.selectedTahun || 2026) + Number(delta);
            if (target < 1900) target = 1900;
            if (target > 2150) target = 2150;
            stateRekapWarga.selectedTahun = target;
            stateRekapWarga.selectedRangeMode = 'all';
        }
        window.muatRekapPublikWarga(false);
    };

    window.loncatKeTahunRekapWarga = function () {
        var inp = document.getElementById('wargaInputLoncatTahun');
        if (!inp) return;
        var y = parseInt(inp.value, 10);
        if (!isFinite(y) || y < 1900 || y > 2150) return;
        stateRekapWarga.selectedTahun = y;
        stateRekapWarga.selectedRangeMode = 'all';
        window.muatRekapPublikWarga(false);
    };

    /**
     * Render Kartu Statistik Ringkas
     */
    function renderRingkasanRekapWarga() {
        var grid = document.getElementById('wargaRekapSummaryGrid');
        var r = stateRekapWarga.report;
        if (!grid || !r) return;

        var myItem = (Array.isArray(r.items) && r.items.length > 0) ? r.items[0] : null;
        var cards = myItem ? [
            { label: 'Penyaluran Awal (Tahap I)', val: myItem.nominal_penyaluran_awal_label || 'Rp 750.000', color: '#0284c7', bg: '#f0f9ff', icon: 'fa-play-circle' },
            { label: 'Penyaluran Akhir (Tahap IV)', val: myItem.nominal_penyaluran_akhir_label || 'Rp 750.000', color: '#047857', bg: '#ecfdf5', icon: 'fa-flag-checkered' },
            { label: 'Total Akumulasi (Tahap I–IV)', val: myItem.total_nominal_awal_sampai_akhir_label || 'Rp 3.000.000', color: '#1d4ed8', bg: '#eff6ff', icon: 'fa-coins' },
            { label: 'Perubahan Desil Anda', val: (myItem.desil_lama_label || '-') + ' → ' + (myItem.desil_baru_label || '-'), color: '#b45309', bg: '#fffbeb', icon: 'fa-exchange-alt' },
            { label: 'Kota / Domisili', val: myItem.kota_baru || 'Sidoarjo', color: '#7c3aed', bg: '#f5f3ff', icon: 'fa-map-marker-alt' },
            { label: 'Keputusan Triwulan', val: (myItem.nominal_penyaluran_akhir > 0 ? 'Layak Salur' : 'Dihentikan'), color: '#059669', bg: '#d1fae5', icon: 'fa-check-double' }
        ] : [
            { label: 'Status Privasi Data', val: 'Wajib Verifikasi', color: '#0284c7', bg: '#f0f9ff', icon: 'fa-user-shield' }
        ];

        grid.innerHTML = cards.map(function (c) {
            return '<div style="background:' + c.bg + '; border:1px solid #cbd5e1; border-radius:12px; padding:10px 12px;">' +
                '<div style="font-size:0.68rem; font-weight:800; color:#475569; margin-bottom:4px;"><i class="fas ' + c.icon + '" style="color:' + c.color + ';"></i> ' + escapeHtml(c.label) + '</div>' +
                '<div style="font-size:1.02rem; font-weight:900; color:' + c.color + ';">' + escapeHtml(c.val) + '</div>' +
            '</div>';
        }).join('');
    }

    /**
     * Filter Kategori & Render Tabel Rekap Warga dengan Active Row Highlight
     */
    window.filterTabelRekapWarga = function (kategori, btnEl) {
        stateRekapWarga.activeFilter = kategori || 'ALL';
        var btns = document.querySelectorAll('#wargaRekapFilterBar .btn-filter-rekap-warga');
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            var isAct = b === btnEl || b.getAttribute('data-filter') === stateRekapWarga.activeFilter;
            if (isAct) {
                b.classList.add('active');
                b.style.background = '#0f172a';
                b.style.color = '#ffffff';
                b.style.border = '1.5px solid #0f172a';
            } else {
                b.classList.remove('active');
                b.style.background = '#f8fafc';
                b.style.color = '#334155';
                b.style.border = '1px solid #cbd5e1';
            }
        }
        window.renderTabelRekapPublikWarga();
    };

    window.pilihBarisRekapWarga = function (nik) {
        stateRekapWarga.selectedNikRow = (stateRekapWarga.selectedNikRow === nik) ? null : nik;
        window.renderTabelRekapPublikWarga();
    };

    window.renderTabelRekapPublikWarga = function () {
        var tbody = document.getElementById('tbodyRekapPublikWarga');
        if (!tbody) return;
        var r = stateRekapWarga.report;
        var items = (r && Array.isArray(r.items)) ? r.items : [];
        var qEl = document.getElementById('wargaCariRekapInput');
        var q = qEl ? String(qEl.value || '').trim().toLowerCase() : '';
        var filter = stateRekapWarga.activeFilter || 'ALL';

        var filtered = items.filter(function (it) {
            if (q) {
                var hay = (it.nik + ' ' + it.nama + ' ' + it.alamat_baru + ' ' + it.kota_baru + ' ' + it.ringkasan_perubahan).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            var jp = (it.jenis_perubahan || []).map(function (x) { return String(x).toUpperCase(); });
            if (filter === 'DATA_BARU') return it.kategori_data === 'DATA_BARU';
            if (filter === 'DESIL_TURUN') return it.arah_perubahan_desil === 'TURUN_DESIL_PRIORITAS_NAIK';
            if (filter === 'EKONOMI_MEMBAIK') return jp.indexOf('EKONOMI_MEMBAIK') !== -1;
            if (filter === 'MUTASI_TEMPAT') {
                return jp.indexOf('BERUBAH_ALAMAT') !== -1 || jp.indexOf('PINDAH_ALAMAT') !== -1 ||
                       jp.indexOf('BERUBAH_TEMPAT_TINGGAL') !== -1 || jp.indexOf('PINDAH_TEMPAT_TINGGAL') !== -1 ||
                       jp.indexOf('PINDAH_KOTA') !== -1;
            }
            if (filter === 'MENINGGAL') return jp.indexOf('MENINGGAL_DUNIA') !== -1 || jp.indexOf('MENINGGAL') !== -1;
            return true;
        });

        var bannerEl = document.getElementById('wargaRekapSelectedBanner');
        if (bannerEl) {
            var selObj = items.find(function (x) { return x.nik === stateRekapWarga.selectedNikRow; });
            if (selObj) {
                bannerEl.style.display = 'block';
                bannerEl.innerHTML = '<i class="fas fa-highlighter"></i> Sedang Menyorot Data Warga: <b>' +
                    escapeHtml(selObj.nama) + ' (NIK: ' + escapeHtml(selObj.nik) + ')</b> — ' +
                    escapeHtml(selObj.desil_lama_label) + ' &rarr; <b>' + escapeHtml(selObj.desil_baru_label) + '</b> (' +
                    escapeHtml(selObj.rekomendasi_penyaluran) + ')';
            } else {
                bannerEl.style.display = 'none';
            }
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color:#64748b; font-weight:700;">Tidak ada data warga yang cocok dengan filter pencarian.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(function (it, idx) {
            var isSelected = stateRekapWarga.selectedNikRow === it.nik;
            var rowBg = isSelected ? '#ecfdf5' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc');
            var borderLeft = isSelected ? '4px solid #10b981' : '4px solid transparent';

            var desilBadgeBg = '#e0f2fe';
            var desilBadgeColor = '#0369a1';
            if (it.arah_perubahan_desil === 'TURUN_DESIL_PRIORITAS_NAIK') {
                desilBadgeBg = '#fef3c7';
                desilBadgeColor = '#b45309';
            } else if (it.arah_perubahan_desil === 'NONAKTIF_MENINGGAL_ATAU_PINDAH') {
                desilBadgeBg = '#fee2e2';
                desilBadgeColor = '#b91c1c';
            }

            return '<tr onclick="window.pilihBarisRekapWarga(\'' + escapeHtml(it.nik) + '\')" ' +
                'style="background:' + rowBg + '; border-bottom:1px solid #e2e8f0; border-left:' + borderLeft + '; cursor:pointer;">' +
                '<td style="padding:9px 8px; text-align:center; font-weight:800;">' + (idx + 1) + '</td>' +
                '<td style="padding:9px 8px;">' +
                    '<div style="font-weight:900; color:#0f172a;">' + escapeHtml(it.nama) + (isSelected ? ' <span style="background:#10b981; color:#fff; font-size:0.63rem; padding:1px 6px; border-radius:999px;">DISOROT</span>' : '') + '</div>' +
                    '<div style="font-size:0.72rem; color:#1d4ed8; font-family:monospace; font-weight:800;">NIK: ' + escapeHtml(it.nik) + '</div>' +
                    '<div style="font-size:0.69rem; color:#475569; font-weight:700;"><i class="fas fa-envelope" style="color:#6366f1;"></i> ' + escapeHtml(it.email_warga || (stateRekapWarga.verifiedIdentity && stateRekapWarga.verifiedIdentity.email) || '-') + '</div>' +
                '</td>' +
                '<td style="padding:9px 8px;">' +
                    '<span style="display:inline-block; font-size:0.68rem; font-weight:800; padding:2px 8px; border-radius:999px; background:' + (it.kategori_data === 'DATA_BARU' ? '#dcfce7' : '#e0f2fe') + '; color:' + (it.kategori_data === 'DATA_BARU' ? '#166534' : '#0369a1') + '; margin-bottom:3px;">' +
                        escapeHtml(it.kategori_data) +
                    '</span>' +
                    '<div style="font-size:0.72rem; color:#334155;">' + escapeHtml(it.ringkasan_perubahan) + '</div>' +
                '</td>' +
                '<td style="padding:9px 8px; font-size:0.73rem; color:#334155;">' +
                    '<div><b>' + escapeHtml(it.alamat_baru) + '</b> (' + escapeHtml(it.kota_baru) + ')</div>' +
                    '<div style="font-size:0.68rem; color:#64748b;">Hunian: ' + escapeHtml(it.kondisi_tempat_tinggal_baru) + '</div>' +
                '</td>' +
                '<td style="padding:9px 8px; text-align:center;">' +
                    '<span style="display:inline-block; background:' + desilBadgeBg + '; color:' + desilBadgeColor + '; padding:4px 9px; border-radius:8px; font-size:0.72rem; font-weight:900;">' +
                        escapeHtml(it.desil_lama_label) + ' &rarr; ' + escapeHtml(it.desil_baru_label) +
                    '</span>' +
                '</td>' +
                '<td style="padding:9px 8px; font-size:0.72rem; color:#0f172a;">' +
                    '<div style="font-weight:900; color:#047857; margin-bottom:4px;">' + escapeHtml(it.rekomendasi_penyaluran) + '</div>' +
                    '<div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:6px 8px; line-height:1.38;">' +
                        '<div><b style="color:#0369a1;">Penyaluran Awal:</b> <b>' + escapeHtml(it.nominal_penyaluran_awal_label) + '</b> (' + escapeHtml(it.penyaluran_awal_periode) + ')</div>' +
                        '<div><b style="color:#15803d;">Penyaluran Akhir:</b> <b>' + escapeHtml(it.nominal_penyaluran_akhir_label) + '</b> (' + escapeHtml(it.penyaluran_akhir_periode) + ')</div>' +
                        '<div style="margin-top:2px; padding-top:2px; border-top:1px dashed #cbd5e1;"><b style="color:#1e3a8a;">Total Akumulasi (Tahap I–IV): ' + escapeHtml(it.total_nominal_awal_sampai_akhir_label) + '</b></div>' +
                        '<div style="font-size:0.68rem; color:#475569; margin-top:2px;"><i class="fas fa-box-open" style="color:#d97706;"></i> Bentuk: <b>' + escapeHtml(it.nominal_penyaluran_akhir > 0 ? it.bentuk_bantuan_akhir : (it.bentuk_bantuan_awal || it.bentuk_bantuan_akhir)) + '</b></div>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        }).join('');
    };

    /**
     * Sinkronkan Kartu Rekap 3 Bulanan di dalam Dashboard Pribadi Warga
     */
    function sinkronkanKartuDashboardPribadiWarga() {
        var r = stateRekapWarga.report;
        if (!r) return;
        var badgeEl = document.getElementById('dashWargaRekapPeriodeBadge');
        if (badgeEl) {
            badgeEl.textContent = (r.triwulan_kode || 'TW4') + ' • ' + (r.tahun || 2026);
        }
        var txtEl = document.getElementById('dashWargaRekapRingkasanText');
        if (txtEl) {
            var activeNik = window.currentWargaNik || localStorage.getItem('warga_nik') || '';
            var myItem = activeNik && Array.isArray(r.items)
                ? r.items.find(function (x) { return String(x.nik) === String(activeNik); })
                : null;
            if (myItem) {
                txtEl.innerHTML = 'Status Anda pada <b>' + escapeHtml(r.periode_label) + '</b>: <b>' +
                    escapeHtml(myItem.desil_lama_label) + ' &rarr; ' + escapeHtml(myItem.desil_baru_label) +
                    '</b> (' + escapeHtml(myItem.rekomendasi_penyaluran) + ').';
            } else {
                txtEl.innerHTML = 'Laporan <b>' + escapeHtml(r.periode_label) + '</b> telah diterbitkan secara realtime: <b>' +
                    (r.total_layak_salur_triwulan_ini || 0) + ' KPM Layak Salur</b> dari ' +
                    (r.total_warga_dievaluasi || 0) + ' KPM dievaluasi.';
            }
        }
    }

    /**
     * Buka Tab Rekap 3 Bulanan langsung dari tombol di Dashboard Pribadi Warga
     */
    window.bukaRekapPublikDariDashboardWarga = function () {
        var dashSec = document.getElementById('dashboardWargaSection');
        if (dashSec) dashSec.style.display = 'none';
        var landing = document.getElementById('landingView');
        if (landing) landing.style.display = 'block';
        var btn = document.getElementById('btn-rekap-publik');
        if (typeof window.switchTabPublik === 'function') {
            window.switchTabPublik('rekapPublikSection', btn);
        }
    };

    /**
     * Unduh Laporan Rekapitulasi 3 Bulanan pada Portal Warga (PDF, Word, Excel)
     */
    window.unduhRekapPublikWarga = function (format) {
        var r = stateRekapWarga.report;
        if (!r || !Array.isArray(r.items) || r.items.length === 0) return;

        if (format === 'excel' && typeof window.XLSX !== 'undefined') {
            var rows = r.items.map(function (it, idx) {
                return {
                    'No': idx + 1,
                    'NIK': it.nik,
                    'Nama KPM': it.nama,
                    'Email Warga': it.email_warga,
                    'Kategori Data': it.kategori_data,
                    'Alamat Terbaru': it.alamat_baru,
                    'Kota': it.kota_baru,
                    'Desil Lama': it.desil_lama_label,
                    'Desil Terbaru': it.desil_baru_label,
                    'Penyaluran Awal (Periode)': it.penyaluran_awal_periode,
                    'Nominal Penyaluran Awal': it.nominal_penyaluran_awal_label,
                    'Penyaluran Akhir (Periode)': it.penyaluran_akhir_periode,
                    'Nominal Penyaluran Akhir': it.nominal_penyaluran_akhir_label,
                    'Total Akumulasi (Tahap I-IV)': it.total_nominal_awal_sampai_akhir_label,
                    'Bentuk Bantuan': it.nominal_penyaluran_akhir > 0 ? it.bentuk_bantuan_akhir : (it.bentuk_bantuan_awal || it.bentuk_bantuan_akhir),
                    'Ringkasan Evaluasi': it.ringkasan_perubahan,
                    'Rekomendasi Penyaluran Triwulan': it.rekomendasi_penyaluran
                };
            });
            var ws = window.XLSX.utils.json_to_sheet(rows);
            var wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, 'Rekap_' + r.triwulan_kode + '_' + r.tahun);
            window.XLSX.writeFile(wb, 'Rekap_Penyaluran_' + r.triwulan_kode + '_' + r.tahun + '_Warga.xlsx');
            return;
        }

        var htmlDoc = '<html><head><meta charset="utf-8"><title>Laporan Rekap Penyaluran ' + escapeHtml(r.periode_label) + '</title>' +
            '<style>body{font-family:Times New Roman,serif;padding:24px;color:#0f172a;}table{width:100%;border-collapse:collapse;margin-top:14px;font-size:11px;}th,td{border:1px solid #334155;padding:6px;}th{background:#e2e8f0;}</style></head><body>' +
            '<h2 style="text-align:center;margin:0;">PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL</h2>' +
            '<h3 style="text-align:center;margin:4px 0 12px 0;">LAPORAN RESMI REKAPITULASI PENYALURAN 3 BULANAN PRIBADI WARGA (' + escapeHtml(r.periode_label) + ')</h3>' +
            '<table><thead><tr><th>No</th><th>NIK, Nama &amp; Email KPM</th><th>Kategori</th><th>Alamat</th><th>Perubahan Desil</th><th>Penyaluran Awal s/d Akhir (Nominal &amp; Bentuk Bantuan)</th></tr></thead><tbody>' +
            r.items.map(function (it, i) {
                return '<tr><td>' + (i + 1) + '</td><td><b>' + escapeHtml(it.nama) + '</b><br>NIK: ' + escapeHtml(it.nik) + '<br>Email: ' + escapeHtml(it.email_warga) + '</td><td>' + escapeHtml(it.kategori_data) + '</td><td>' + escapeHtml(it.alamat_baru) + '</td><td>' + escapeHtml(it.desil_lama_label) + ' &rarr; ' + escapeHtml(it.desil_baru_label) + '</td><td><b>' + escapeHtml(it.rekomendasi_penyaluran) + '</b><br>Awal: ' + escapeHtml(it.nominal_penyaluran_awal_label) + '<br>Akhir: ' + escapeHtml(it.nominal_penyaluran_akhir_label) + '<br>Total: <b>' + escapeHtml(it.total_nominal_awal_sampai_akhir_label) + '</b><br>Bentuk: ' + escapeHtml(it.nominal_penyaluran_akhir > 0 ? it.bentuk_bantuan_akhir : (it.bentuk_bantuan_awal || it.bentuk_bantuan_akhir)) + '</td></tr>';
            }).join('') +
            '</tbody></table></body></html>';

        if (format === 'word') {
            var blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword;charset=utf-8' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'Laporan_Rekap_' + r.triwulan_kode + '_' + r.tahun + '_Publik.doc';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
        }

        // Default PDF Print
        var w = window.open('', '_blank');
        if (w) {
            w.document.open();
            w.document.write(htmlDoc);
            w.document.close();
            setTimeout(function () { w.print(); }, 350);
        }
    };

    /**
     * Pasang Pendengar Realtime SSE agar Warga langsung melihat laporan yang baru diterbitkan
     */
    function initRealtimeListenerRekapWarga() {
        try {
            var es = new EventSource('/api/realtime/stream');
            es.onmessage = function (ev) {
                try {
                    var msg = JSON.parse(ev.data);
                    if (!msg) return;
                    var evtName = msg.event || msg.type || '';
                    if (evtName === 'REKAP_TRIWULAN_PUBLISHED' || evtName === 'WARGA_REKAP_UPDATED') {
                        var payload = msg.payload || msg.data || {};
                        if (payload.tahun) stateRekapWarga.selectedTahun = Number(payload.tahun);
                        if (payload.triwulan_kode || payload.triwulan_ke) {
                            stateRekapWarga.selectedTriwulan = normalizeTriwulanKode(payload.triwulan_kode || payload.triwulan_ke);
                        }
                        window.muatRekapPublikWarga(false);
                        var liveBadge = document.getElementById('wargaRekapLiveBadgeText');
                        if (liveBadge) {
                            liveBadge.textContent = 'BARU DITERBITKAN REALTIME • ' + (payload.periode_label || payload.nama_periode || 'PENYALURAN 3 BULANAN');
                        }
                    }
                } catch (_e) {}
            };
        } catch (_err) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            window.muatRekapPublikWarga(false);
            initRealtimeListenerRekapWarga();
        });
    } else {
        window.muatRekapPublikWarga(false);
        initRealtimeListenerRekapWarga();
    }
})();
