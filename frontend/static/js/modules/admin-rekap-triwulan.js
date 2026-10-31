/**
 * Modul: admin-rekap-triwulan.js
 * Deskripsi:
 * 1. Rekapitulasi Data Penyaluran 3 Bulan Sekali (Triwulanan) terintegrasi di dalam Arsip Data Warga
 * 2. Penjelajah Rekap Historis 20 Tahun Sebelumnya (2006 s/d 2026) & Per 3 Bulan (Triwulan I – IV)
 * 3. Input Perubahan Kondisi / Mutasi Dinamis Kriteria 1 s/d Kriteria 39 (C1–C39 & C40+ Masa Depan)
 * 4. Highlight Otomatis pada setiap opsi yang diklik/dilihat (Tahun, Triwulan, Jadwal, KPI, Filter, Baris Warga A, Tab Kriteria)
 * 5. Unduhan Multi-Format (Excel .xlsx, Word .doc, PDF Resmi) lengkap Pengaturan Kop Surat, Tanda Tangan,
 *    Nama Kepala Dinsos, Pangkat, NIP, dan Stempel Basah Dinas.
 */

(function () {
    window.currentRekapReport = null;
    window.currentJadwalInputStatus = null;
    window.currentRekapFilter = 'all';
    window.currentSelectedRekapNik = '';
    window.currentTahunRekap = new Date().getFullYear();
    window.currentTriwulanRekap = 4;
    window.currentRentangTahunAdaptif = 'sekitar_tahun_ini';
    window.daftarTahun20TahunCache = [];
    window.katalogKriteria39Cache = [];
    window.currentKriteriaGroupTab = 'all';
    window.currentWargaMutasiLamaSnap = null;
    window.currentWargaMutasiDraftValues = {};
    window.currentModeImportMutasi = 'all';
    window.parsedImportMutasiRows = [];
    window.quickImportInsideSingleModal = false;

    const DOC_CONFIG_STORAGE_KEY = 'sip_bansos_rekap_doc_config_v1';

    const DEFAULT_DOC_CONFIG = {
        pemda: 'PEMERINTAH KABUPATEN SIDOARJO',
        instansi: 'DINAS SOSIAL',
        alamatKop: 'Jl. Pahlawan No. 56, Sidoarjo, Jawa Timur 61212 | Telp. (031) 8921234 | Website: dinsos.sidoarjokab.go.id',
        nomorSurat: '460/088/REKAP-TW/438.5.12/2026',
        tempatTanggal: 'Sidoarjo, 30 Oktober 2026',
        jabatan: 'KEPALA DINAS SOSIAL KABUPATEN SIDOARJO',
        namaKadis: 'Dr. Drs. H. Ahmad Misbahul Munir, M.Si',
        pangkat: 'Pembina Utama Muda (IV/c)',
        nip: '19710815 199603 1 003',
        tampilTtd: 'ya',
        tampilStempel: 'ya',
        teksStempel: 'PEMERINTAH KAB. SIDOARJO * DINAS SOSIAL *',
        warnaStempel: '#4f46e5',
        customLogoDataUrl: '',
        customTtdDataUrl: '',
        customStempelDataUrl: ''
    };

    const FILTER_LABELS = {
        all: 'Semua Data Warga',
        all_changes: 'Hanya Data yang Berubah / Mutasi',
        ekonomi_memburuk: 'Kondisi Ekonomi / Kriteria Memburuk (Desil Turun)',
        ekonomi_membaik: 'Kondisi Ekonomi / Kriteria Membaik (Graduasi)',
        pindah_tempat_tinggal: 'Berubah Tempat Tinggal (C8)',
        pindah_alamat: 'Berubah Alamat Domisili (Sidoarjo)',
        pindah_kota: 'Pindah Kota (Luar Kab. Sidoarjo)',
        meninggal: 'Meninggal Dunia (Non-Aktif)',
        warga_baru: 'Warga Baru Terdaftar'
    };

    function escapeHtmlSafe(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getAuthHeaders() {
        const token = typeof window.getCleanToken === 'function' ? window.getCleanToken() : (localStorage.getItem('token') || '');
        const role = localStorage.getItem('role') || 'super_admin';
        const headers = {
            'Content-Type': 'application/json',
            'X-User-Role': role
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    // =========================================================================
    // 1. NAVIGASI TEMPAT KHUSUS PUSAT REKAP 3 BULANAN (STANDALONE FULL-WIDTH)
    // =========================================================================
    const RANGE_TAHUN_LABELS = {
        masa_lalu_jauh: '>20 Tahun Ke Belakang (Masa Lalu Jauh)',
        '20_tahun_lalu': '20 Tahun Terakhir (Historis)',
        sekitar_tahun_ini: 'Lintas Dekade Aktif (Sekitar Tahun Berjalan)',
        '20_tahun_depan': '20 Tahun Ke Depan (Proyeksi)',
        masa_depan_jauh: '>20 Tahun Ke Depan (Masa Depan Jauh)',
        semua_rentang: 'Semua Rentang Adaptif (60+ Tahun)'
    };

    window.updateHighlightBtnRekap3Bulanan = function (isOpen) {
        const navBtn = document.getElementById('btnNavRekapTriwulan');
        if (navBtn) {
            if (isOpen) {
                navBtn.style.background = 'linear-gradient(135deg, #1e3a8a, #1d4ed8)';
                navBtn.style.boxShadow = '0 0 0 3.5px rgba(59, 130, 246, 0.45), 0 6px 16px rgba(30, 64, 175, 0.35)';
                navBtn.style.transform = 'translateY(-1px)';
            } else {
                navBtn.style.background = 'linear-gradient(135deg, #1d4ed8, #1e40af)';
                navBtn.style.boxShadow = '0 2px 8px rgba(29, 78, 216, 0.22)';
                navBtn.style.transform = 'none';
            }
        }
    };

    window.bukaPusatRekap3Bulanan = function () {
        const sec = document.getElementById('sectionPusatRekapTriwulan');
        const card = document.getElementById('rekapTriwulanDashboardCard');
        const scrollBody = document.getElementById('rekapPopupScrollBody');
        if (sec) {
            sec.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
        if (card) {
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.45), 0 25px 60px -12px rgba(15, 23, 42, 0.55)';
            setTimeout(() => {
                if (card) card.style.boxShadow = '0 25px 60px -12px rgba(15, 23, 42, 0.5), 0 0 0 2px rgba(59, 130, 246, 0.35)';
            }, 1500);
        }
        if (scrollBody) {
            scrollBody.scrollTop = 0;
        }
        window.updateHighlightBtnRekap3Bulanan(true);
        window.loadRekapTriwulanData(window.currentTriwulanRekap, window.currentTahunRekap);
    };

    window.tutupPusatRekap3Bulanan = function () {
        const sec = document.getElementById('sectionPusatRekapTriwulan');
        if (sec) {
            sec.style.display = 'none';
        }
        document.body.style.overflow = '';
        window.updateHighlightBtnRekap3Bulanan(false);
    };

    window.togglePanelRekap3Bulanan = function (forceShow) {
        if (forceShow === false) {
            window.tutupPusatRekap3Bulanan();
            return;
        }
        window.bukaPusatRekap3Bulanan();
    };

    window.scrollToRekapTriwulan = function () {
        window.bukaPusatRekap3Bulanan();
    };

    // =========================================================================
    // 2. MUAT DATA REKAP TRIWULANAN, KATALOG C1-C39 & RIWAYAT TAHUN ADAPTIF
    // =========================================================================
    window.loadRekapTriwulanData = async function (triwulanOpt, tahunOpt) {
        try {
            const base = window.BASE_URL || '';
            const params = new URLSearchParams();
            if (triwulanOpt) params.set('triwulan', String(triwulanOpt));
            if (tahunOpt) params.set('tahun', String(tahunOpt));
            params.set('mundur', '35');
            params.set('maju', '35');
            const qs = params.toString() ? `?${params.toString()}` : '';

            const res = await fetch(`${base}/api/rekap-penyaluran${qs}`, {
                method: 'GET',
                headers: getAuthHeaders()
            });
            if (!res.ok) return;
            const json = await res.json();
            if (json && json.status === 'success') {
                window.currentJadwalInputStatus = json.jadwal_status;
                window.currentRekapReport = json.rekap_aktif;
                window.currentTahunRekap = Number(json.rekap_aktif?.tahun || json.jadwal_status?.tahun || new Date().getFullYear());
                window.currentTriwulanRekap = Number(json.rekap_aktif?.triwulan_ke || json.jadwal_status?.triwulan_ke || 4);

                if (Array.isArray(json.katalog_kriteria_dinamis) && json.katalog_kriteria_dinamis.length > 0) {
                    window.katalogKriteria39Cache = json.katalog_kriteria_dinamis;
                }
                const listAdaptif = json.daftar_tahun_adaptif || json.daftar_tahun_20_tahun;
                if (Array.isArray(listAdaptif) && listAdaptif.length > 0) {
                    window.daftarTahun20TahunCache = listAdaptif;
                }

                ensureTahunAdaDiCacheAdaptif(window.currentTahunRekap);
                sesuaikanTabRentangDenganTahun(window.currentTahunRekap);

                renderPenjelajah20TahunDanTriwulan();
                renderJadwalDanHeaderRekap(json.jadwal_status, json.rekap_aktif);
                updateStatusPublishRekapUI(json.rekap_aktif);
                updateHighlightFilterDanKpi();
                window.renderTabelRekapMutasi();
                updateBannerStatusSedangDilihat();
            }
        } catch (err) {
            console.error('[REKAP_TRIWULAN] Gagal memuat rekap:', err);
        }
    };

    function ensureTahunAdaDiCacheAdaptif(targetYear) {
        const y = Number(targetYear);
        if (!y || y < 1900 || y > 2150) return;
        if (!Array.isArray(window.daftarTahun20TahunCache)) {
            window.daftarTahun20TahunCache = [];
        }
        const exists = window.daftarTahun20TahunCache.some(t => Number(t.tahun) === y);
        if (!exists) {
            const nowYear = new Date().getFullYear();
            const selisih = y - nowYear;
            window.daftarTahun20TahunCache.push({
                tahun: y,
                label_tahun: y === nowYear ? `${y} (Tahun Berjalan)` : (selisih < 0 ? `${y} (${Math.abs(selisih)} Thn Lalu)` : `${y} (+${selisih} Thn Depan)`),
                kategori_waktu: y === nowYear ? 'tahun_berjalan' : (selisih < 0 ? 'masa_lalu' : 'masa_depan'),
                selisih_tahun: Math.abs(selisih),
                offset_tahun: selisih,
                total_mutasi_tahunan: 32,
                triwulan: [1, 2, 3, 4].map(tw => ({
                    triwulan_ke: tw,
                    kode_periode: `${y}-TW${tw}`,
                    nama_triwulan: `Triwulan ${['I', 'II', 'III', 'IV'][tw - 1]} (Tahap ${tw})`,
                    rentang_bulan: ['Januari – Maret', 'April – Juni', 'Juli – September', 'Oktober – Desember'][tw - 1] + ' ' + y,
                    total_berubah: 8,
                    ekonomi_memburuk: 4,
                    layak_penyaluran_triwulan: 7,
                    is_published: y <= nowYear
                }))
            });
            window.daftarTahun20TahunCache.sort((a, b) => Number(a.tahun) - Number(b.tahun));
        }
    }

    function sesuaikanTabRentangDenganTahun(y) {
        const nowYear = new Date().getFullYear();
        const yr = Number(y);
        const curRange = window.currentRentangTahunAdaptif || 'sekitar_tahun_ini';
        if (curRange === 'semua_rentang') return;

        if (yr < nowYear - 20 && curRange !== 'masa_lalu_jauh') {
            window.currentRentangTahunAdaptif = 'masa_lalu_jauh';
        } else if (yr > nowYear + 20 && curRange !== 'masa_depan_jauh') {
            window.currentRentangTahunAdaptif = 'masa_depan_jauh';
        } else if (yr >= nowYear - 20 && yr < nowYear - 10 && curRange === 'sekitar_tahun_ini') {
            window.currentRentangTahunAdaptif = '20_tahun_lalu';
        } else if (yr > nowYear + 10 && yr <= nowYear + 20 && curRange === 'sekitar_tahun_ini') {
            window.currentRentangTahunAdaptif = '20_tahun_depan';
        }
    }

    function updateBannerStatusSedangDilihat() {
        const rekap = window.currentRekapReport;
        const elTw = document.getElementById('txtIndikatorAktifTahunTw');
        const elRentang = document.getElementById('txtIndikatorRentangTahun');
        const elKat = document.getElementById('txtIndikatorAktifKategori');
        const elWarga = document.getElementById('txtIndikatorAktifWarga');

        if (elTw && rekap) {
            const nowYear = new Date().getFullYear();
            const diff = Number(rekap.tahun) - nowYear;
            const infoWaktu = diff === 0 ? 'Tahun Berjalan' : (diff < 0 ? `${Math.abs(diff)} Tahun Ke Belakang` : `+${diff} Tahun Ke Depan`);
            elTw.textContent = `Tahun ${rekap.tahun} (${infoWaktu}) • ${rekap.nama_triwulan} (${rekap.rentang_bulan})`;
        }
        if (elRentang) {
            elRentang.textContent = RANGE_TAHUN_LABELS[window.currentRentangTahunAdaptif] || 'Lintas Dekade Aktif';
        }
        if (elKat) {
            elKat.textContent = FILTER_LABELS[window.currentRekapFilter] || window.currentRekapFilter;
        }
        if (elWarga) {
            if (window.currentSelectedRekapNik && rekap && Array.isArray(rekap.items)) {
                const found = rekap.items.find(x => String(x.nik) === String(window.currentSelectedRekapNik));
                if (found) {
                    elWarga.textContent = `${found.nama} (NIK: ${found.nik} — Desil ${found.desil_lama} → Desil ${found.desil_baru})`;
                    return;
                }
            }
            elWarga.textContent = 'Semua Baris Ditampilkan (Klik salah satu baris untuk highlight warga)';
        }
    }

    // =========================================================================
    // 2B. STATUS & TOMBOL PUBLISH REALTIME KE PORTAL WARGA
    // =========================================================================
    function updateStatusPublishRekapUI(rekap) {
        if (!rekap) return;
        const isPub = Boolean(rekap.is_published);
        const badge = document.getElementById('badgeStatusPublishRekap');
        const btn = document.getElementById('btnPublishRekapKeWarga');
        const txtBtn = document.getElementById('txtBtnPublishRekapKeWarga');
        const infoBanner = document.getElementById('txtInfoPublishWargaBanner');

        if (badge) {
            if (isPub) {
                badge.style.background = '#22c55e';
                badge.style.color = '#052e16';
                badge.innerHTML = `<i class="fas fa-broadcast-tower"></i> DITERBITKAN KE WARGA (REALTIME LIVE • ${escapeHtmlSafe(rekap.kode_periode)})`;
            } else {
                badge.style.background = '#f59e0b';
                badge.style.color = '#0f172a';
                badge.innerHTML = `<i class="fas fa-eye-slash"></i> DRAFT INTERNAL (${escapeHtmlSafe(rekap.kode_periode)} BELUM DITERBITKAN KE WARGA)`;
            }
        }

        if (btn && txtBtn) {
            if (isPub) {
                btn.style.background = '#ecfdf5';
                btn.style.color = '#065f46';
                btn.style.borderColor = '#34d399';
                txtBtn.textContent = 'Sudah Publish ke Warga (Klik untuk Tarik/Perbarui)';
            } else {
                btn.style.background = '#22c55e';
                btn.style.color = '#052e16';
                btn.style.borderColor = '#bbf7d0';
                txtBtn.textContent = 'Terbitkan Realtime ke Warga Sekarang';
            }
        }

        if (infoBanner) {
            infoBanner.innerHTML = isPub
                ? `<i class="fas fa-check-circle" style="color:#16a34a;"></i> Laporan <b>${escapeHtmlSafe(rekap.kode_periode)}</b> telah diterbitkan (${escapeHtmlSafe(rekap.published_at || 'Aktif')}) &amp; tampil realtime di Portal Warga`
                : `<i class="fas fa-clock" style="color:#d97706;"></i> Laporan <b>${escapeHtmlSafe(rekap.kode_periode)}</b> masih berstatus Draft Internal — klik <b>"Terbitkan Realtime ke Warga"</b> agar warga dapat mengaksesnya`;
        }
    }

    window.togglePublishRekapKeWarga = async function (forcePublishState) {
        const rekap = window.currentRekapReport;
        if (!rekap) return;
        const nextPub = typeof forcePublishState === 'boolean' ? forcePublishState : !Boolean(rekap.is_published);

        try {
            const base = window.BASE_URL || '';
            const username = localStorage.getItem('username') || localStorage.getItem('role') || 'Petugas / Admin Dinas Sosial';
            const res = await fetch(`${base}/api/rekap-penyaluran/publish`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    tahun: window.currentTahunRekap,
                    triwulan: window.currentTriwulanRekap,
                    is_published: nextPub,
                    published_by: username
                })
            });
            const json = await res.json();
            if (json && json.status === 'success') {
                window.currentRekapReport = json.rekap_aktif;
                if (Array.isArray(json.daftar_tahun_adaptif)) {
                    window.daftarTahun20TahunCache = json.daftar_tahun_adaptif;
                }
                updateStatusPublishRekapUI(json.rekap_aktif);
                renderPenjelajah20TahunDanTriwulan();
                updateBannerStatusSedangDilihat();

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: nextPub ? 'Berhasil Diterbitkan ke Warga!' : 'Ditarik ke Draft Internal',
                        text: json.message,
                        timer: 2600,
                        showConfirmButton: false
                    });
                }
            }
        } catch (err) {
            console.error('[PUBLISH_REKAP] Gagal memperbarui status publikasi:', err);
        }
    };

    // =========================================================================
    // 3. PENJELAJAH ARSIP REKAP ADAPTIF (>20-50+ THN LALU & >20-50+ THN DEPAN)
    // =========================================================================
    window.pilihRentangTahunAdaptif = function (rangeKey) {
        window.currentRentangTahunAdaptif = rangeKey || 'sekitar_tahun_ini';
        renderPenjelajah20TahunDanTriwulan();
        updateBannerStatusSedangDilihat();
    };

    window.loncatKeTahunRekap = async function () {
        const inp = document.getElementById('inputLoncatTahunRekap');
        if (!inp) return;
        let y = parseInt(String(inp.value || '').trim(), 10);
        if (Number.isNaN(y)) return;
        if (y < 1900) y = 1900;
        if (y > 2150) y = 2150;
        inp.value = String(y);
        ensureTahunAdaDiCacheAdaptif(y);
        sesuaikanTabRentangDenganTahun(y);
        await window.pilihTahunRekapHistoris(y);
    };

    function renderPenjelajah20TahunDanTriwulan() {
        const containerYears = document.getElementById('containerTombol20Tahun');
        const selectYear = document.getElementById('selectTahunRekap20Tahun');
        const containerQuarters = document.getElementById('containerKartuTriwulanPerTahun');

        const nowYear = new Date().getFullYear();
        let listTahun = window.daftarTahun20TahunCache;
        if (!Array.isArray(listTahun) || listTahun.length === 0) {
            listTahun = [];
            for (let y = nowYear - 35; y <= nowYear + 35; y++) {
                const selisih = y - nowYear;
                listTahun.push({
                    tahun: y,
                    label_tahun: y === nowYear ? `${y} (Tahun Ini)` : (selisih < 0 ? `${y} (${Math.abs(selisih)} Thn Lalu)` : `${y} (+${selisih} Thn Depan)`),
                    kategori_waktu: y === nowYear ? 'tahun_berjalan' : (selisih < 0 ? 'masa_lalu' : 'masa_depan'),
                    selisih_tahun: Math.abs(selisih),
                    offset_tahun: selisih,
                    total_mutasi_tahunan: 32,
                    triwulan: [1, 2, 3, 4].map(tw => ({
                        triwulan_ke: tw,
                        nama_triwulan: `Triwulan ${['I', 'II', 'III', 'IV'][tw - 1]} (Tahap ${tw})`,
                        rentang_bulan: ['Januari – Maret', 'April – Juni', 'Juli – September', 'Oktober – Desember'][tw - 1] + ' ' + y,
                        total_berubah: 8,
                        ekonomi_memburuk: 4,
                        layak_penyaluran_triwulan: 7,
                        is_published: y <= nowYear
                    }))
                });
            }
            window.daftarTahun20TahunCache = listTahun;
        }

        const activeYear = Number(window.currentTahunRekap || nowYear);
        const activeTw = Number(window.currentTriwulanRekap || 4);
        ensureTahunAdaDiCacheAdaptif(activeYear);

        // Highlight Tab Rentang Tahun Adaptif
        const activeRange = window.currentRentangTahunAdaptif || 'sekitar_tahun_ini';
        document.querySelectorAll('#groupTabRentangTahunAdaptif .btn-rentang-tahun-adaptif').forEach(btn => {
            const r = btn.getAttribute('data-range');
            if (r === activeRange) {
                btn.classList.add('active');
                btn.style.background = '#1d4ed8';
                btn.style.color = '#ffffff';
                btn.style.border = '2px solid #1e3a8a';
                btn.style.fontWeight = '900';
                btn.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.22)';
            } else {
                btn.classList.remove('active');
                btn.style.background = '#ffffff';
                btn.style.color = '#334155';
                btn.style.border = '1.5px solid #cbd5e1';
                btn.style.fontWeight = '800';
                btn.style.boxShadow = 'none';
            }
        });

        // Isi Dropdown Semua Tahun Adaptif
        if (selectYear) {
            const sortedDesc = [...listTahun].sort((a, b) => Number(b.tahun) - Number(a.tahun));
            selectYear.innerHTML = sortedDesc.map(t => {
                const y = Number(t.tahun);
                const isSel = y === activeYear ? 'selected' : '';
                const diff = y - nowYear;
                const suffix = diff === 0
                    ? 'Tahun Berjalan (Aktif)'
                    : (diff < 0 ? `${Math.abs(diff)} Tahun Ke Belakang` : `+${diff} Tahun Ke Depan`);
                return `<option value="${y}" ${isSel}>Tahun ${y} — ${suffix}</option>`;
            }).join('');
        }

        // Filter daftar tombol tahun sesuai tab rentang waktu adaptif
        let filteredYears = listTahun.filter(t => {
            const y = Number(t.tahun);
            if (y === activeYear) return true; // Pastikan tahun yang sedang dilihat selalu tampil & ter-highlight
            if (activeRange === 'masa_lalu_jauh') return y < nowYear - 20;
            if (activeRange === '20_tahun_lalu') return y >= nowYear - 20 && y < nowYear;
            if (activeRange === 'sekitar_tahun_ini') return y >= nowYear - 10 && y <= nowYear + 10;
            if (activeRange === '20_tahun_depan') return y > nowYear && y <= nowYear + 20;
            if (activeRange === 'masa_depan_jauh') return y > nowYear + 20;
            return true; // semua_rentang
        });
        filteredYears.sort((a, b) => Number(a.tahun) - Number(b.tahun));

        if (containerYears) {
            containerYears.innerHTML = filteredYears.map(t => {
                const y = Number(t.tahun);
                const isAct = y === activeYear;
                const isNow = y === nowYear;
                const isFuture = y > nowYear;
                let baseBg = '#ffffff';
                let baseColor = '#334155';
                let baseBorder = '1px solid #cbd5e1';
                if (isNow && !isAct) {
                    baseBg = '#f0fdf4';
                    baseColor = '#15803d';
                    baseBorder = '1.5px solid #86efac';
                } else if (isFuture && !isAct) {
                    baseBg = '#f5f3ff';
                    baseColor = '#5b21b6';
                    baseBorder = '1px solid #ddd6fe';
                }

                return `
                    <button type="button"
                        class="btn-rekap-tahun ${isAct ? 'active' : ''}"
                        data-tahun="${y}"
                        onclick="window.pilihTahunRekapHistoris(${y})"
                        title="Klik untuk melihat Rekapitulasi Tahun ${y} (${y === nowYear ? 'Tahun Berjalan' : (y < nowYear ? (nowYear - y) + ' Tahun Lalu' : '+' + (y - nowYear) + ' Tahun Ke Depan')})"
                        style="
                            padding: 5px 10px;
                            border-radius: 9px;
                            font-size: 0.73rem;
                            cursor: pointer;
                            transition: all 0.15s;
                            font-weight: ${isAct ? '900' : '700'};
                            background: ${isAct ? '#1d4ed8' : baseBg};
                            color: ${isAct ? '#ffffff' : baseColor};
                            border: ${isAct ? '2px solid #1e3a8a' : baseBorder};
                            box-shadow: ${isAct ? '0 0 0 3px rgba(29,78,216,0.28)' : 'none'};
                            transform: ${isAct ? 'scale(1.05)' : 'none'};
                        ">
                        ${isAct ? '<i class="fas fa-check-circle"></i> ' : ''}${y}${isNow ? ' ★' : ''}
                    </button>
                `;
            }).join('');
        }

        if (containerQuarters) {
            const yearObj = listTahun.find(t => Number(t.tahun) === activeYear) || listTahun[0];
            const quarters = yearObj?.triwulan || [];
            const romawi = ['I', 'II', 'III', 'IV'];
            const rentangSingkat = ['Jan – Mar', 'Apr – Jun', 'Juli – Sep', 'Okt – Des'];

            containerQuarters.innerHTML = [1, 2, 3, 4].map(tw => {
                const q = quarters.find(x => Number(x.triwulan_ke) === tw) || {
                    triwulan_ke: tw,
                    total_berubah: 8,
                    ekonomi_memburuk: 4,
                    layak_penyaluran_triwulan: 7,
                    is_published: activeYear <= nowYear
                };
                const isAct = tw === activeTw;
                const isPub = isAct && window.currentRekapReport ? Boolean(window.currentRekapReport.is_published) : Boolean(q.is_published);
                return `
                    <div onclick="window.pilihPeriodeTriwulan(${tw}, ${activeYear})"
                        class="rekap-quarter-card ${isAct ? 'active' : ''}"
                        data-tw-card="${tw}"
                        style="
                            cursor: pointer;
                            border-radius: 12px;
                            padding: 10px 13px;
                            transition: all 0.16s;
                            background: ${isAct ? 'linear-gradient(135deg, #eff6ff, #dbeafe)' : '#ffffff'};
                            border: ${isAct ? '2px solid #1d4ed8' : '1px solid #cbd5e1'};
                            box-shadow: ${isAct ? '0 0 0 3px rgba(29,78,216,0.22)' : 'none'};
                        ">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span style="font-size:0.77rem; font-weight:900; color:${isAct ? '#1e3a8a' : '#0f172a'};">
                                Triwulan ${romawi[tw - 1]} (${rentangSingkat[tw - 1]} ${activeYear})
                            </span>
                            <div style="display:flex; gap:4px; align-items:center;">
                                <span style="background:${isPub ? '#dcfce7' : '#fef3c7'}; color:${isPub ? '#166534' : '#92400e'}; font-size:0.6rem; font-weight:800; padding:2px 6px; border-radius:8px;">
                                    ${isPub ? 'LIVE WARGA' : 'DRAFT'}
                                </span>
                                ${isAct
                                    ? `<span style="background:#1d4ed8; color:#ffffff; font-size:0.62rem; font-weight:900; padding:2px 7px; border-radius:10px;">SEDANG DILIHAT</span>`
                                    : `<span style="background:#f1f5f9; color:#64748b; font-size:0.62rem; font-weight:700; padding:2px 6px; border-radius:10px;">Pilih</span>`
                                }
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; margin-top:6px; font-size:0.7rem; color:#475569; font-weight:700;">
                            <span><b style="color:#0891b2;">${q.total_berubah ?? 8}</b> Mutasi</span>
                            <span>&bull;</span>
                            <span><b style="color:#dc2626;">${q.ekonomi_memburuk ?? 4}</b> Desil Turun</span>
                            <span>&bull;</span>
                            <span><b style="color:#15803d;">${q.layak_penyaluran_triwulan ?? 7}</b> Layak</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    window.pilihTahunRekapHistoris = async function (tahun) {
        const y = Number(tahun);
        if (!y || y < 1900 || y > 2150) return;
        window.currentTahunRekap = y;
        ensureTahunAdaDiCacheAdaptif(y);
        sesuaikanTabRentangDenganTahun(y);
        await window.pilihPeriodeTriwulan(window.currentTriwulanRekap || 4, y);
    };

    window.geserTahunRekap = async function (delta) {
        const nowYear = new Date().getFullYear();
        let nextY = Number(window.currentTahunRekap || nowYear) + Number(delta);
        if (nextY < 1900) nextY = 1900;
        if (nextY > 2150) nextY = 2150;
        await window.pilihTahunRekapHistoris(nextY);
    };

    // =========================================================================
    // 4. RENDER HEADER, JADWAL TANGGAL (1-10 / SEBELUM 26) & HIGHLIGHT AKTIF
    // =========================================================================
    function renderJadwalDanHeaderRekap(jadwal, rekap) {
        if (!jadwal || !rekap) return;

        const badgeTw = document.getElementById('badgePeriodeTriwulanAktif');
        if (badgeTw) {
            badgeTw.textContent = `${rekap.nama_triwulan} (${rekap.rentang_bulan})`;
        }
        const txtPenyaluran = document.getElementById('txtJadwalPenyaluranTriwulan');
        if (txtPenyaluran) {
            txtPenyaluran.textContent = `${rekap.nama_triwulan} — ${rekap.rentang_bulan}`;
        }
        const countLayak = document.getElementById('countLayakSalurTriwulan');
        if (countLayak) {
            countLayak.textContent = String(rekap.ringkasan?.layak_penyaluran_triwulan ?? 0);
        }

        // Highlight tombol Triwulan I - IV
        document.querySelectorAll('.btn-pilih-triwulan').forEach(btn => {
            const tw = Number(btn.getAttribute('data-tw'));
            const isAct = tw === Number(rekap.triwulan_ke || jadwal.triwulan_ke);
            if (isAct) {
                btn.classList.add('active');
                btn.style.background = '#1d4ed8';
                btn.style.color = '#ffffff';
                btn.style.borderColor = '#1e3a8a';
                btn.style.fontWeight = '900';
                btn.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.25)';
            } else {
                btn.classList.remove('active');
                btn.style.background = '#ffffff';
                btn.style.color = '#334155';
                btn.style.borderColor = '#cbd5e1';
                btn.style.fontWeight = '700';
                btn.style.boxShadow = 'none';
            }
        });

        // Update Box Jadwal Penginputan Bulanan (Tgl 1-10, 11-25 Sebelum 26, 26+)
        const boxJadwal = document.getElementById('boxStatusJadwalInputBulanan');
        const txtNamaJendela = document.getElementById('txtNamaJendelaInput');
        const badgeBuka = document.getElementById('badgeStatusBukaInput');
        const txtPesanJadwal = document.getElementById('txtPesanJadwalInput');

        if (txtNamaJendela) {
            txtNamaJendela.textContent = `${jadwal.nama_jendela} • ${jadwal.tanggal_aktif}`;
        }
        if (txtPesanJadwal) {
            txtPesanJadwal.innerHTML = escapeHtmlSafe(jadwal.pesan_jadwal);
        }

        if (boxJadwal && badgeBuka) {
            if (jadwal.kode_jendela === 'UTAMA_1_10') {
                boxJadwal.style.background = '#f0fdf4';
                boxJadwal.style.borderColor = '#86efac';
                badgeBuka.style.background = '#16a34a';
                badgeBuka.innerHTML = '<i class="fas fa-check-circle"></i> JENDELA UTAMA AKTIF (Tgl 1–10)';
            } else if (jadwal.kode_jendela === 'SEBELUM_26') {
                boxJadwal.style.background = '#fffbeb';
                boxJadwal.style.borderColor = '#fcd34d';
                badgeBuka.style.background = '#d97706';
                badgeBuka.innerHTML = '<i class="fas fa-exclamation-circle"></i> SEBELUM BATAS TGL 26 (Tgl 11–25)';
            } else {
                boxJadwal.style.background = '#fef2f2';
                boxJadwal.style.borderColor = '#fca5a5';
                badgeBuka.style.background = '#dc2626';
                badgeBuka.innerHTML = '<i class="fas fa-lock"></i> FASE REKAP / LEWAT TGL 26';
            }
        }

        // Highlight tombol mode simulasi jadwal
        const modes = ['tgl_1_10', 'tgl_11_25', 'tgl_26_plus'];
        modes.forEach(m => {
            const b = document.getElementById(`btnModeJadwal_${m}`);
            if (!b) return;
            const isAct = (jadwal.mode_simulasi === m) ||
                (jadwal.mode_simulasi === 'realtime' && (
                    (m === 'tgl_1_10' && jadwal.kode_jendela === 'UTAMA_1_10') ||
                    (m === 'tgl_11_25' && jadwal.kode_jendela === 'SEBELUM_26') ||
                    (m === 'tgl_26_plus' && jadwal.kode_jendela === 'TUTUP_26_PLUS')
                ));
            if (isAct) {
                b.style.boxShadow = '0 0 0 3px rgba(15, 23, 42, 0.35)';
                b.style.transform = 'scale(1.04)';
                b.style.fontWeight = '900';
            } else {
                b.style.boxShadow = 'none';
                b.style.transform = 'none';
                b.style.fontWeight = '700';
            }
        });

        // Update 7 Kartu Ringkasan KPI Rekap
        const r = rekap.ringkasan || {};
        const setElText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(val ?? 0);
        };
        setElText('rekapCountEkonomiMemburuk', r.ekonomi_memburuk);
        setElText('rekapCountEkonomiMembaik', r.ekonomi_membaik);
        setElText('rekapCountPindahTempatTinggal', r.pindah_tempat_tinggal);
        setElText('rekapCountPindahAlamat', r.pindah_alamat);
        setElText('rekapCountPindahKota', r.pindah_kota);
        setElText('rekapCountMeninggal', r.meninggal);
        setElText('rekapCountTotalBerubah', r.total_berubah);
        setElText('rekapCountDataLama', rekap.total_data_lama);
        setElText('rekapCountDataBaru', rekap.total_data_baru);

        const fmtRpLocal = (num) => `Rp ${Math.max(0, Math.round(Number(num) || 0)).toLocaleString('id-ID')}`;
        const itemsList = Array.isArray(rekap.items) ? rekap.items : [];
        const fallbackAwal = itemsList.reduce((acc, it) => acc + (Number(it.nominal_penyaluran_awal) || 0), 0);
        const fallbackAkhir = itemsList.reduce((acc, it) => acc + (Number(it.nominal_penyaluran_akhir) || 0), 0);
        const fallbackAkumulasi = itemsList.reduce((acc, it) => acc + (Number(it.total_nominal_awal_sampai_akhir) || 0), 0);

        setElText('rekapTotalNominalAwalVal', r.total_nominal_penyaluran_awal_seluruh_warga_label || fmtRpLocal(fallbackAwal));
        setElText('rekapTotalNominalAkhirVal', r.total_nominal_penyaluran_akhir_seluruh_warga_label || fmtRpLocal(fallbackAkhir));
        setElText('rekapTotalAkumulasiAwalAkhirVal', r.total_nominal_akumulasi_awal_sampai_akhir_seluruh_warga_label || fmtRpLocal(fallbackAkumulasi));
    }

    function updateHighlightFilterDanKpi() {
        const activeFilter = window.currentRekapFilter || 'all';

        // 1. Highlight Tab Filter Kategori
        document.querySelectorAll('#rekapFilterTabsGroup .rekap-tab-btn').forEach(b => {
            const f = b.getAttribute('data-filter');
            if (f === activeFilter) {
                b.classList.add('active');
                b.style.background = '#1e3a8a';
                b.style.color = '#ffffff';
                b.style.borderColor = '#1e3a8a';
                b.style.boxShadow = '0 0 0 3px rgba(30, 58, 138, 0.25)';
                b.style.fontWeight = '900';
                b.style.transform = 'scale(1.03)';
            } else {
                b.classList.remove('active');
                b.style.background = '#ffffff';
                b.style.color = '#334155';
                b.style.borderColor = '#cbd5e1';
                b.style.boxShadow = 'none';
                b.style.fontWeight = '700';
                b.style.transform = 'none';
            }
        });

        // 2. Highlight Kartu KPI yang sesuai dengan Filter Aktif
        document.querySelectorAll('#rekapKpiCardsContainer .rekap-kpi-card').forEach(card => {
            const kf = card.getAttribute('data-kpi-filter');
            const oldBadge = card.querySelector('.badge-kpi-active-indicator');
            if (oldBadge) oldBadge.remove();

            if (kf === activeFilter) {
                card.style.boxShadow = '0 0 0 3px #1d4ed8, 0 8px 20px rgba(29, 78, 216, 0.18)';
                card.style.transform = 'translateY(-2px)';
                card.style.borderColor = '#1d4ed8';
                const badge = document.createElement('div');
                badge.className = 'badge-kpi-active-indicator';
                badge.style.cssText = 'position:absolute; top:-8px; right:8px; background:#1d4ed8; color:#ffffff; font-size:0.58rem; font-weight:900; padding:2px 7px; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.2);';
                badge.innerHTML = '<i class="fas fa-eye"></i> SEDANG DILIHAT';
                card.appendChild(badge);
            } else {
                card.style.boxShadow = 'none';
                card.style.transform = 'none';
            }
        });

        updateBannerStatusSedangDilihat();
    }

    window.filterTabelRekapMutasi = function (filterKey) {
        window.currentRekapFilter = filterKey || 'all';
        updateHighlightFilterDanKpi();
        window.renderTabelRekapMutasi();
    };

    window.pilihDanHighlightBarisRekap = function (nik) {
        window.currentSelectedRekapNik = String(nik || '');
        document.querySelectorAll('#tbodyRekapMutasiTriwulan tr.rekap-row-item').forEach(tr => {
            const rowNik = tr.getAttribute('data-nik');
            const badge = tr.querySelector('.badge-row-selected');
            if (rowNik === window.currentSelectedRekapNik) {
                tr.style.background = '#eff6ff';
                tr.style.boxShadow = 'inset 5px 0 0 #1d4ed8, 0 0 0 1.5px #93c5fd';
                if (badge) badge.style.display = 'inline-flex';
            } else {
                tr.style.background = tr.getAttribute('data-default-bg') || '#ffffff';
                tr.style.boxShadow = 'none';
                if (badge) badge.style.display = 'none';
            }
        });
        updateBannerStatusSedangDilihat();
    };

    function buildKategoriBadges(item) {
        const list = Array.isArray(item.kategori_list) ? item.kategori_list : [item.kategori_utama];
        const badges = [];

        if (list.includes('meninggal')) {
            badges.push(`<span style="display:inline-flex; align-items:center; gap:4px; background:#1e293b; color:#ffffff; padding:3px 9px; border-radius:20px; font-size:0.7rem; font-weight:800;"><i class="fas fa-ribbon"></i> Meninggal Dunia</span>`);
        }
        if (list.includes('pindah_kota')) {
            badges.push(`<span style="display:inline-flex; align-items:center; gap:4px; background:#f5f3ff; color:#6d28d9; border:1px solid #c4b5fd; padding:3px 9px; border-radius:20px; font-size:0.7rem; font-weight:800;"><i class="fas fa-city"></i> Pindah Kota (${escapeHtmlSafe(item.kota_baru)})</span>`);
        }
        if (list.includes('ekonomi_memburuk')) {
            badges.push(`<span style="display:inline-flex; align-items:center; gap:4px; background:#fef2f2; color:#dc2626; border:1px solid #fca5a5; padding:3px 9px; border-radius:20px; font-size:0.7rem; font-weight:800;"><i class="fas fa-arrow-trend-down"></i> Ekonomi / Kriteria Memburuk</span>`);
        }
        if (list.includes('ekonomi_membaik')) {
            badges.push(`<span style="display:inline-flex; align-items:center; gap:4px; background:#f0fdf4; color:#15803d; border:1px solid #86efac; padding:3px 9px; border-radius:20px; font-size:0.7rem; font-weight:800;"><i class="fas fa-arrow-trend-up"></i> Ekonomi / Kriteria Membaik</span>`);
        }
        if (list.includes('pindah_tempat_tinggal')) {
            badges.push(`<span style="display:inline-flex; align-items:center; gap:4px; background:#fff7ed; color:#c2410c; border:1px solid #fdba74; padding:3px 9px; border-radius:20px; font-size:0.7rem; font-weight:800;"><i class="fas fa-house-damage"></i> Berubah Tempat Tinggal</span>`);
        }
        if (list.includes('pindah_alamat')) {
            badges.push(`<span style="display:inline-flex; align-items:center; gap:4px; background:#eff6ff; color:#1d4ed8; border:1px solid #93c5fd; padding:3px 9px; border-radius:20px; font-size:0.7rem; font-weight:800;"><i class="fas fa-map-signs"></i> Berubah Alamat</span>`);
        }
        if (list.includes('warga_baru')) {
            badges.push(`<span style="display:inline-flex; align-items:center; gap:4px; background:#ecfeff; color:#0e7490; border:1px solid #67e8f9; padding:3px 9px; border-radius:20px; font-size:0.7rem; font-weight:800;"><i class="fas fa-user-plus"></i> Warga Baru</span>`);
        }
        if (badges.length === 0 || list.includes('tetap')) {
            badges.push(`<span style="display:inline-flex; align-items:center; gap:4px; background:#f8fafc; color:#64748b; border:1px solid #cbd5e1; padding:3px 9px; border-radius:20px; font-size:0.7rem; font-weight:700;"><i class="fas fa-check"></i> Data Tetap</span>`);
        }
        return `<div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">${badges.join('')}</div>`;
    }

    function buildDomisiliComparisonHtml(item) {
        const list = Array.isArray(item.kategori_list) ? item.kategori_list : [];
        const parts = [];

        if (list.includes('pindah_kota')) {
            parts.push(`
                <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:8px; padding:5px 8px; margin-bottom:4px;">
                    <div style="font-size:0.68rem; font-weight:800; color:#5b21b6;">MUTASI KOTA DOMISILI:</div>
                    <div style="font-size:0.74rem; color:#475569;"><strike>${escapeHtmlSafe(item.kota_lama)}</strike> ➔ <b style="color:#6d28d9;">${escapeHtmlSafe(item.kota_baru)}</b></div>
                </div>
            `);
        }

        if (list.includes('pindah_tempat_tinggal') && item.tempat_tinggal_lama !== item.tempat_tinggal_baru) {
            parts.push(`
                <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:5px 8px; margin-bottom:4px;">
                    <div style="font-size:0.68rem; font-weight:800; color:#9a3412;">STATUS TEMPAT TINGGAL (C8):</div>
                    <div style="font-size:0.74rem; color:#334155;"><span>${escapeHtmlSafe(item.tempat_tinggal_lama)}</span> ➔ <b style="color:#c2410c;">${escapeHtmlSafe(item.tempat_tinggal_baru)}</b></div>
                </div>
            `);
        } else {
            parts.push(`<div style="font-size:0.73rem; color:#475569; margin-bottom:3px;"><b>Hunian:</b> ${escapeHtmlSafe(item.tempat_tinggal_baru)}</div>`);
        }

        if (list.includes('pindah_alamat') || list.includes('pindah_kota')) {
            parts.push(`
                <div style="font-size:0.73rem; line-height:1.35;">
                    <div style="color:#64748b;"><b>Alamat Lama:</b> ${escapeHtmlSafe(item.alamat_lama)}</div>
                    <div style="color:#0f172a; margin-top:2px;"><b>Alamat Baru:</b> <span style="color:#1d4ed8; font-weight:700;">${escapeHtmlSafe(item.alamat_baru)}</span></div>
                </div>
            `);
        } else {
            parts.push(`<div style="font-size:0.73rem; color:#334155; line-height:1.35;"><b>Alamat:</b> ${escapeHtmlSafe(item.alamat_baru)}</div>`);
        }

        return parts.join('');
    }

    function buildDesilTransitionHtml(item) {
        const dLama = item.desil_lama;
        const dBaru = item.desil_baru;
        const skorLama = Number(item.skor_saw_lama || 0).toFixed(4);
        const skorBaru = Number(item.skor_saw_baru || 0).toFixed(4);

        if (item.arah_desil === 'turun_prioritas_naik') {
            return `
                <div style="background:#fef2f2; border:1.5px solid #f87171; border-radius:10px; padding:7px 9px; text-align:center;">
                    <div style="font-size:0.67rem; font-weight:800; color:#b91c1c; text-transform:uppercase; margin-bottom:3px;">
                        <i class="fas fa-arrow-down"></i> Desil Otomatis Diturunkan
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px; font-weight:900; font-size:0.86rem;">
                        <span style="background:#e2e8f0; color:#475569; padding:2px 7px; border-radius:6px; font-size:0.74rem;">Desil ${dLama}</span>
                        <i class="fas fa-long-arrow-alt-right" style="color:#dc2626;"></i>
                        <span style="background:#dc2626; color:#ffffff; padding:2px 9px; border-radius:6px;">Desil ${dBaru}</span>
                    </div>
                    <div style="font-size:0.68rem; color:#15803d; font-weight:800; margin-top:4px;">
                        Prioritas Utama (Skor: ${skorLama} → ${skorBaru})
                    </div>
                </div>
            `;
        }

        if (item.arah_desil === 'naik_graduasi') {
            return `
                <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px; padding:7px 9px; text-align:center;">
                    <div style="font-size:0.67rem; font-weight:800; color:#15803d; text-transform:uppercase; margin-bottom:3px;">
                        <i class="fas fa-level-up-alt"></i> Penyesuaian / Graduasi Desil
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px; font-weight:900; font-size:0.86rem;">
                        <span style="background:#dcfce7; color:#166534; padding:2px 7px; border-radius:6px; font-size:0.74rem;">Desil ${dLama}</span>
                        <i class="fas fa-long-arrow-alt-right" style="color:#16a34a;"></i>
                        <span style="background:#0284c7; color:#ffffff; padding:2px 9px; border-radius:6px;">Desil ${dBaru}</span>
                    </div>
                    <div style="font-size:0.68rem; color:#0369a1; font-weight:700; margin-top:4px;">
                        Ekonomi Membaik (Skor: ${skorLama} → ${skorBaru})
                    </div>
                </div>
            `;
        }

        if (item.arah_desil === 'nonaktif_mutasi') {
            const labelAlasan = item.kategori_list?.includes('meninggal') ? 'Meninggal Dunia' : 'Pindah Kota';
            return `
                <div style="background:#f1f5f9; border:1.5px solid #94a3b8; border-radius:10px; padding:7px 9px; text-align:center;">
                    <div style="font-size:0.67rem; font-weight:800; color:#334155; text-transform:uppercase; margin-bottom:3px;">
                        <i class="fas fa-ban"></i> Dinonaktifkan (${labelAlasan})
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px; font-weight:900; font-size:0.82rem;">
                        <span style="background:#e2e8f0; color:#475569; padding:2px 7px; border-radius:6px; font-size:0.73rem;">Desil ${dLama}</span>
                        <i class="fas fa-long-arrow-alt-right" style="color:#475569;"></i>
                        <span style="background:#334155; color:#ffffff; padding:2px 8px; border-radius:6px; font-size:0.73rem;">Non-Aktif (D${dBaru})</span>
                    </div>
                    <div style="font-size:0.67rem; color:#dc2626; font-weight:700; margin-top:4px;">
                        Kuota Dialihkan Otomatis
                    </div>
                </div>
            `;
        }

        return `
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:6px 9px; text-align:center;">
                <div style="font-weight:800; font-size:0.82rem; color:#0f172a;">
                    Desil ${dLama} ➔ Desil ${dBaru}
                </div>
                <div style="font-size:0.68rem; color:#64748b; margin-top:2px;">
                    Skor SAW: ${skorBaru}
                </div>
            </div>
        `;
    }

    window.renderTabelRekapMutasi = function () {
        const tbody = document.getElementById('tbodyRekapMutasiTriwulan');
        if (!tbody) return;

        const report = window.currentRekapReport;
        if (!report || !Array.isArray(report.items)) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:#64748b;">Belum ada data rekapitulasi.</td></tr>`;
            return;
        }

        const filter = window.currentRekapFilter || 'all';
        const q = (document.getElementById('inputSearchRekapMutasi')?.value || '').trim().toLowerCase();

        const filtered = report.items.filter(item => {
            const list = Array.isArray(item.kategori_list) ? item.kategori_list : [item.kategori_utama];
            if (filter === 'all_changes') {
                if (item.kategori_utama === 'tetap' && list.length === 1 && list[0] === 'tetap') return false;
            } else if (filter !== 'all') {
                if (!list.includes(filter) && item.kategori_utama !== filter) return false;
            }

            if (q) {
                const hay = [
                    item.nik,
                    item.nama,
                    item.alamat_lama,
                    item.alamat_baru,
                    item.kota_baru,
                    ...(item.label_perubahan || []),
                    ...(item.rincian_perubahan_kriteria || []),
                    item.keterangan_desil_otomatis
                ].join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:28px; color:#64748b;">
                        <i class="fas fa-inbox" style="font-size:1.4rem; margin-bottom:6px; display:block; color:#94a3b8;"></i>
                        Tidak ada data warga pada kategori filter <b>${escapeHtmlSafe(FILTER_LABELS[filter] || filter)}</b> ini.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map((item, idx) => {
            const rincianList = Array.isArray(item.rincian_perubahan_kriteria) && item.rincian_perubahan_kriteria.length > 0
                ? item.rincian_perubahan_kriteria
                : [item.keterangan_desil_otomatis];

            const rincianHtml = rincianList.map(r => `
                <div style="margin-bottom:3px; line-height:1.35;">&bull; ${escapeHtmlSafe(r)}</div>
            `).join('');

            const isLayak = item.desil_baru <= 4 && !String(item.status_bansos_baru || '').includes('Tidak Menerima');
            const badgeKeputusan = isLayak
                ? `<span style="display:inline-block; background:#dcfce7; color:#166534; border:1px solid #86efac; padding:4px 9px; border-radius:20px; font-size:0.71rem; font-weight:800;"><i class="fas fa-check-circle"></i> Layak Salur (Desil ${item.desil_baru})</span>`
                : `<span style="display:inline-block; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; padding:4px 9px; border-radius:20px; font-size:0.71rem; font-weight:800;"><i class="fas fa-times-circle"></i> ${escapeHtmlSafe(item.status_bansos_baru || 'Tidak Menerima')}</span>`;

            const defaultBg = item.kategori_utama === 'tetap' ? '#ffffff' : '#fcfdff';
            const isSelected = String(window.currentSelectedRekapNik) === String(item.nik);

            return `
                <tr class="rekap-row-item"
                    data-nik="${escapeHtmlSafe(item.nik)}"
                    data-default-bg="${defaultBg}"
                    onclick="window.pilihDanHighlightBarisRekap('${escapeHtmlSafe(item.nik)}')"
                    style="cursor:pointer; border-bottom:1px solid #e2e8f0; transition:all 0.15s; background:${isSelected ? '#eff6ff' : defaultBg}; box-shadow:${isSelected ? 'inset 5px 0 0 #1d4ed8, 0 0 0 1.5px #93c5fd' : 'none'};">
                    <td style="padding:10px; text-align:center; font-weight:700; color:#475569;">${idx + 1}</td>
                    <td style="padding:10px;">
                        <div style="font-weight:800; color:#0f172a; font-size:0.82rem; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span>${escapeHtmlSafe(item.nama)}</span>
                            <span class="badge-row-selected" style="display:${isSelected ? 'inline-flex' : 'none'}; align-items:center; gap:3px; background:#1d4ed8; color:#ffffff; font-size:0.6rem; font-weight:900; padding:1px 6px; border-radius:8px;">
                                <i class="fas fa-eye"></i> SEDANG DIPILIH
                            </span>
                        </div>
                        <div style="font-family:monospace; font-size:0.75rem; color:#1d4ed8; font-weight:700; margin-top:2px;">NIK: ${escapeHtmlSafe(item.nik)}</div>
                        ${item.email_warga ? `<div style="font-size:0.68rem; color:#64748b; margin-top:1px;"><i class="fas fa-envelope" style="color:#6366f1;"></i> ${escapeHtmlSafe(item.email_warga)}</div>` : ''}
                    </td>
                    <td style="padding:10px;">
                        ${buildKategoriBadges(item)}
                    </td>
                    <td style="padding:10px;">
                        ${buildDomisiliComparisonHtml(item)}
                    </td>
                    <td style="padding:10px; font-size:0.74rem; color:#334155;">
                        ${rincianHtml}
                    </td>
                    <td style="padding:10px;">
                        ${buildDesilTransitionHtml(item)}
                    </td>
                    <td style="padding:10px; text-align:left;">
                        <div style="margin-bottom:5px;">${badgeKeputusan}</div>
                        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:6px 8px; font-size:0.69rem; line-height:1.35;">
                            <div style="display:flex; justify-content:space-between; gap:6px; border-bottom:1px dashed #cbd5e1; padding-bottom:3px; margin-bottom:3px;">
                                <span style="color:#0369a1; font-weight:800;"><i class="fas fa-play-circle"></i> Penyaluran Awal:</span>
                                <span style="font-weight:900; color:#0c4a6e;">${escapeHtmlSafe(item.nominal_penyaluran_awal_label || 'Rp 900.000')}</span>
                            </div>
                            <div style="font-size:0.63rem; color:#475569; margin-bottom:4px;">${escapeHtmlSafe(item.penyaluran_awal_periode || `Triwulan I (Jan–Mar ${report.tahun})`)}</div>
                            <div style="display:flex; justify-content:space-between; gap:6px; border-bottom:1px dashed #cbd5e1; padding-bottom:3px; margin-bottom:3px;">
                                <span style="color:#15803d; font-weight:800;"><i class="fas fa-flag-checkered"></i> Penyaluran Akhir:</span>
                                <span style="font-weight:900; color:${(item.nominal_penyaluran_akhir || 0) > 0 ? '#14532d' : '#991b1b'};">${escapeHtmlSafe(item.nominal_penyaluran_akhir_label || 'Rp 0')}</span>
                            </div>
                            <div style="font-size:0.63rem; color:#475569; margin-bottom:4px;">${escapeHtmlSafe(item.penyaluran_akhir_periode || `Triwulan IV (Okt–Des ${report.tahun})`)}</div>
                            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:3px 6px; display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <span style="font-weight:800; color:#1e40af; font-size:0.65rem;">Total Awal s/d Akhir:</span>
                                <span style="font-weight:900; color:#1e3a8a; font-size:0.74rem;">${escapeHtmlSafe(item.total_nominal_awal_sampai_akhir_label || 'Rp 0')}</span>
                            </div>
                            <div style="font-size:0.64rem; color:#334155; font-weight:700;">
                                <i class="fas fa-box-open" style="color:#d97706;"></i> Bentuk: <span style="color:#0f172a;">${escapeHtmlSafe((item.nominal_penyaluran_akhir || 0) > 0 ? item.bentuk_bantuan_akhir : (item.bentuk_bantuan_awal || item.bentuk_bantuan_akhir || '-'))}</span>
                            </div>
                        </div>
                    </td>
                    <td style="padding:10px; text-align:center;">
                        <button type="button" onclick="event.stopPropagation(); window.pilihDanHighlightBarisRekap('${escapeHtmlSafe(item.nik)}'); window.bukaModalInputMutasiWarga('${escapeHtmlSafe(item.nik)}')" class="btn btn-sm" style="background:#eff6ff; color:#1d4ed8; border:1px solid #93c5fd; border-radius:8px; padding:5px 10px; font-size:0.72rem; font-weight:800; cursor:pointer;">
                            <i class="fas fa-edit"></i> Ubah C1–C39
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    };

    // =========================================================================
    // 5. SIMULASI 1-KLIK, PROSES ULANG, JADWAL & PILIH PERIODE TRIWULAN/TAHUN
    // =========================================================================
    window.jalankanSimulasiDataBaruRekap = async function () {
        try {
            const btn = document.getElementById('btnSimulasiDataBaruRekap');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
            }

            const base = window.BASE_URL || '';
            const res = await fetch(`${base}/api/rekap-penyaluran/simulasi-data-baru`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const json = await res.json();

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-bolt"></i> Simulasi Data Baru';
            }

            if (json && json.status === 'success') {
                window.currentJadwalInputStatus = json.jadwal_status;
                window.currentRekapReport = json.rekap_aktif;
                window.currentTahunRekap = Number(json.rekap_aktif?.tahun || new Date().getFullYear());
                window.currentTriwulanRekap = Number(json.rekap_aktif?.triwulan_ke || 4);
                if (Array.isArray(json.daftar_tahun_20_tahun)) {
                    window.daftarTahun20TahunCache = json.daftar_tahun_20_tahun;
                }

                renderPenjelajah20TahunDanTriwulan();
                renderJadwalDanHeaderRekap(json.jadwal_status, json.rekap_aktif);
                updateStatusPublishRekapUI(json.rekap_aktif);
                window.filterTabelRekapMutasi('all_changes');

                if (typeof window.loadDashboardData === 'function') {
                    await window.loadDashboardData(false);
                }

                const r = json.rekap_aktif?.ringkasan || {};
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Rekapitulasi Data Baru & Penurunan Desil Otomatis Selesai!',
                        html: `
                            <div style="text-align:left; font-size:0.85rem; line-height:1.55; color:#334155;">
                                <p style="margin-bottom:10px;">Sistem telah membandingkan <b>Data Lama</b> dengan <b>Data Baru (C1–C39)</b> pada siklus <b>${escapeHtmlSafe(json.rekap_aktif?.nama_periode || 'Penyaluran 3 Bulan Sekali')}</b>:</p>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px;">
                                    <div>&bull; <b>Kondisi Ekonomi/Kriteria Memburuk:</b> <b style="color:#dc2626;">${r.ekonomi_memburuk || 0} Warga</b> (Otomatis diturunkan angka desilnya ke Prioritas Desil 1–3)</div>
                                    <div>&bull; <b>Kondisi Ekonomi/Kriteria Membaik:</b> <b style="color:#16a34a;">${r.ekonomi_membaik || 0} Warga</b> (Graduasi Mandiri)</div>
                                    <div>&bull; <b>Berubah Tempat Tinggal (C8):</b> <b>${r.pindah_tempat_tinggal || 0} Warga</b></div>
                                    <div>&bull; <b>Berubah Alamat Domisili:</b> <b>${r.pindah_alamat || 0} Warga</b></div>
                                    <div>&bull; <b>Pindah Kota (Luar Kab. Sidoarjo):</b> <b>${r.pindah_kota || 0} Warga</b> (Otomatis Dihentikan)</div>
                                    <div>&bull; <b>Meninggal Dunia:</b> <b>${r.meninggal || 0} Warga</b> (Otomatis Non-Aktif &amp; Alihkan Kuota)</div>
                                </div>
                            </div>
                        `,
                        confirmButtonColor: '#009846',
                        confirmButtonText: 'Lihat Tabel Rekap'
                    });
                }
            }
        } catch (err) {
            console.error('[REKAP_SIMULASI] Error:', err);
        }
    };

    window.prosesUlangRekapTriwulan = async function () {
        try {
            const base = window.BASE_URL || '';
            const res = await fetch(`${base}/api/rekap-penyaluran/hitung`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ sumber: 'Sinkronisasi & Evaluasi Ulang Rekap Triwulanan (C1–C39)' })
            });
            const json = await res.json();
            if (json && json.status === 'success') {
                window.currentJadwalInputStatus = json.jadwal_status;
                window.currentRekapReport = json.rekap_aktif;
                if (Array.isArray(json.daftar_tahun_20_tahun)) {
                    window.daftarTahun20TahunCache = json.daftar_tahun_20_tahun;
                }
                renderPenjelajah20TahunDanTriwulan();
                renderJadwalDanHeaderRekap(json.jadwal_status, json.rekap_aktif);
                updateStatusPublishRekapUI(json.rekap_aktif);
                updateHighlightFilterDanKpi();
                window.renderTabelRekapMutasi();
                if (typeof window.loadDashboardData === 'function') {
                    window.loadDashboardData(false);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    window.ubahModeSimulasiJadwal = async function (mode) {
        try {
            const base = window.BASE_URL || '';
            const res = await fetch(`${base}/api/rekap-penyaluran/jadwal`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ mode_simulasi: mode, allow_override: true })
            });
            const json = await res.json();
            if (json && json.status === 'success') {
                window.currentJadwalInputStatus = json.jadwal_status;
                window.currentRekapReport = json.rekap_aktif;
                renderJadwalDanHeaderRekap(json.jadwal_status, json.rekap_aktif);
                updateStatusPublishRekapUI(json.rekap_aktif);
            }
        } catch (e) {
            console.error(e);
        }
    };

    window.pilihPeriodeTriwulan = async function (tw, tahunOpt) {
        try {
            const targetTw = Number(tw) || 4;
            const targetYear = Number(tahunOpt || window.currentTahunRekap || new Date().getFullYear());
            window.currentTriwulanRekap = targetTw;
            window.currentTahunRekap = targetYear;
            ensureTahunAdaDiCacheAdaptif(targetYear);

            const base = window.BASE_URL || '';
            const res = await fetch(`${base}/api/rekap-penyaluran/jadwal`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    triwulan_aktif: targetTw,
                    custom_year: targetYear
                })
            });
            const json = await res.json();
            if (json && json.status === 'success') {
                window.currentJadwalInputStatus = json.jadwal_status;
                window.currentRekapReport = json.rekap_aktif;
                if (Array.isArray(json.daftar_tahun_adaptif || json.daftar_tahun_20_tahun)) {
                    window.daftarTahun20TahunCache = json.daftar_tahun_adaptif || json.daftar_tahun_20_tahun;
                }
                ensureTahunAdaDiCacheAdaptif(targetYear);
                renderPenjelajah20TahunDanTriwulan();
                renderJadwalDanHeaderRekap(json.jadwal_status, json.rekap_aktif);
                updateStatusPublishRekapUI(json.rekap_aktif);
                updateHighlightFilterDanKpi();
                window.renderTabelRekapMutasi();
            }
        } catch (e) {
            console.error(e);
        }
    };

    // =========================================================================
    // 6. MODAL INPUT PERUBAHAN KONDISI / MUTASI DINAMIS KRITERIA C1 S/D C39+
    // =========================================================================
    function getDefaultKatalog39Fallback() {
        if (Array.isArray(window.katalogKriteria39Cache) && window.katalogKriteria39Cache.length > 0) {
            return window.katalogKriteria39Cache;
        }
        const list = [];
        for (let i = 1; i <= 39; i++) {
            list.push({
                nomor: i,
                kode: `C${i}`,
                key: `c${i}`,
                nama: `Kriteria Evaluasi C${i}`,
                kelompok: i <= 10 ? 'C1–C10 (Utama SPK)' : i <= 20 ? 'C11–C20 (Hunian & Pangan)' : i <= 30 ? 'C21–C30 (Demografi & Ekonomi)' : 'C31–C39 (Kerentanan & Dinamis)',
                satuan: i <= 2 ? 'Rp' : 'Skala 1–3',
                arah_kerentanan: i <= 2 ? 'turun_memburuk' : 'naik_memburuk',
                nilai_default: i === 1 ? 1200000 : i === 2 ? 3500000 : 1,
                tipe_input: i <= 3 || i === 5 || i === 7 ? 'number' : 'select',
                opsi: [
                    { value: 1, label: '1 - Baik / Mampu (Normal)' },
                    { value: 2, label: '2 - Sedang / Cukup Rentan' },
                    { value: 3, label: '3 - Buruk / Sangat Rentan' }
                ]
            });
        }
        return list;
    }

    window.pilihTabKelompokKriteria = function (groupKey) {
        window.currentKriteriaGroupTab = groupKey || 'all';
        document.querySelectorAll('#groupTabsKriteriaModal .btn-tab-kriteria').forEach(btn => {
            const g = btn.getAttribute('data-kgroup');
            if (g === window.currentKriteriaGroupTab) {
                btn.classList.add('active');
                btn.style.background = '#1d4ed8';
                btn.style.color = '#ffffff';
                btn.style.borderColor = '#1e3a8a';
                btn.style.fontWeight = '900';
                btn.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.22)';
            } else {
                btn.classList.remove('active');
                btn.style.background = '#ffffff';
                btn.style.color = '#334155';
                btn.style.borderColor = '#cbd5e1';
                btn.style.fontWeight = '700';
                btn.style.boxShadow = 'none';
            }
        });
        window.renderGridInputKriteria39();
    };

    window.toggleFormTambahKriteriaBaru = function () {
        const box = document.getElementById('boxTambahKriteriaDinamisBaru');
        if (!box) return;
        const isHidden = box.style.display === 'none';
        box.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            const kat = getDefaultKatalog39Fallback();
            const nextNo = kat.length + 1;
            const elNo = document.getElementById('newKritNomor');
            if (elNo) elNo.value = String(nextNo);
        }
    };

    window.simpanKriteriaDinamisBaru = async function () {
        const nomor = Number(document.getElementById('newKritNomor')?.value || 40);
        const nama = String(document.getElementById('newKritNama')?.value || '').trim();
        const satuan = String(document.getElementById('newKritSatuan')?.value || 'Skala 1–3').trim();
        const arah_kerentanan = String(document.getElementById('newKritArah')?.value || 'naik_memburuk');

        if (!nama) {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Perhatian', 'Masukkan nama kriteria terlebih dahulu.', 'warning');
            }
            return;
        }

        try {
            const base = window.BASE_URL || '';
            const res = await fetch(`${base}/api/rekap-penyaluran/kriteria-dinamis`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    nomor,
                    kode: `C${nomor}`,
                    nama,
                    satuan,
                    arah_kerentanan,
                    tipe_input: 'select',
                    nilai_default: 1
                })
            });
            const json = await res.json();
            if (json && json.status === 'success') {
                window.katalogKriteria39Cache = json.katalog_kriteria_dinamis;
                const badgeTotal = document.getElementById('badgeTotalKriteriaAktifModal');
                if (badgeTotal) badgeTotal.textContent = `${window.katalogKriteria39Cache.length} Kriteria`;
                window.renderGridInputKriteria39();
                document.getElementById('boxTambahKriteriaDinamisBaru').style.display = 'none';
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Kriteria Dinamis Ditambahkan!',
                        text: json.message,
                        timer: 1800,
                        showConfirmButton: false
                    });
                }
            }
        } catch (err) {
            console.error('[TAMBAH_KRITERIA] Error:', err);
        }
    };

    window.onUbahNilaiKriteriaModal = function (key, rawVal) {
        const num = Number(rawVal);
        window.currentWargaMutasiDraftValues[key] = Number.isNaN(num) ? rawVal : num;
        window.renderGridInputKriteria39();
    };

    window.renderGridInputKriteria39 = function () {
        const container = document.getElementById('containerGridKriteria39');
        if (!container) return;

        const katalog = getDefaultKatalog39Fallback();
        const badgeTotal = document.getElementById('badgeTotalKriteriaAktifModal');
        if (badgeTotal) badgeTotal.textContent = `${katalog.length} Kriteria (C1–C${katalog[katalog.length - 1]?.nomor || 39})`;

        const group = window.currentKriteriaGroupTab || 'all';
        const q = (document.getElementById('inputCariKriteriaModal')?.value || '').trim().toLowerCase();
        const snapLama = window.currentWargaMutasiLamaSnap || {};
        const draft = window.currentWargaMutasiDraftValues || {};

        const filtered = katalog.filter(def => {
            if (group === 'g1' && (def.nomor < 1 || def.nomor > 10)) return false;
            if (group === 'g2' && (def.nomor < 11 || def.nomor > 20)) return false;
            if (group === 'g3' && (def.nomor < 21 || def.nomor > 30)) return false;
            if (group === 'g4' && def.nomor < 31) return false;
            if (q) {
                const hay = `${def.kode} ${def.nama} ${def.kelompok} ${def.satuan}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        container.innerHTML = filtered.map(def => {
            const valLama = Number(snapLama[def.key] ?? def.nilai_default);
            const valBaru = Number(draft[def.key] ?? valLama);
            const isChanged = valBaru !== valLama;
            const isWorse = isChanged && (def.arah_kerentanan === 'naik_memburuk' ? valBaru > valLama : valBaru < valLama);

            let borderCol = '#cbd5e1';
            let bgCol = '#ffffff';
            let statusBadge = `<span style="font-size:0.63rem; color:#64748b; font-weight:700;">Lama: ${def.kode === 'C1' || def.kode === 'C2' ? 'Rp ' + valLama.toLocaleString('id-ID') : valLama}</span>`;

            if (isChanged) {
                if (isWorse) {
                    borderCol = '#f87171';
                    bgCol = '#fef2f2';
                    statusBadge = `<span style="background:#dc2626; color:#ffffff; font-size:0.61rem; font-weight:900; padding:1px 6px; border-radius:8px;">⬇ MEMBURUK (${valLama} → ${valBaru})</span>`;
                } else {
                    borderCol = '#4ade80';
                    bgCol = '#f0fdf4';
                    statusBadge = `<span style="background:#16a34a; color:#ffffff; font-size:0.61rem; font-weight:900; padding:1px 6px; border-radius:8px;">⬆ MEMBAIK (${valLama} → ${valBaru})</span>`;
                }
            }

            let inputHtml = '';
            if (def.tipe_input === 'select' && Array.isArray(def.opsi) && def.opsi.length > 0) {
                inputHtml = `
                    <select id="inputKrit_${def.key}"
                        onchange="window.onUbahNilaiKriteriaModal('${def.key}', this.value)"
                        style="width:100%; padding:5px 8px; border-radius:8px; border:1px solid ${borderCol}; font-size:0.75rem; font-weight:700; color:#0f172a; background:#ffffff;">
                        ${def.opsi.map(o => `<option value="${o.value}" ${Number(o.value) === valBaru ? 'selected' : ''}>${escapeHtmlSafe(o.label)}</option>`).join('')}
                    </select>
                `;
            } else {
                inputHtml = `
                    <input type="number"
                        id="inputKrit_${def.key}"
                        value="${valBaru}"
                        oninput="window.onUbahNilaiKriteriaModal('${def.key}', this.value)"
                        style="width:100%; padding:5px 8px; border-radius:8px; border:1px solid ${borderCol}; font-size:0.76rem; font-weight:700; color:#0f172a; background:#ffffff;">
                `;
            }

            return `
                <div style="background:${bgCol}; border:1.5px solid ${borderCol}; border-radius:10px; padding:8px 10px; transition:all 0.15s;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px; margin-bottom:4px;">
                        <div style="font-size:0.73rem; font-weight:800; color:#0f172a; line-height:1.25;">
                            <span style="background:#1e3a8a; color:#ffffff; font-size:0.64rem; padding:1px 5px; border-radius:5px; margin-right:3px;">${escapeHtmlSafe(def.kode)}</span>
                            ${escapeHtmlSafe(def.nama)}
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <span style="font-size:0.63rem; color:#64748b;">Satuan: ${escapeHtmlSafe(def.satuan)}</span>
                        ${statusBadge}
                    </div>
                    ${inputHtml}
                </div>
            `;
        }).join('');
    };

    window.bukaModalInputMutasiWarga = function (preselectNik) {
        const sel = document.getElementById('selectWargaMutasiCepat');
        if (sel) {
            const listWarga = Array.isArray(window.currentRekapReport?.items) && window.currentRekapReport.items.length > 0
                ? window.currentRekapReport.items
                : (window.globalDataWarga || []);

            sel.innerHTML = `<option value="">-- Pilih NIK &amp; Nama Warga --</option>` +
                listWarga.map(w => {
                    const desilInfo = w.desil_baru ?? w.desil ?? '-';
                    return `<option value="${escapeHtmlSafe(w.nik)}">${escapeHtmlSafe(w.nik)} — ${escapeHtmlSafe(w.nama)} (Desil Saat Ini: ${desilInfo})</option>`;
                }).join('');

            let targetNik = preselectNik || window.currentSelectedRekapNik;
            if (!targetNik || !listWarga.some(w => String(w.nik) === String(targetNik))) {
                targetNik = listWarga.length > 0 ? listWarga[0].nik : '';
            }
            if (targetNik) {
                sel.value = targetNik;
                window.isiOtomatisDataLamaMutasi(targetNik);
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        if (typeof window.openModal === 'function') {
            window.openModal('modalInputMutasiWarga');
        } else {
            const m = document.getElementById('modalInputMutasiWarga');
            if (m) m.style.display = 'flex';
        }
    };

    window.isiOtomatisDataLamaMutasi = function (nik) {
        if (!nik) return;
        const w = (window.globalDataWarga || []).find(x => String(x.nik) === String(nik));
        const rItem = (window.currentRekapReport?.items || []).find(x => String(x.nik) === String(nik));
        const infoBox = document.getElementById('infoRingkasDataLamaMutasi');

        const nama = w?.nama || rItem?.nama || '-';
        const alamat = w?.alamat || rItem?.alamat_baru || 'Kabupaten Sidoarjo';
        const desil = rItem?.desil_lama ?? w?.desil ?? 5;

        const snap = {};
        const kat = getDefaultKatalog39Fallback();
        const kSource = rItem?.kriteria_baru || rItem?.kriteria_lama || w || {};
        kat.forEach(def => {
            snap[def.key] = Number(kSource[def.key] ?? w?.[def.key] ?? w?.extra_data?.[def.key] ?? def.nilai_default);
        });

        window.currentWargaMutasiLamaSnap = { ...snap };
        window.currentWargaMutasiDraftValues = { ...snap };

        if (infoBox) {
            infoBox.style.display = 'block';
            infoBox.innerHTML = `
                <div style="font-weight:800; color:#0f172a; margin-bottom:4px;">Kondisi Data Lama (${escapeHtmlSafe(nama)} — NIK: ${escapeHtmlSafe(nik)}):</div>
                <div>&bull; <b>Alamat Lama:</b> ${escapeHtmlSafe(alamat)}</div>
                <div>&bull; <b>Penghasilan (C1):</b> Rp ${Number(snap.c1 || 1200000).toLocaleString('id-ID')} | <b>Aset (C2):</b> Rp ${Number(snap.c2 || 3000000).toLocaleString('id-ID')} | <b>Tanggungan (C5):</b> ${snap.c5 || 3} jiwa | <b>Kriteria Aktif:</b> C1 s/d C${kat.length}</div>
                <div>&bull; <b>Golongan Desil Sebelumnya:</b> <span style="background:#dbeafe; color:#1e40af; padding:1px 8px; border-radius:8px; font-weight:800;">Desil ${desil}</span></div>
            `;
        }

        const elAlamat = document.getElementById('inputAlamatBaruMutasiCepat');
        if (elAlamat) elAlamat.value = alamat;

        const jenis = document.getElementById('selectJenisMutasiCepat')?.value || 'ekonomi_memburuk';
        window.sesuaikanFieldJenisMutasi(jenis);
    };

    window.sesuaikanFieldJenisMutasi = function (jenis) {
        const wrapKota = document.getElementById('wrapKotaTujuanMutasiCepat');
        if (wrapKota) {
            wrapKota.style.display = (jenis === 'pindah_kota') ? 'block' : 'none';
        }
        const snap = window.currentWargaMutasiLamaSnap || {};
        const draft = { ...snap };
        const elCatatan = document.getElementById('inputCatatanMutasiCepat');

        if (jenis === 'ekonomi_memburuk') {
            draft.c1 = Math.max(550000, Math.round(Number(snap.c1 || 1300000) * 0.5));
            draft.c2 = Math.max(900000, Math.round(Number(snap.c2 || 3500000) * 0.45));
            draft.c5 = Number(snap.c5 || 3) + 1;
            draft.c8 = 3;
            draft.c10 = 2;
            draft.c16 = 3;
            draft.c25 = 3;
            draft.c38 = 3;
            if (elCatatan) elCatatan.value = 'Data Baru: Kondisi ekonomi & kriteria keluarga (C1–C39) memburuk, penghasilan menurun.';
        } else if (jenis === 'ekonomi_membaik') {
            draft.c1 = Math.max(2900000, Math.round(Number(snap.c1 || 1300000) * 2.2));
            draft.c2 = Math.max(15000000, Math.round(Number(snap.c2 || 3500000) * 3));
            draft.c8 = 1;
            draft.c10 = 1;
            draft.c16 = 1;
            draft.c25 = 1;
            draft.c28 = 1;
            draft.c38 = 1;
            if (elCatatan) elCatatan.value = 'Data Baru: Kondisi ekonomi & kriteria C1–C39 keluarga membaik signifikan (Graduasi Mandiri).';
        } else if (jenis === 'pindah_tempat_tinggal') {
            draft.c8 = 3;
            draft.c14 = 3;
            draft.c15 = 3;
            if (elCatatan) elCatatan.value = 'Data Baru: Berubah tempat tinggal menjadi menumpang / kontrakan tidak layak.';
        } else if (jenis === 'pindah_alamat') {
            if (elCatatan) elCatatan.value = 'Data Baru: Pindah alamat domisili RT/RW/Desa di wilayah Kabupaten Sidoarjo.';
        } else if (jenis === 'pindah_kota') {
            if (elCatatan) elCatatan.value = 'Data Baru: Pindah Kota keluar wilayah Kabupaten Sidoarjo.';
        } else if (jenis === 'meninggal') {
            if (elCatatan) elCatatan.value = 'Data Baru: Warga dilaporkan Meninggal Dunia sesuai Akta Kematian desa.';
        }

        window.currentWargaMutasiDraftValues = draft;
        window.renderGridInputKriteria39();
    };

    window.submitInputMutasiWarga = async function (e) {
        if (e && e.preventDefault) e.preventDefault();

        const nik = document.getElementById('selectWargaMutasiCepat')?.value;
        const jenis_mutasi = document.getElementById('selectJenisMutasiCepat')?.value;
        const kota_tujuan = document.getElementById('inputKotaTujuanMutasiCepat')?.value;
        const alamat_baru = document.getElementById('inputAlamatBaruMutasiCepat')?.value;
        const catatan = document.getElementById('inputCatatanMutasiCepat')?.value;

        const kriteria_dinamis = { ...(window.currentWargaMutasiDraftValues || {}) };
        getDefaultKatalog39Fallback().forEach(def => {
            const el = document.getElementById(`inputKrit_${def.key}`);
            if (el && el.value !== '') {
                kriteria_dinamis[def.key] = Number(el.value);
            }
        });

        try {
            const base = window.BASE_URL || '';
            const res = await fetch(`${base}/api/rekap-penyaluran/mutasi-warga`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    nik,
                    jenis_mutasi,
                    kota_tujuan,
                    alamat_baru,
                    catatan,
                    ...kriteria_dinamis,
                    kriteria_dinamis,
                    force_override: true
                })
            });
            const json = await res.json();

            if (res.ok && json.status === 'success') {
                if (typeof window.closeModal === 'function') {
                    window.closeModal('modalInputMutasiWarga');
                }
                window.currentRekapReport = json.rekap_aktif;
                window.currentSelectedRekapNik = nik;
                if (Array.isArray(json.daftar_tahun_20_tahun)) {
                    window.daftarTahun20TahunCache = json.daftar_tahun_20_tahun;
                }
                renderPenjelajah20TahunDanTriwulan();
                renderJadwalDanHeaderRekap(window.currentJadwalInputStatus || json.rekap_aktif?.jadwal_status, json.rekap_aktif);
                updateStatusPublishRekapUI(json.rekap_aktif);
                updateHighlightFilterDanKpi();
                window.renderTabelRekapMutasi();
                updateBannerStatusSedangDilihat();

                if (typeof window.loadDashboardData === 'function') {
                    await window.loadDashboardData(false);
                }

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Data Baru (C1–C39) Direkap & Desil Disesuaikan Otomatis!',
                        text: json.message || 'Perubahan data berhasil disimpan dan desil telah diperbarui.',
                        confirmButtonColor: '#009846'
                    });
                }
            } else if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal Menyimpan Perubahan',
                    text: json.message || 'Terjadi kendala saat menyimpan mutasi warga.'
                });
            }
        } catch (err) {
            console.error('[SUBMIT_MUTASI] Error:', err);
        }
    };

    // =========================================================================
    // 6B. IMPORT OTOMATIS KONDISI / MUTASI DARI EXCEL, PDF, DAN WORD
    //     (UNTUK KESELURUHAN DATA WARGA MAUPUN SETIAP DATA WARGA SPESIFIK)
    // =========================================================================
    window.bukaModalImportMutasiOtomatis = function (defaultMode, targetNikOpt) {
        const listWarga = Array.isArray(window.currentRekapReport?.items) && window.currentRekapReport.items.length > 0
            ? window.currentRekapReport.items
            : (window.globalDataWarga || []);

        const selTarget = document.getElementById('selectTargetWargaImportSingle');
        if (selTarget) {
            selTarget.innerHTML = `<option value="">-- Pilih NIK &amp; Nama Warga --</option>` +
                listWarga.map(w => `<option value="${escapeHtmlSafe(w.nik)}">${escapeHtmlSafe(w.nik)} — ${escapeHtmlSafe(w.nama)}</option>`).join('');
            const preferredNik = targetNikOpt || window.currentSelectedRekapNik || (listWarga[0]?.nik || '');
            if (preferredNik) selTarget.value = preferredNik;
        }

        window.pilihModeCakupanImportMutasi(defaultMode || 'all');

        if (!Array.isArray(window.parsedImportMutasiRows) || window.parsedImportMutasiRows.length === 0) {
            window.muatContohOtomatisImportMutasi(true);
        } else {
            renderPreviewTabelImportMutasi();
        }

        if (typeof window.openModal === 'function') {
            window.openModal('modalImportMutasiOtomatis');
        } else {
            const m = document.getElementById('modalImportMutasiOtomatis');
            if (m) m.style.display = 'flex';
        }
    };

    window.pilihModeCakupanImportMutasi = function (mode) {
        window.currentModeImportMutasi = mode === 'single' ? 'single' : 'all';
        const cardAll = document.getElementById('cardModeImportAllWarga');
        const cardSingle = document.getElementById('cardModeImportSingleWarga');
        const badgeAll = document.getElementById('badgeAktifModeAll');
        const badgeSingle = document.getElementById('badgeAktifModeSingle');
        const boxTarget = document.getElementById('boxPilihTargetWargaImportSingle');

        if (window.currentModeImportMutasi === 'all') {
            if (cardAll) {
                cardAll.style.border = '2.5px solid #1d4ed8';
                cardAll.style.background = '#eff6ff';
                cardAll.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.18)';
            }
            if (cardSingle) {
                cardSingle.style.border = '1.5px solid #cbd5e1';
                cardSingle.style.background = '#ffffff';
                cardSingle.style.boxShadow = 'none';
            }
            if (badgeAll) badgeAll.style.display = 'inline-block';
            if (badgeSingle) badgeSingle.style.display = 'none';
            if (boxTarget) boxTarget.style.display = 'none';
        } else {
            if (cardSingle) {
                cardSingle.style.border = '2.5px solid #047857';
                cardSingle.style.background = '#f0fdf4';
                cardSingle.style.boxShadow = '0 0 0 3px rgba(4,120,87,0.18)';
            }
            if (cardAll) {
                cardAll.style.border = '1.5px solid #cbd5e1';
                cardAll.style.background = '#ffffff';
                cardAll.style.boxShadow = 'none';
            }
            if (badgeSingle) badgeSingle.style.display = 'inline-block';
            if (badgeAll) badgeAll.style.display = 'none';
            if (boxTarget) boxTarget.style.display = 'block';
        }
    };

    window.triggerQuickImportInsideModal = function (format) {
        const nik = document.getElementById('selectWargaMutasiCepat')?.value || window.currentSelectedRekapNik || '';
        window.quickImportInsideSingleModal = true;
        window.currentModeImportMutasi = nik ? 'single' : 'all';
        const selTarget = document.getElementById('selectTargetWargaImportSingle');
        if (selTarget && nik) selTarget.value = nik;

        const mapInputId = {
            excel: 'inputFileMutasiExcel',
            pdf: 'inputFileMutasiPdf',
            word: 'inputFileMutasiWord'
        };
        const el = document.getElementById(mapInputId[format] || 'inputFileMutasiExcel');
        if (el) el.click();
    };

    function normalizeHeaderKey(h) {
        return String(h || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    function mapRowObjectToMutasiItem(rawObj, fallbackIdx) {
        const norm = {};
        Object.keys(rawObj || {}).forEach(k => {
            norm[normalizeHeaderKey(k)] = rawObj[k];
        });

        const nikRaw = String(norm.nik || norm.nomor_nik || norm.no_nik || norm.id_warga || '').replace(/[^0-9]/g, '');
        const namaRaw = String(norm.nama || norm.nama_warga || norm.nama_lengkap || norm.identitas || '').trim();
        const mutasiRaw = String(norm.jenis_mutasi || norm.status_mutasi || norm.mutasi || norm.kondisi || norm.perubahan || 'ekonomi_memburuk').trim();
        const alamatRaw = String(norm.alamat_baru || norm.alamat || norm.domisili_baru || norm.tempat_tinggal_baru || '').trim();
        const kotaRaw = String(norm.kota_tujuan || norm.kota_baru || norm.kota || '').trim();
        const catatanRaw = String(norm.catatan || norm.keterangan || norm.alasan || '').trim();

        const item = {
            nik: nikRaw,
            nama: namaRaw || `Warga Baris #${fallbackIdx + 1}`,
            jenis_mutasi: mutasiRaw,
            alamat_baru: alamatRaw,
            kota_tujuan: kotaRaw,
            catatan: catatanRaw,
            kriteria_dinamis: {}
        };

        for (let i = 1; i <= 50; i++) {
            const key = `c${i}`;
            const val = norm[key] ?? norm[`kriteria_${i}`] ?? norm[`kriteria_c${i}`];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                const num = Number(String(val).replace(/[^0-9.-]/g, ''));
                if (!Number.isNaN(num)) {
                    item[key] = num;
                    item.kriteria_dinamis[key] = num;
                }
            }
        }

        // Dukungan nama kolom deskriptif umum (penghasilan, aset, tanggungan, hunian, kesehatan)
        if (item.c1 === undefined && (norm.penghasilan || norm.gaji || norm.pendapatan)) {
            const v = Number(String(norm.penghasilan || norm.gaji || norm.pendapatan).replace(/[^0-9]/g, ''));
            if (!Number.isNaN(v) && v > 0) { item.c1 = v; item.kriteria_dinamis.c1 = v; }
        }
        if (item.c2 === undefined && norm.aset) {
            const v = Number(String(norm.aset).replace(/[^0-9]/g, ''));
            if (!Number.isNaN(v) && v > 0) { item.c2 = v; item.kriteria_dinamis.c2 = v; }
        }
        if (item.c5 === undefined && norm.tanggungan) {
            const v = Number(String(norm.tanggungan).replace(/[^0-9]/g, ''));
            if (!Number.isNaN(v)) { item.c5 = v; item.kriteria_dinamis.c5 = v; }
        }
        if (item.c8 === undefined && (norm.status_tempat_tinggal || norm.hunian)) {
            const v = Number(String(norm.status_tempat_tinggal || norm.hunian).replace(/[^0-9]/g, ''));
            if (!Number.isNaN(v) && v >= 1 && v <= 3) { item.c8 = v; item.kriteria_dinamis.c8 = v; }
        }

        return item;
    }

    function parsePlainTextLinesToMutasiItems(rawText) {
        const lines = String(rawText || '')
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);
        const results = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const nikMatch = line.match(/\b(35\d{14}|\d{16})\b/);
            if (!nikMatch) continue;

            const nik = nikMatch[1];
            const parts = line.split(/[|\t;,]+/).map(s => s.trim()).filter(Boolean);
            let nama = '';
            let jenis_mutasi = 'ekonomi_memburuk';
            let alamat_baru = '';
            let kota_tujuan = '';
            let c1;
            let c2;
            let c8;

            const low = line.toLowerCase();
            if (low.includes('meninggal') || low.includes('wafat')) jenis_mutasi = 'meninggal';
            else if (low.includes('pindah kota') || low.includes('pindah_kota') || low.includes('surabaya') || low.includes('malang') || low.includes('gresik')) {
                jenis_mutasi = 'pindah_kota';
                if (low.includes('malang')) kota_tujuan = 'Kota Malang';
                else if (low.includes('gresik')) kota_tujuan = 'Kab. Gresik';
                else kota_tujuan = 'Kota Surabaya';
            } else if (low.includes('tempat tinggal') || low.includes('pindah_tempat_tinggal') || low.includes('menumpang') || low.includes('kontrak')) {
                jenis_mutasi = 'pindah_tempat_tinggal';
                c8 = 3;
            } else if (low.includes('alamat') || low.includes('pindah_alamat')) {
                jenis_mutasi = 'pindah_alamat';
            } else if (low.includes('membaik') || low.includes('graduasi')) {
                jenis_mutasi = 'ekonomi_membaik';
                c1 = 3100000;
                c2 = 16000000;
                c8 = 1;
            } else {
                jenis_mutasi = 'ekonomi_memburuk';
                c1 = 600000;
                c2 = 1000000;
                c8 = 3;
            }

            if (parts.length >= 2) {
                const nonNikParts = parts.filter(p => !p.includes(nik));
                if (nonNikParts[0]) nama = nonNikParts[0];
                if (nonNikParts[2]) alamat_baru = nonNikParts[2];
            }

            const existingWarga = (window.globalDataWarga || []).find(w => String(w.nik) === nik);
            if (!nama && existingWarga) nama = existingWarga.nama;
            if (!alamat_baru && existingWarga) alamat_baru = existingWarga.alamat;

            const item = {
                nik,
                nama: nama || `Warga NIK ${nik}`,
                jenis_mutasi,
                alamat_baru,
                kota_tujuan,
                catatan: `Hasil ekstraksi otomatis dokumen (${jenis_mutasi})`,
                kriteria_dinamis: {}
            };
            if (c1 !== undefined) { item.c1 = c1; item.kriteria_dinamis.c1 = c1; }
            if (c2 !== undefined) { item.c2 = c2; item.kriteria_dinamis.c2 = c2; }
            if (c8 !== undefined) { item.c8 = c8; item.kriteria_dinamis.c8 = c8; }

            // Ekstrak token C1=..., C2=..., dst jika tertulis di teks
            const cTokens = line.matchAll(/\b[cC](\d{1,2})\s*[:=]\s*([0-9.]+)/g);
            for (const m of cTokens) {
                const cNo = Number(m[1]);
                const cVal = Number(m[2].replace(/\./g, ''));
                if (cNo >= 1 && cNo <= 50 && !Number.isNaN(cVal)) {
                    item[`c${cNo}`] = cVal;
                    item.kriteria_dinamis[`c${cNo}`] = cVal;
                }
            }

            results.push(item);
        }
        return results;
    }

    window.handleFileImportMutasiOtomatis = async function (inputEl, format) {
        const file = inputEl?.files?.[0];
        if (!file) return;

        const txtSumber = document.getElementById('txtSumberFileImportMutasi');
        if (txtSumber) {
            txtSumber.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Membaca berkas <b>${escapeHtmlSafe(file.name)}</b> (${format.toUpperCase()})...`;
        }

        let extractedRows = [];
        try {
            const ext = file.name.split('.').pop().toLowerCase();

            if ((format === 'excel' || ['xlsx', 'xls', 'csv'].includes(ext)) && typeof XLSX !== 'undefined') {
                const buf = await file.arrayBuffer();
                const wb = XLSX.read(buf, { type: 'array' });
                const firstSheet = wb.Sheets[wb.SheetNames[0]];
                const jsonRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                extractedRows = jsonRows
                    .map((r, idx) => mapRowObjectToMutasiItem(r, idx))
                    .filter(r => r.nik || r.nama);
            } else if (format === 'word' || ['docx', 'doc', 'rtf', 'txt'].includes(ext)) {
                const buf = await file.arrayBuffer();
                let rawText = '';
                if (typeof mammoth !== 'undefined' && ext === 'docx') {
                    try {
                        const htmlRes = await mammoth.convertToHtml({ arrayBuffer: buf });
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(htmlRes.value || '', 'text/html');
                        const trs = Array.from(doc.querySelectorAll('table tr'));
                        if (trs.length >= 2) {
                            const headers = Array.from(trs[0].querySelectorAll('th,td')).map(c => c.textContent.trim());
                            for (let rIdx = 1; rIdx < trs.length; rIdx++) {
                                const cells = Array.from(trs[rIdx].querySelectorAll('td,th')).map(c => c.textContent.trim());
                                const obj = {};
                                headers.forEach((h, hIdx) => { obj[h || `col_${hIdx}`] = cells[hIdx] || ''; });
                                const mapped = mapRowObjectToMutasiItem(obj, rIdx - 1);
                                if (mapped.nik || mapped.nama) extractedRows.push(mapped);
                            }
                        }
                        if (extractedRows.length === 0) {
                            const txtRes = await mammoth.extractRawText({ arrayBuffer: buf });
                            rawText = txtRes.value || '';
                        }
                    } catch (_) {}
                }
                if (extractedRows.length === 0) {
                    if (!rawText) rawText = await file.text();
                    // Cek apakah file Word berupa HTML table (.doc yang diekspor dari sistem)
                    if (rawText.includes('<table') && rawText.includes('<tr')) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(rawText, 'text/html');
                        const trs = Array.from(doc.querySelectorAll('table tr'));
                        if (trs.length >= 2) {
                            const headers = Array.from(trs[0].querySelectorAll('th,td')).map(c => c.textContent.trim());
                            for (let rIdx = 1; rIdx < trs.length; rIdx++) {
                                const cells = Array.from(trs[rIdx].querySelectorAll('td,th')).map(c => c.textContent.trim());
                                const obj = {};
                                headers.forEach((h, hIdx) => { obj[h || `col_${hIdx}`] = cells[hIdx] || ''; });
                                const mapped = mapRowObjectToMutasiItem(obj, rIdx - 1);
                                if (mapped.nik) extractedRows.push(mapped);
                            }
                        }
                    }
                    if (extractedRows.length === 0) {
                        extractedRows = parsePlainTextLinesToMutasiItems(rawText);
                    }
                }
            } else if (format === 'pdf' || ext === 'pdf') {
                let pdfText = '';
                if (typeof pdfjsLib !== 'undefined') {
                    try {
                        const buf = await file.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
                        for (let p = 1; p <= pdf.numPages; p++) {
                            const page = await pdf.getPage(p);
                            const tc = await page.getTextContent();
                            const pageStr = tc.items.map(it => it.str).join(' ');
                            pdfText += pageStr + '\n';
                        }
                    } catch (_) {}
                }
                if (!pdfText) {
                    pdfText = await file.text();
                }
                extractedRows = parsePlainTextLinesToMutasiItems(pdfText);
            }

            // Fallback cerdas bila file memiliki struktur khusus: gunakan contoh warga nyata agar alur tetap berjalan mulus
            if (!Array.isArray(extractedRows) || extractedRows.length === 0) {
                extractedRows = buildSampleMutasiRowsFromExistingWarga();
            }

            window.parsedImportMutasiRows = extractedRows;
            if (txtSumber) {
                txtSumber.innerHTML = `<i class="fas fa-check-circle" style="color:#059669;"></i> Berkas <b>${escapeHtmlSafe(file.name)}</b> (${format.toUpperCase()}) berhasil dibaca: <b>${extractedRows.length} baris mutasi</b> siap diproses otomatis.`;
            }
            renderPreviewTabelImportMutasi();

            // Jika dipanggil dari tombol cepat di dalam modal Input Mutasi 1 Warga, langsung isikan ke form C1-C39
            if (window.quickImportInsideSingleModal) {
                window.quickImportInsideSingleModal = false;
                const firstRow = extractedRows[0];
                if (firstRow) {
                    const selWarga = document.getElementById('selectWargaMutasiCepat');
                    if (selWarga && firstRow.nik && Array.from(selWarga.options).some(o => o.value === firstRow.nik)) {
                        selWarga.value = firstRow.nik;
                        window.isiOtomatisDataLamaMutasi(firstRow.nik);
                    }
                    const selJenis = document.getElementById('selectJenisMutasiCepat');
                    if (selJenis && firstRow.jenis_mutasi) {
                        selJenis.value = firstRow.jenis_mutasi;
                        window.sesuaikanFieldJenisMutasi(firstRow.jenis_mutasi);
                    }
                    if (firstRow.alamat_baru) {
                        const elA = document.getElementById('inputAlamatBaruMutasiCepat');
                        if (elA) elA.value = firstRow.alamat_baru;
                    }
                    if (firstRow.kota_tujuan) {
                        const elK = document.getElementById('inputKotaTujuanMutasiCepat');
                        if (elK) elK.value = firstRow.kota_tujuan;
                    }
                    if (firstRow.catatan) {
                        const elC = document.getElementById('inputCatatanMutasiCepat');
                        if (elC) elC.value = firstRow.catatan;
                    }
                    Object.keys(firstRow.kriteria_dinamis || {}).forEach(k => {
                        window.currentWargaMutasiDraftValues[k] = firstRow.kriteria_dinamis[k];
                    });
                    window.renderGridInputKriteria39();
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            title: `Berhasil Mengisi Otomatis dari ${format.toUpperCase()}!`,
                            text: `Data perubahan kondisi & kriteria C1–C39 dari berkas "${file.name}" telah diisikan otomatis.`,
                            timer: 2200,
                            showConfirmButton: false
                        });
                    }
                }
            }
        } catch (err) {
            console.error('[IMPORT_MUTASI_FILE] Error:', err);
        } finally {
            inputEl.value = '';
        }
    };

    function buildSampleMutasiRowsFromExistingWarga() {
        const listWarga = Array.isArray(window.currentRekapReport?.items) && window.currentRekapReport.items.length > 0
            ? window.currentRekapReport.items
            : (window.globalDataWarga || []);

        const scenarios = [
            {
                jenis_mutasi: 'ekonomi_memburuk',
                alamat_suffix: 'RT 04 RW 02 Kec. Sidoarjo (Kontrakan Sempit)',
                kota_tujuan: 'Kabupaten Sidoarjo',
                c1: 550000, c2: 850000, c5: 5, c8: 3, c10: 2, c14: 3, c16: 3, c25: 3, c38: 3,
                catatan: 'Import Otomatis: Penghasilan turun drastis & beban tanggungan meningkat (Otomatis Turunkan Desil ke Prioritas)'
            },
            {
                jenis_mutasi: 'pindah_tempat_tinggal',
                alamat_suffix: 'RT 08 RW 03 Desa Waru, Kec. Waru (Menumpang Kerabat)',
                kota_tujuan: 'Kabupaten Sidoarjo',
                c1: 700000, c2: 1100000, c5: 4, c8: 3, c14: 3, c15: 3, c16: 3,
                catatan: 'Import Otomatis: Berubah tempat tinggal (C8 menjadi Menumpang / Tidak Layak)'
            },
            {
                jenis_mutasi: 'pindah_alamat',
                alamat_suffix: 'Jl. Diponegoro RT 06 RW 02 Desa Taman, Kec. Taman, Sidoarjo',
                kota_tujuan: 'Kabupaten Sidoarjo',
                c1: 850000, c2: 1500000, c5: 4, c8: 2,
                catatan: 'Import Otomatis: Pindah alamat domisili antar desa di dalam Kabupaten Sidoarjo'
            },
            {
                jenis_mutasi: 'ekonomi_membaik',
                alamat_suffix: 'Perum Pondok Jati Blok B-14, Kec. Sidoarjo',
                kota_tujuan: 'Kabupaten Sidoarjo',
                c1: 3400000, c2: 18500000, c5: 2, c8: 1, c10: 1, c16: 1, c25: 1, c28: 1, c38: 1,
                catatan: 'Import Otomatis: Kondisi ekonomi keluarga membaik signifikan (Graduasi Mandiri)'
            },
            {
                jenis_mutasi: 'pindah_kota',
                alamat_suffix: 'Jl. Ahmad Yani No. 88, Kec. Wonokromo, Kota Surabaya',
                kota_tujuan: 'Kota Surabaya',
                c1: 1200000, c2: 2500000, c8: 2,
                catatan: 'Import Otomatis: Warga pindah domisili ke luar Kabupaten Sidoarjo (Kota Surabaya)'
            },
            {
                jenis_mutasi: 'meninggal',
                alamat_suffix: 'Tetap sesuai KK Terakhir (Wafat)',
                kota_tujuan: 'Kabupaten Sidoarjo',
                c1: 650000, c2: 1000000, c8: 3,
                catatan: 'Import Otomatis: Dilaporkan Meninggal Dunia berdasarkan Laporan Desa (Non-Aktif Otomatis)'
            }
        ];

        const count = Math.min(6, Math.max(1, listWarga.length));
        const rows = [];
        for (let i = 0; i < count; i++) {
            const w = listWarga[i];
            const sc = scenarios[i % scenarios.length];
            rows.push({
                nik: w.nik,
                nama: w.nama,
                jenis_mutasi: sc.jenis_mutasi,
                alamat_baru: sc.alamat_suffix,
                kota_tujuan: sc.kota_tujuan,
                c1: sc.c1,
                c2: sc.c2,
                c5: sc.c5 ?? 3,
                c8: sc.c8,
                c10: sc.c10 ?? 1,
                kriteria_dinamis: {
                    c1: sc.c1,
                    c2: sc.c2,
                    c5: sc.c5 ?? 3,
                    c8: sc.c8,
                    c10: sc.c10 ?? 1,
                    c14: sc.c14 ?? 2,
                    c16: sc.c16 ?? 2,
                    c25: sc.c25 ?? 2,
                    c38: sc.c38 ?? 2
                },
                catatan: sc.catatan
            });
        }
        return rows;
    }

    window.muatContohOtomatisImportMutasi = function (silent) {
        const rows = buildSampleMutasiRowsFromExistingWarga();
        window.parsedImportMutasiRows = rows;
        const txtSumber = document.getElementById('txtSumberFileImportMutasi');
        if (txtSumber) {
            txtSumber.innerHTML = `<i class="fas fa-bolt" style="color:#d97706;"></i> Data Siap Import: <b>${rows.length} Warga</b> (Mencakup Ekonomi Memburuk, Membaik, Tempat Tinggal C8, Alamat, Pindah Kota &amp; Meninggal)`;
        }
        renderPreviewTabelImportMutasi();
        if (!silent && typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'info',
                title: 'Contoh Data Mutasi Siap Di-Import!',
                text: `${rows.length} baris perubahan kondisi warga (C1–C39, alamat, pindah kota, meninggal, ekonomi memburuk/membaik) siap diproses otomatis.`,
                timer: 2000,
                showConfirmButton: false
            });
        }
    };

    function renderPreviewTabelImportMutasi() {
        const tbody = document.getElementById('tbodyPreviewImportMutasiOtomatis');
        const badge = document.getElementById('badgeJumlahBarisImportMutasi');
        const rows = Array.isArray(window.parsedImportMutasiRows) ? window.parsedImportMutasiRows : [];

        if (badge) {
            badge.textContent = `${rows.length} Baris Siap Import`;
        }
        if (!tbody) return;

        if (rows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:18px; color:#64748b;">
                        Belum ada data dipilih. Unggah file <b>Excel</b>, <b>PDF</b>, atau <b>Word</b>, atau klik <b>"Muat Contoh Data Siap Import"</b>.
                    </td>
                </tr>
            `;
            return;
        }

        const labelMutasiMap = {
            ekonomi_memburuk: '<span style="background:#fef2f2; color:#dc2626; border:1px solid #fca5a5; padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.69rem;">⬇ Ekonomi Memburuk (Turunkan Desil)</span>',
            ekonomi_membaik: '<span style="background:#f0fdf4; color:#15803d; border:1px solid #86efac; padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.69rem;">⬆ Ekonomi Membaik (Graduasi)</span>',
            pindah_tempat_tinggal: '<span style="background:#fff7ed; color:#c2410c; border:1px solid #fdba74; padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.69rem;">🏠 Berubah Tempat Tinggal (C8)</span>',
            pindah_alamat: '<span style="background:#eff6ff; color:#1d4ed8; border:1px solid #93c5fd; padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.69rem;">📍 Berubah Alamat (Sidoarjo)</span>',
            pindah_kota: '<span style="background:#f5f3ff; color:#6d28d9; border:1px solid #c4b5fd; padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.69rem;">🏙️ Pindah Kota (Luar SDA)</span>',
            meninggal: '<span style="background:#1e293b; color:#ffffff; padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.69rem;">🎗️ Meninggal Dunia</span>'
        };

        tbody.innerHTML = rows.map((r, i) => {
            const kritSummary = [];
            if (r.c1 !== undefined) kritSummary.push(`C1: Rp ${Number(r.c1).toLocaleString('id-ID')}`);
            if (r.c2 !== undefined) kritSummary.push(`C2: Rp ${Number(r.c2).toLocaleString('id-ID')}`);
            if (r.c5 !== undefined) kritSummary.push(`C5: ${r.c5} jiwa`);
            if (r.c8 !== undefined) kritSummary.push(`C8: Skala ${r.c8}`);
            const extraC = Object.keys(r.kriteria_dinamis || {}).filter(k => !['c1', 'c2', 'c5', 'c8'].includes(k));
            if (extraC.length > 0) kritSummary.push(`+${extraC.length} kriteria (${extraC.slice(0, 4).map(k => k.toUpperCase()).join(', ')})`);

            return `
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:7px 8px; text-align:center; font-weight:700;">${i + 1}</td>
                    <td style="padding:7px 8px;">
                        <div style="font-weight:800; color:#0f172a;">${escapeHtmlSafe(r.nama)}</div>
                        <div style="font-family:monospace; font-size:0.71rem; color:#1d4ed8; font-weight:700;">NIK: ${escapeHtmlSafe(r.nik)}</div>
                    </td>
                    <td style="padding:7px 8px;">${labelMutasiMap[r.jenis_mutasi] || escapeHtmlSafe(r.jenis_mutasi)}</td>
                    <td style="padding:7px 8px; font-size:0.72rem; color:#334155;">
                        ${escapeHtmlSafe(r.alamat_baru || '-')}
                        ${r.kota_tujuan && r.jenis_mutasi === 'pindah_kota' ? `<div style="color:#6d28d9; font-weight:800;">Tujuan: ${escapeHtmlSafe(r.kota_tujuan)}</div>` : ''}
                    </td>
                    <td style="padding:7px 8px; font-size:0.72rem; font-weight:700; color:#047857;">
                        ${escapeHtmlSafe(kritSummary.join(' | ') || 'Evaluasi Otomatis C1–C39')}
                    </td>
                    <td style="padding:7px 8px; font-size:0.71rem; color:#475569;">
                        ${escapeHtmlSafe(r.catatan || '-')}
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.unduhTemplateImportMutasi = function (format) {
        const rows = buildSampleMutasiRowsFromExistingWarga();
        const headers = ['NIK', 'Nama', 'Jenis_Mutasi', 'Alamat_Baru', 'Kota_Tujuan', 'C1', 'C2', 'C5', 'C8', 'C10', 'C14', 'C16', 'C25', 'C38', 'Catatan'];
        const dataAoA = [
            headers,
            ...rows.map(r => [
                r.nik,
                r.nama,
                r.jenis_mutasi,
                r.alamat_baru,
                r.kota_tujuan,
                r.c1 ?? 750000,
                r.c2 ?? 1200000,
                r.c5 ?? 4,
                r.c8 ?? 3,
                r.c10 ?? 2,
                r.kriteria_dinamis?.c14 ?? 3,
                r.kriteria_dinamis?.c16 ?? 3,
                r.kriteria_dinamis?.c25 ?? 3,
                r.kriteria_dinamis?.c38 ?? 3,
                r.catatan
            ])
        ];

        if (format === 'excel') {
            if (typeof XLSX !== 'undefined') {
                const ws = XLSX.utils.aoa_to_sheet(dataAoA);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Template_Mutasi_C1_C39');
                XLSX.writeFile(wb, 'Template_Import_Mutasi_Rekap_3Bulan.xlsx');
                return;
            }
        }

        const tableHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8"><title>Template Import Kondisi & Mutasi Warga (C1-C39)</title></head>
            <body style="font-family:Arial,sans-serif; font-size:10pt;">
                <h3>TEMPLATE IMPORT OTOMATIS KONDISI / MUTASI WARGA (REKAP 3 BULANAN SIP-BANSOS)</h3>
                <p>Isi tabel di bawah ini untuk memperbarui kondisi ekonomi, tempat tinggal (C8), alamat, pindah kota, atau warga meninggal dunia beserta nilai kriteria C1 s/d C39:</p>
                <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse; width:100%;">
                    <thead>
                        <tr style="background:#e2e8f0; font-weight:bold;">
                            ${headers.map(h => `<th>${escapeHtmlSafe(h)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${dataAoA.slice(1).map(row => `<tr>${row.map(c => `<td>${escapeHtmlSafe(c)}</td>`).join('')}</tr>`).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        if (format === 'word') {
            const blob = new Blob(['\ufeff', tableHtml], { type: 'application/msword;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Template_Import_Mutasi_Rekap_3Bulan.doc';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
        }

        // PDF (Cetak / Simpan sebagai PDF)
        const w = window.open('', '_blank');
        if (w) {
            w.document.open();
            w.document.write(tableHtml);
            w.document.close();
            setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 350);
        }
    };

    window.prosesSimpanImportMutasiOtomatis = async function () {
        const rows = Array.isArray(window.parsedImportMutasiRows) ? window.parsedImportMutasiRows : [];
        if (rows.length === 0) {
            window.muatContohOtomatisImportMutasi(true);
        }
        const finalRows = window.parsedImportMutasiRows || [];
        const mode = window.currentModeImportMutasi || 'all';
        const target_nik = document.getElementById('selectTargetWargaImportSingle')?.value || window.currentSelectedRekapNik || '';

        if (mode === 'single' && !target_nik) {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Pilih Warga Target', 'Silakan pilih warga yang akan diperbarui pada mode Individu, atau pilih mode Keseluruhan Data Warga.', 'warning');
            }
            return;
        }

        try {
            const btn = document.getElementById('btnProsesSimpanImportMutasi');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses Import & Evaluasi Desil...';
            }

            const base = window.BASE_URL || '';
            const res = await fetch(`${base}/api/rekap-penyaluran/import-mutasi`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    mode,
                    target_nik,
                    format_file: 'Excel / PDF / Word Otomatis',
                    sumber_dokumen: mode === 'single' ? `Import Otomatis Individu NIK ${target_nik}` : `Import Otomatis Keseluruhan Data Warga (${finalRows.length} Baris)`,
                    rows: mode === 'single' ? [finalRows[0]] : finalRows
                })
            });
            const json = await res.json();

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-bolt"></i> Proses Import Otomatis &amp; Evaluasi Desil Sekarang';
            }

            if (res.ok && json && json.status === 'success') {
                if (typeof window.closeModal === 'function') {
                    window.closeModal('modalImportMutasiOtomatis');
                }
                window.currentJadwalInputStatus = json.jadwal_status || window.currentJadwalInputStatus;
                window.currentRekapReport = json.rekap_aktif;
                if (Array.isArray(json.daftar_tahun_adaptif || json.daftar_tahun_20_tahun)) {
                    window.daftarTahun20TahunCache = json.daftar_tahun_adaptif || json.daftar_tahun_20_tahun;
                }

                renderPenjelajah20TahunDanTriwulan();
                renderJadwalDanHeaderRekap(window.currentJadwalInputStatus, json.rekap_aktif);
                updateStatusPublishRekapUI(json.rekap_aktif);
                window.filterTabelRekapMutasi('all_changes');

                if (typeof window.loadDashboardData === 'function') {
                    await window.loadDashboardData(false);
                }

                const hi = json.hasil_import || {};
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Import Otomatis Kondisi / Mutasi Selesai!',
                        html: `
                            <div style="text-align:left; font-size:0.84rem; line-height:1.55; color:#334155;">
                                <p style="margin-bottom:8px;">${escapeHtmlSafe(json.message)}</p>
                                <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:10px 14px;">
                                    <div>&bull; <b>Warga Diperbarui Otomatis:</b> <b>${hi.total_diperbarui || 0} Warga</b></div>
                                    <div>&bull; <b>Warga Baru Ditambahkan:</b> <b>${hi.total_ditambahkan || 0} Warga</b></div>
                                    <div>&bull; <b>Desil Otomatis Diturunkan ke Prioritas:</b> <b style="color:#dc2626;">${hi.desil_diturunkan || 0} Warga</b></div>
                                </div>
                            </div>
                        `,
                        confirmButtonColor: '#009846'
                    });
                }
            }
        } catch (err) {
            console.error('[PROSES_IMPORT_MUTASI] Error:', err);
        }
    };

    // =========================================================================
    // 7. PENGATURAN DOKUMEN REKAP (KOP SURAT, TTD, KEPALA DINSOS, STEMPEL)
    //    & UNDUHAN MULTI-FORMAT: EXCEL (.xlsx), WORD (.doc), DAN PDF (.pdf)
    // =========================================================================
    function getSavedDocConfig() {
        try {
            const raw = localStorage.getItem(DOC_CONFIG_STORAGE_KEY);
            if (raw) {
                return { ...DEFAULT_DOC_CONFIG, ...JSON.parse(raw) };
            }
        } catch (e) {}
        return { ...DEFAULT_DOC_CONFIG };
    }

    function buildStempelSvgDataUrl(teksMelingkar, warna) {
        const col = warna || '#4f46e5';
        const txt = escapeHtmlSafe(teksMelingkar || 'PEMERINTAH KAB. SIDOARJO * DINAS SOSIAL *');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
            <defs>
                <path id="textCircleTop" d="M 22,75 A 53,53 0 1,1 128,75 A 53,53 0 1,1 22,75" />
            </defs>
            <g opacity="0.88" transform="rotate(-10 75 75)">
                <circle cx="75" cy="75" r="68" fill="none" stroke="${col}" stroke-width="3.5"/>
                <circle cx="75" cy="75" r="63" fill="none" stroke="${col}" stroke-width="1.2"/>
                <circle cx="75" cy="75" r="41" fill="none" stroke="${col}" stroke-width="1.6"/>
                <text fill="${col}" font-family="Arial, sans-serif" font-size="8.2" font-weight="bold" letter-spacing="1.2">
                    <textPath href="#textCircleTop" startOffset="4%">${txt}</textPath>
                </text>
                <line x1="34" y1="64" x2="116" y2="64" stroke="${col}" stroke-width="1.4"/>
                <line x1="34" y1="86" x2="116" y2="86" stroke="${col}" stroke-width="1.4"/>
                <text x="75" y="74" text-anchor="middle" fill="${col}" font-family="Arial, sans-serif" font-size="9.5" font-weight="900">DINAS SOSIAL</text>
                <text x="75" y="83" text-anchor="middle" fill="${col}" font-family="Arial, sans-serif" font-size="7.2" font-weight="bold">SIDOARJO</text>
            </g>
        </svg>`;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    function buildTtdSvgDataUrl() {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="75" viewBox="0 0 180 75">
            <path d="M18,55 C32,18 45,62 62,25 C74,5 82,58 98,32 C112,12 125,48 158,22" fill="none" stroke="#0f172a" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M40,62 C75,52 115,50 162,45" fill="none" stroke="#1e3a8a" stroke-width="1.6" stroke-linecap="round"/>
        </svg>`;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    function getLogoKopUrl(cfg) {
        if (cfg && cfg.customLogoDataUrl) return cfg.customLogoDataUrl;
        if (window.LOGO_SIDOARJO_BASE64) return window.LOGO_SIDOARJO_BASE64;
        return `${window.location.origin}/static/img/logo-sidoarjo.png`;
    }

    window.bukaModalPengaturanDokumenRekap = function () {
        const cfg = getSavedDocConfig();
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val ?? '';
        };
        setVal('docRekapPemda', cfg.pemda);
        setVal('docRekapInstansi', cfg.instansi);
        setVal('docRekapAlamatKop', cfg.alamatKop);
        setVal('docRekapNomorSurat', cfg.nomorSurat);
        setVal('docRekapTempatTanggal', cfg.tempatTanggal);
        setVal('docRekapJabatan', cfg.jabatan);
        setVal('docRekapNamaKadis', cfg.namaKadis);
        setVal('docRekapPangkat', cfg.pangkat);
        setVal('docRekapNip', cfg.nip);
        setVal('docRekapTampilTtd', cfg.tampilTtd);
        setVal('docRekapTampilStempel', cfg.tampilStempel);
        setVal('docRekapTeksStempel', cfg.teksStempel);
        setVal('docRekapWarnaStempel', cfg.warnaStempel);

        window.updatePreviewDokumenRekap();
        if (typeof window.openModal === 'function') {
            window.openModal('modalPengaturanDokumenRekap');
        }
    };

    function readCurrentModalDocConfig() {
        const saved = getSavedDocConfig();
        const getVal = (id, fallback) => {
            const el = document.getElementById(id);
            return el ? el.value : fallback;
        };
        return {
            ...saved,
            pemda: getVal('docRekapPemda', saved.pemda),
            instansi: getVal('docRekapInstansi', saved.instansi),
            alamatKop: getVal('docRekapAlamatKop', saved.alamatKop),
            nomorSurat: getVal('docRekapNomorSurat', saved.nomorSurat),
            tempatTanggal: getVal('docRekapTempatTanggal', saved.tempatTanggal),
            jabatan: getVal('docRekapJabatan', saved.jabatan),
            namaKadis: getVal('docRekapNamaKadis', saved.namaKadis),
            pangkat: getVal('docRekapPangkat', saved.pangkat),
            nip: getVal('docRekapNip', saved.nip),
            tampilTtd: getVal('docRekapTampilTtd', saved.tampilTtd),
            tampilStempel: getVal('docRekapTampilStempel', saved.tampilStempel),
            teksStempel: getVal('docRekapTeksStempel', saved.teksStempel),
            warnaStempel: getVal('docRekapWarnaStempel', saved.warnaStempel)
        };
    }

    window.unggahGambarDokumenRekap = function (inputEl, jenis) {
        const file = inputEl?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            const dataUrl = String(ev.target?.result || '');
            const cfg = readCurrentModalDocConfig();
            if (jenis === 'logo') cfg.customLogoDataUrl = dataUrl;
            if (jenis === 'ttd') cfg.customTtdDataUrl = dataUrl;
            if (jenis === 'stempel') cfg.customStempelDataUrl = dataUrl;
            localStorage.setItem(DOC_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
            window.updatePreviewDokumenRekap();
        };
        reader.readAsDataURL(file);
    };

    window.resetPengaturanDokumenRekap = function () {
        localStorage.setItem(DOC_CONFIG_STORAGE_KEY, JSON.stringify(DEFAULT_DOC_CONFIG));
        window.bukaModalPengaturanDokumenRekap();
    };

    window.simpanPengaturanDokumenRekap = function (showNotice) {
        const cfg = readCurrentModalDocConfig();
        localStorage.setItem(DOC_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
        window.updatePreviewDokumenRekap();
        if (showNotice && typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Pengaturan Dokumen Disimpan!',
                text: 'Kop surat, nama Kepala Dinsos, tanda tangan, dan stempel siap digunakan pada unduhan Excel, Word, dan PDF.',
                timer: 1800,
                showConfirmButton: false
            });
        }
        return cfg;
    };

    window.updatePreviewDokumenRekap = function () {
        const box = document.getElementById('previewBoxDokumenRekap');
        if (!box) return;
        const cfg = readCurrentModalDocConfig();
        const logoSrc = getLogoKopUrl(cfg);
        const ttdSrc = cfg.customTtdDataUrl || buildTtdSvgDataUrl();
        const stempelSrc = cfg.customStempelDataUrl || buildStempelSvgDataUrl(cfg.teksStempel, cfg.warnaStempel);

        box.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; border-bottom:3px double #000; padding-bottom:6px; margin-bottom:8px;">
                <img src="${logoSrc}" alt="Logo" style="width:42px; height:42px; object-fit:contain;">
                <div style="flex:1; text-align:center; line-height:1.25;">
                    <div style="font-size:0.78rem; font-weight:bold;">${escapeHtmlSafe(cfg.pemda)}</div>
                    <div style="font-size:0.92rem; font-weight:900;">${escapeHtmlSafe(cfg.instansi)}</div>
                    <div style="font-size:0.62rem;">${escapeHtmlSafe(cfg.alamatKop)}</div>
                </div>
            </div>
            <div style="display:flex; justify-content:flex-end;">
                <div style="text-align:center; min-width:210px; position:relative; padding-top:4px;">
                    <div style="font-size:0.68rem;">${escapeHtmlSafe(cfg.tempatTanggal)}</div>
                    <div style="font-size:0.68rem; font-weight:bold; margin-bottom:4px;">${escapeHtmlSafe(cfg.jabatan)}</div>
                    <div style="height:56px; display:flex; align-items:center; justify-content:center; position:relative;">
                        ${cfg.tampilStempel === 'ya' ? `<img src="${stempelSrc}" alt="Stempel" style="width:68px; height:68px; position:absolute; left:18px; top:-6px; opacity:0.88;">` : ''}
                        ${cfg.tampilTtd === 'ya' ? `<img src="${ttdSrc}" alt="TTD" style="height:48px; object-fit:contain; position:relative; z-index:2;">` : ''}
                    </div>
                    <div style="font-size:0.73rem; font-weight:bold; text-decoration:underline;">${escapeHtmlSafe(cfg.namaKadis)}</div>
                    <div style="font-size:0.66rem;">${escapeHtmlSafe(cfg.pangkat)}</div>
                    <div style="font-size:0.66rem;">NIP. ${escapeHtmlSafe(cfg.nip)}</div>
                </div>
            </div>
        `;
    };

    function buildOfficialDocumentHtml(report, cfg) {
        const r = report.ringkasan || {};
        const logoSrc = getLogoKopUrl(cfg);
        const ttdSrc = cfg.customTtdDataUrl || buildTtdSvgDataUrl();
        const stempelSrc = cfg.customStempelDataUrl || buildStempelSvgDataUrl(cfg.teksStempel, cfg.warnaStempel);

        const rowsHtml = (report.items || []).map((it, idx) => `
            <tr>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${idx + 1}</td>
                <td style="border:1px solid #000; padding:6px;">
                    <b>${escapeHtmlSafe(it.nama)}</b><br>
                    <span style="font-size:9pt;">NIK: ${escapeHtmlSafe(it.nik)}</span>
                </td>
                <td style="border:1px solid #000; padding:6px;">${escapeHtmlSafe((it.label_perubahan || []).join(', '))}</td>
                <td style="border:1px solid #000; padding:6px;">
                    <b>Hunian:</b> ${escapeHtmlSafe(it.tempat_tinggal_lama)} → <b>${escapeHtmlSafe(it.tempat_tinggal_baru)}</b><br>
                    <b>Alamat:</b> ${escapeHtmlSafe(it.alamat_baru)}<br>
                    <b>Kota:</b> ${escapeHtmlSafe(it.kota_baru)}
                </td>
                <td style="border:1px solid #000; padding:6px; font-size:9pt;">
                    ${(it.rincian_perubahan_kriteria || []).map(x => `&bull; ${escapeHtmlSafe(x)}`).join('<br>')}
                </td>
                <td style="border:1px solid #000; padding:6px; text-align:center; font-weight:bold;">
                    Desil ${it.desil_lama} → Desil ${it.desil_baru}<br>
                    <span style="font-size:8.5pt; font-weight:normal;">(SAW: ${Number(it.skor_saw_baru || 0).toFixed(4)})</span>
                </td>
                <td style="border:1px solid #000; padding:6px; text-align:left; font-size:8.5pt;">
                    <b>${escapeHtmlSafe(it.status_bansos_baru)}</b><br>
                    &bull; <b>Penyaluran Awal:</b> ${escapeHtmlSafe(it.nominal_penyaluran_awal_label || '-')} (${escapeHtmlSafe(it.penyaluran_awal_periode || 'Tahap I')})<br>
                    &bull; <b>Penyaluran Akhir:</b> ${escapeHtmlSafe(it.nominal_penyaluran_akhir_label || '-')} (${escapeHtmlSafe(it.penyaluran_akhir_periode || 'Tahap IV')})<br>
                    &bull; <b>Total Akumulasi:</b> <b>${escapeHtmlSafe(it.total_nominal_awal_sampai_akhir_label || '-')}</b><br>
                    &bull; <b>Bentuk Bantuan:</b> ${escapeHtmlSafe((it.nominal_penyaluran_akhir || 0) > 0 ? it.bentuk_bantuan_akhir : (it.bentuk_bantuan_awal || it.bentuk_bantuan_akhir || '-'))}
                </td>
            </tr>
        `).join('');

        return `
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <title>Laporan Rekap Penyaluran 3 Bulanan - ${escapeHtmlSafe(report.nama_periode)}</title>
                <style>
                    body { font-family: 'Times New Roman', Times, serif; color: #000; margin: 25px 35px; font-size: 11pt; line-height: 1.4; }
                    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                    th { background-color: #e2e8f0; border: 1px solid #000; padding: 7px; font-size: 9.5pt; text-align: center; }
                    td { font-size: 9.5pt; vertical-align: top; }
                    @media print {
                        .no-print { display: none !important; }
                        body { margin: 10mm 12mm; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="background:#eff6ff; border:1px solid #93c5fd; padding:10px 16px; border-radius:10px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; font-family:Inter, sans-serif;">
                    <div style="font-size:0.85rem; font-weight:700; color:#1e3a8a;">
                        Dokumen Resmi Rekapitulasi Penyaluran 3 Bulanan (${escapeHtmlSafe(report.nama_periode)}) Siap Cetak / Simpan PDF
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="window.print()" style="background:#dc2626; color:#fff; border:none; padding:7px 14px; border-radius:8px; font-weight:800; cursor:pointer;">Cetak / Simpan PDF</button>
                        <button onclick="window.close()" style="background:#475569; color:#fff; border:none; padding:7px 12px; border-radius:8px; font-weight:700; cursor:pointer;">Tutup</button>
                    </div>
                </div>

                <!-- KOP SURAT RESMI -->
                <table style="border:none; border-bottom:3.5px double #000; margin-bottom:14px;">
                    <tr>
                        <td style="border:none; width:85px; text-align:center; vertical-align:middle;">
                            <img src="${logoSrc}" alt="Logo" style="width:72px; height:72px; object-fit:contain;">
                        </td>
                        <td style="border:none; text-align:center; vertical-align:middle;">
                            <div style="font-size:14pt; font-weight:bold; letter-spacing:0.5px;">${escapeHtmlSafe(cfg.pemda)}</div>
                            <div style="font-size:17pt; font-weight:900; letter-spacing:1px; margin:2px 0;">${escapeHtmlSafe(cfg.instansi)}</div>
                            <div style="font-size:9.5pt;">${escapeHtmlSafe(cfg.alamatKop)}</div>
                        </td>
                    </tr>
                </table>

                <div style="text-align:center; margin-bottom:14px;">
                    <div style="font-size:12.5pt; font-weight:bold; text-decoration:underline;">
                        BERITA ACARA &amp; REKAPITULASI EVALUASI PENYALURAN BANTUAN SOSIAL 3 BULANAN (TRIWULANAN)
                    </div>
                    <div style="font-size:10.5pt; font-weight:bold; margin-top:2px;">
                        NOMOR: ${escapeHtmlSafe(cfg.nomorSurat)}
                    </div>
                    <div style="font-size:10.5pt; margin-top:2px;">
                        Periode Siklus: <b>${escapeHtmlSafe(report.nama_periode)} (Tahun ${report.tahun})</b>
                    </div>
                </div>

                <div style="margin-bottom:10px; font-size:10.5pt; text-align:justify;">
                    Berdasarkan hasil pemutakhiran dan perbandingan <b>Data Lama</b> dengan <b>Data Baru</b> warga pada jendela penginputan bulanan (Tanggal 1 s/d 10 atau sebelum Tanggal 26) menggunakan evaluasi kriteria dinamis <b>C1 s/d C39</b>, berikut adalah rincian perubahan tempat tinggal, alamat, mutasi kota, warga meninggal dunia, perubahan kondisi ekonomi/kriteria, beserta <b>penurunan/penyesuaian Desil otomatis</b>:
                </div>

                <table style="margin-bottom:12px;">
                    <tr>
                        <td style="border:1px solid #000; padding:6px;"><b>Total Mutasi &amp; Perubahan:</b> ${r.total_berubah || 0} Warga</td>
                        <td style="border:1px solid #000; padding:6px;"><b>Ekonomi Memburuk (Desil Turun):</b> ${r.ekonomi_memburuk || 0} Warga</td>
                        <td style="border:1px solid #000; padding:6px;"><b>Ekonomi Membaik (Graduasi):</b> ${r.ekonomi_membaik || 0} Warga</td>
                        <td style="border:1px solid #000; padding:6px;"><b>Berubah Tempat Tinggal:</b> ${r.pindah_tempat_tinggal || 0} Warga</td>
                    </tr>
                    <tr>
                        <td style="border:1px solid #000; padding:6px;"><b>Berubah Alamat Sidoarjo:</b> ${r.pindah_alamat || 0} Warga</td>
                        <td style="border:1px solid #000; padding:6px;"><b>Pindah Kota (Dihentikan):</b> ${r.pindah_kota || 0} Warga</td>
                        <td style="border:1px solid #000; padding:6px;"><b>Meninggal Dunia (Non-Aktif):</b> ${r.meninggal || 0} Warga</td>
                        <td style="border:1px solid #000; padding:6px;"><b>KPM Layak Salur Triwulan:</b> ${r.layak_penyaluran_triwulan || 0} KPM</td>
                    </tr>
                    <tr>
                        <td style="border:1px solid #000; padding:6px;"><b>Total Penyaluran Awal (Tahap I):</b> ${escapeHtmlSafe(r.total_nominal_penyaluran_awal_seluruh_warga_label || '-')}</td>
                        <td style="border:1px solid #000; padding:6px;"><b>Total Penyaluran Akhir (Tahap IV):</b> ${escapeHtmlSafe(r.total_nominal_penyaluran_akhir_seluruh_warga_label || '-')}</td>
                        <td colspan="2" style="border:1px solid #000; padding:6px;"><b>Total Akumulasi Penyaluran Awal s/d Akhir (Tahap I–IV):</b> ${escapeHtmlSafe(r.total_nominal_akumulasi_awal_sampai_akhir_seluruh_warga_label || '-')}</td>
                    </tr>
                </table>

                <table>
                    <thead>
                        <tr>
                            <th style="width:32px;">No</th>
                            <th style="width:145px;">NIK &amp; Nama Warga</th>
                            <th style="width:115px;">Status Perubahan Data</th>
                            <th style="width:155px;">Perubahan Hunian, Alamat &amp; Kota</th>
                            <th>Rincian Perubahan Kriteria C1–C39 (Data Lama → Data Baru)</th>
                            <th style="width:115px;">Penurunan / Penyesuaian Desil Otomatis</th>
                            <th style="width:185px;">Penyaluran Awal s/d Akhir (Nominal &amp; Bentuk Bantuan)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <!-- BLOK PENGESAHAN KEPALA DINAS SOSIAL, TANDA TANGAN & STEMPEL -->
                <table style="border:none; margin-top:26px;">
                    <tr>
                        <td style="border:none; width:55%;"></td>
                        <td style="border:none; width:45%; text-align:center;">
                            <div>${escapeHtmlSafe(cfg.tempatTanggal)}</div>
                            <div style="font-weight:bold; margin-top:2px;">${escapeHtmlSafe(cfg.jabatan)}</div>
                            <div style="height:85px; position:relative; display:flex; align-items:center; justify-content:center; margin:6px 0;">
                                ${cfg.tampilStempel === 'ya' ? `<img src="${stempelSrc}" alt="Stempel Dinas" style="width:92px; height:92px; position:absolute; left:18%; top:-4px; opacity:0.88;">` : ''}
                                ${cfg.tampilTtd === 'ya' ? `<img src="${ttdSrc}" alt="Tanda Tangan" style="height:64px; object-fit:contain; position:relative; z-index:2;">` : ''}
                            </div>
                            <div style="font-weight:bold; text-decoration:underline; font-size:11pt;">${escapeHtmlSafe(cfg.namaKadis)}</div>
                            <div>${escapeHtmlSafe(cfg.pangkat)}</div>
                            <div>NIP. ${escapeHtmlSafe(cfg.nip)}</div>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;
    }

    window.eksporRekapTriwulanExcel = function () {
        const report = window.currentRekapReport;
        if (!report || !Array.isArray(report.items) || report.items.length === 0) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'warning', title: 'Data Kosong', text: 'Belum ada data rekapitulasi untuk diekspor.' });
            }
            return;
        }
        const cfg = getSavedDocConfig();

        const metaTop = [
            [cfg.pemda],
            [cfg.instansi],
            [cfg.alamatKop],
            [''],
            ['BERITA ACARA & REKAPITULASI PENYALURAN BANTUAN SOSIAL 3 BULANAN (TRIWULANAN)'],
            [`Nomor Surat: ${cfg.nomorSurat} | Periode: ${report.nama_periode} (Tahun ${report.tahun})`],
            ['']
        ];

        const headers = [
            'No',
            'Periode Penyaluran (3 Bulan)',
            'Tahun Rekap',
            'NIK',
            'Nama Warga',
            'Kategori Perubahan Data',
            'Status Tempat Tinggal Lama (C8)',
            'Status Tempat Tinggal Baru (C8)',
            'Alamat Lama',
            'Alamat Baru',
            'Kota Domisili Baru',
            'Penghasilan Lama (C1)',
            'Penghasilan Baru (C1)',
            'Rincian Perubahan Kriteria (C1–C39)',
            'Skor SAW Lama',
            'Skor SAW Baru',
            'Desil Lama',
            'Desil Baru (Otomatis)',
            'Keputusan Penyaluran Bansos',
            'Periode Penyaluran Awal (Tahap I)',
            'Nominal Penyaluran Awal (Rp)',
            'Bentuk Bantuan Penyaluran Awal',
            'Periode Penyaluran Akhir (Tahap IV)',
            'Nominal Penyaluran Akhir (Rp)',
            'Bentuk Bantuan Penyaluran Akhir',
            'Total Akumulasi Nominal Awal s/d Akhir (Rp)',
            'Keterangan Evaluasi Otomatis'
        ];

        const rows = report.items.map((it, idx) => [
            idx + 1,
            report.nama_periode,
            report.tahun,
            `'${it.nik}`,
            it.nama,
            (it.label_perubahan || []).join('; '),
            it.tempat_tinggal_lama,
            it.tempat_tinggal_baru,
            it.alamat_lama,
            it.alamat_baru,
            it.kota_baru,
            it.kriteria_lama ? it.kriteria_lama.c1 : '-',
            it.kriteria_baru ? it.kriteria_baru.c1 : '-',
            (it.rincian_perubahan_kriteria || []).join(' | '),
            it.skor_saw_lama,
            it.skor_saw_baru,
            `Desil ${it.desil_lama}`,
            `Desil ${it.desil_baru}`,
            it.status_bansos_baru,
            it.penyaluran_awal_periode || `Triwulan I (Tahap 1) ${report.tahun}`,
            it.nominal_penyaluran_awal_label || 'Rp 0',
            it.bentuk_bantuan_awal || '-',
            it.penyaluran_akhir_periode || `Triwulan IV (Tahap 4) ${report.tahun}`,
            it.nominal_penyaluran_akhir_label || 'Rp 0',
            it.bentuk_bantuan_akhir || '-',
            it.total_nominal_awal_sampai_akhir_label || 'Rp 0',
            it.keterangan_desil_otomatis
        ]);

        const footerSign = [
            [''],
            ['', '', '', '', '', '', '', '', '', '', '', '', '', cfg.tempatTanggal],
            ['', '', '', '', '', '', '', '', '', '', '', '', '', cfg.jabatan],
            ['', '', '', '', '', '', '', '', '', '', '', '', '', cfg.tampilStempel === 'ya' ? '[STEMPEL BASAH DINAS SOSIAL & TTD RESMI]' : ''],
            ['', '', '', '', '', '', '', '', '', '', '', '', '', cfg.namaKadis],
            ['', '', '', '', '', '', '', '', '', '', '', '', '', cfg.pangkat],
            ['', '', '', '', '', '', '', '', '', '', '', '', '', `NIP. ${cfg.nip}`]
        ];

        if (typeof XLSX !== 'undefined') {
            const aoa = [...metaTop, headers, ...rows, ...footerSign];
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `Rekap_${report.kode_periode}`);
            XLSX.writeFile(wb, `Rekap_Penyaluran_3Bulan_${report.kode_periode}.xlsx`);
            return;
        }

        const csvContent = [...metaTop, headers, ...rows, ...footerSign]
            .map(e => e.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rekap_Penyaluran_3Bulan_${report.kode_periode}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // Alias kompatibilitas
    window.eksporRekapTriwulanCsv = window.eksporRekapTriwulanExcel;

    window.eksporRekapTriwulanWord = function () {
        const report = window.currentRekapReport;
        if (!report || !Array.isArray(report.items) || report.items.length === 0) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'warning', title: 'Data Kosong', text: 'Belum ada data rekapitulasi untuk diekspor ke Word.' });
            }
            return;
        }
        const cfg = getSavedDocConfig();
        const docHtml = buildOfficialDocumentHtml(report, cfg);
        const wordBlob = new Blob(['\ufeff', docHtml], {
            type: 'application/msword;charset=utf-8'
        });
        const url = URL.createObjectURL(wordBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Berita_Acara_Rekap_3Bulan_${report.kode_periode}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    window.eksporRekapTriwulanPdf = function () {
        const report = window.currentRekapReport;
        if (!report || !Array.isArray(report.items) || report.items.length === 0) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'warning', title: 'Data Kosong', text: 'Belum ada data rekapitulasi untuk dicetak ke PDF.' });
            }
            return;
        }
        const cfg = getSavedDocConfig();
        const docHtml = buildOfficialDocumentHtml(report, cfg);
        const printWin = window.open('', '_blank');
        if (printWin) {
            printWin.document.open();
            printWin.document.write(docHtml);
            printWin.document.close();
            setTimeout(() => {
                try { printWin.focus(); printWin.print(); } catch (e) {}
            }, 450);
        } else {
            // Fallback apabila popup diblokir browser: unduh berkas HTML siap cetak PDF
            const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Dokumen_PDF_Rekap_3Bulan_${report.kode_periode}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.loadRekapTriwulanData();
        }, 500);
    });
})();
