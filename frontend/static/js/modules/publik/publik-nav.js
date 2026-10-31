/**
 * Modul: publik-nav.js
 * Deskripsi: Navigasi tab portal warga, responsivitas tampilan, tur interaktif, dan FAQ accordion
 */

// 3. NAVIGASI TAB PORTAL & SINKRONISASI VIEW
// =========================================================================
window.switchTabPublik = window.switchTab = function (targetSectionId, btnEl) {
    const landingView = document.getElementById('landingView') || document.querySelector('.container-public');
    const shell = document.getElementById('portalTabsShell') || document.querySelector('.card-portal-shell');
    const tabsBar = document.getElementById('portalTabsBar');
    const dashboardView = document.getElementById('dashboardWargaSection');
    const aduanView = document.getElementById('sectionDashboardPengaduan');
    const chatbotBtn = document.getElementById('chatbotFabBtn') || document.getElementById('chatbotTriggerBtn');

    const heroBanner = document.getElementById('heroBannerPublic') || document.querySelector('.hero-public');

    if (landingView) {
        landingView.style.display = 'block';
        landingView.style.opacity = '1';
        landingView.style.visibility = 'visible';
    }

    if (targetSectionId === 'dashboardWargaSection') {
        document.body.classList.add('is-warga-dashboard');
        if (heroBanner) {
            heroBanner.classList.add('hero-hidden');
            heroBanner.style.setProperty('display', 'none', 'important');
        }
        if (landingView) {
            landingView.classList.add('warga-full-mode');
        }

        // Sembunyikan panel diagnostik otomatis pada akses dashboard warga
        const panelDiag = document.getElementById('panelDiagnostikDev');
        if (panelDiag && !window._forceShowDevDiagnostic) {
            panelDiag.style.setProperty('display', 'none', 'important');
            panelDiag.classList.remove('force-show-diagnostic');
        }

        if (shell && dashboardView && shell.contains(dashboardView)) {
            shell.style.display = 'block';
            if (tabsBar) tabsBar.style.display = 'none';
            ['loginWargaSection', 'cekStatusSection', 'rekapPublikSection', 'spkSkPublikSection', 'daftarMandiriSection', 'pantauAduanSection', 'bantuanSection'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        } else if (shell) {
            shell.style.display = 'none';
        }

        if (aduanView) aduanView.style.display = 'none';
        if (dashboardView) {
            dashboardView.style.display = 'block';
            dashboardView.style.opacity = '1';
            dashboardView.style.visibility = 'visible';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if (chatbotBtn) chatbotBtn.style.display = 'none';
        return;
    }

    if (targetSectionId === 'sectionDashboardPengaduan') {
        document.body.classList.add('is-warga-dashboard');
        if (heroBanner) {
            heroBanner.classList.add('hero-hidden');
            heroBanner.style.setProperty('display', 'none', 'important');
        }
        if (landingView) {
            landingView.classList.add('warga-full-mode');
        }

        // Sembunyikan panel diagnostik otomatis pada akses dasbor pengaduan warga
        const panelDiag = document.getElementById('panelDiagnostikDev');
        if (panelDiag && !window._forceShowDevDiagnostic) {
            panelDiag.style.setProperty('display', 'none', 'important');
            panelDiag.classList.remove('force-show-diagnostic');
        }

        if (shell && aduanView && shell.contains(aduanView)) {
            shell.style.display = 'block';
            if (tabsBar) tabsBar.style.display = 'none';
            ['loginWargaSection', 'cekStatusSection', 'daftarMandiriSection', 'pantauAduanSection', 'bantuanSection'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        } else if (shell) {
            shell.style.display = 'none';
        }

        if (dashboardView) dashboardView.style.display = 'none';
        if (aduanView) {
            aduanView.style.display = 'block';
            aduanView.style.opacity = '1';
            aduanView.style.visibility = 'visible';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if (chatbotBtn) chatbotBtn.style.display = 'none';
        return;
    }

    // Keluar dari mode dashboard warga/pengaduan: Pulihkan banner hero & mode kontainer
    document.body.classList.remove('is-warga-dashboard');
    if (heroBanner) {
        heroBanner.classList.remove('hero-hidden');
        heroBanner.style.display = '';
    }
    if (landingView) {
        landingView.classList.remove('warga-full-mode');
    }

    // Periksa ulang visibilitas panel diagnostik jika Super Admin
    if (window.PublikDiagnostic && typeof window.PublikDiagnostic.checkAccess === 'function') {
        window.PublikDiagnostic.checkAccess();
    }

    if (shell) shell.style.display = 'block';
    if (tabsBar) tabsBar.style.display = 'grid';
    if (dashboardView) dashboardView.style.display = 'none';
    if (aduanView) aduanView.style.display = 'none';
    if (chatbotBtn) chatbotBtn.style.display = 'flex';

    document.querySelectorAll('.tab-btn-portal, .tab-btn').forEach(b => b.classList.remove('active'));
    // Sembunyikan seluruh kontainer tab portal secara universal
    document.querySelectorAll('.tab-content-portal').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });

    const allSections = [
        'loginWargaSection', 'cekStatusSection', 'rekapPublikSection', 'spkSkPublikSection', 'daftarMandiriSection', 'pantauAduanSection', 'bantuanSection',
        'panelMasukDashboard', 'panelCekStatus', 'panelRekapPublik', 'panelSpkSkPublik', 'panelDaftarMandiri', 'panelPantauAduan', 'panelFAQ'
    ];
    allSections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            el.classList.remove('active');
        }
    });

    const mapIds = {
        'loginWargaSection': ['loginWargaSection', 'panelMasukDashboard'],
        'panelMasukDashboard': ['loginWargaSection', 'panelMasukDashboard'],
        'cekStatusSection': ['cekStatusSection', 'panelCekStatus'],
        'panelCekStatus': ['cekStatusSection', 'panelCekStatus'],
        'rekapPublikSection': ['rekapPublikSection', 'panelRekapPublik'],
        'panelRekapPublik': ['rekapPublikSection', 'panelRekapPublik'],
        'spkSkPublikSection': ['spkSkPublikSection', 'panelSpkSkPublik'],
        'panelSpkSkPublik': ['spkSkPublikSection', 'panelSpkSkPublik'],
        'daftarMandiriSection': ['daftarMandiriSection', 'panelDaftarMandiri'],
        'panelDaftarMandiri': ['daftarMandiriSection', 'panelDaftarMandiri'],
        'pantauAduanSection': ['pantauAduanSection', 'panelPantauAduan'],
        'panelPantauAduan': ['pantauAduanSection', 'panelPantauAduan'],
        'bantuanSection': ['bantuanSection', 'panelFAQ'],
        'panelFAQ': ['bantuanSection', 'panelFAQ']
    };

    const targets = mapIds[targetSectionId] || [targetSectionId];
    targets.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'block';
            el.classList.add('active');
        }
    });

    if (btnEl) {
        btnEl.classList.add('active');
    } else {
        const mapBtn = {
            'loginWargaSection': ['btn-login', 'tabBtnMasuk'],
            'panelMasukDashboard': ['btn-login', 'tabBtnMasuk'],
            'cekStatusSection': ['btn-cek', 'tabBtnCek'],
            'panelCekStatus': ['btn-cek', 'tabBtnCek'],
            'rekapPublikSection': ['btn-rekap-publik', 'tabBtnRekapPublik'],
            'panelRekapPublik': ['btn-rekap-publik', 'tabBtnRekapPublik'],
            'spkSkPublikSection': ['btn-spk-sk', 'tabBtnSpkSk'],
            'panelSpkSkPublik': ['btn-spk-sk', 'tabBtnSpkSk'],
            'daftarMandiriSection': ['btn-daftar', 'tabBtnDaftar'],
            'panelDaftarMandiri': ['btn-daftar', 'tabBtnDaftar'],
            'pantauAduanSection': ['btn-aduan', 'tabBtnAduan'],
            'panelPantauAduan': ['btn-aduan', 'tabBtnAduan'],
            'bantuanSection': ['btn-panduan', 'tabBtnFAQ'],
            'panelFAQ': ['btn-panduan', 'tabBtnFAQ']
        };
        const btnKeys = mapBtn[targetSectionId] || [];
        btnKeys.forEach(bk => {
            const b = document.getElementById(bk);
            if (b) b.classList.add('active');
        });
    }

    
    if (targetSectionId === 'spkSkPublikSection' || targetSectionId === 'panelSpkSkPublik') {
        if (typeof window.cekStatusPublikasiWargaSpkSk === 'function') {
            window.cekStatusPublikasiWargaSpkSk();
        }
    }
    if (targetSectionId === 'rekapPublikSection' || targetSectionId === 'panelRekapPublik') {
        if (typeof window.muatRekapPublikWarga === 'function') {
            window.muatRekapPublikWarga();
        }
    }

    if (targetSectionId === 'daftarMandiriSection' || targetSectionId === 'panelDaftarMandiri') {
        setTimeout(() => {
            if (typeof initGeotaggingMap === 'function') initGeotaggingMap();
        }, 250);
    }
};

window.gantiTabPortal = function (tab) {
    const map = {
        'masuk': 'loginWargaSection',
        'cek': 'cekStatusSection',
        'rekap': 'rekapPublikSection',
        'daftar': 'daftarMandiriSection',
        'aduan': 'pantauAduanSection',
        'faq': 'bantuanSection'
    };
    window.switchTabPublik(map[tab] || tab);
};

window.toggleFaqCard = function (cardEl) {
    if (!cardEl) return;
    const body = cardEl.querySelector('.faq-card-body');
    const isOpen = cardEl.classList.contains('open');

    document.querySelectorAll('.faq-modern-card').forEach(c => {
        c.classList.remove('open');
        const b = c.querySelector('.faq-card-body');
        if (b) b.style.display = 'none';
    });

    if (!isOpen && body) {
        cardEl.classList.add('open');
        body.style.display = 'block';
    }
};

// =========================================================================


// 13. TUR INTERAKTIF NON-BLOCKING & FAQ ACCORDION
// =========================================================================
window.toggleFaq = function (el) {
    const answer = el.nextElementSibling;
    const icon = el.querySelector('i');
    const isOpen = answer.style.display === 'block';
    document.querySelectorAll('.faq-answer').forEach(a => a.style.display = 'none');
    document.querySelectorAll('.faq-question i').forEach(i => i.className = 'fas fa-chevron-down');
    if (!isOpen) {
        answer.style.display = 'block';
        if (icon) icon.className = 'fas fa-chevron-up';
    }
};

const daftarLangkahTur = [
    {
        targetId: 'loginWargaSection',
        badge: 'Kanal Akses',
        title: 'Masuk Dashboard Pribadi',
        desc: 'Masukkan NIK, Nama KTP, dan Email untuk membuka Dashboard Personal, memantau riwayat penetapan, serta berkoordinasi via Live Chat & Panggilan WebRTC bersama petugas Dinsos.'
    },
    {
        targetId: 'cekStatusSection',
        badge: 'Transparansi',
        title: 'Cek Status Bansos Terpadu',
        desc: 'Cukup masukkan 16 digit NIK untuk mengetahui klasifikasi desil (1-10), status kelayakan bansos, dan status penyaluran fisik secara seketika dan transparan.'
    },
    {
        targetId: 'rekapPublikSection',
        badge: 'Rekap Triwulanan',
        title: 'Rekapitulasi Penyaluran 3 Bulanan',
        desc: 'Pantau laporan penyaluran bansos setiap 3 bulan sekali (Tahap 1–4), perbandingan data lama vs baru, arah desil graduasi/prioritas, serta transparansi nominal penyaluran awal s/d akhir.'
    },
    {
        targetId: 'spkSkPublikSection',
        badge: 'Akuntabilitas SPK',
        title: 'Metrik Perhitungan SPK & SK Bupati Resmi',
        desc: 'Akses terbuka hasil penilaian algoritma BWM-SAW (variabel kriteria C1–C10, bobot, skor, ranking) dan ketetapan sah SK Bupati Sidoarjo berotentikasi BSrE BSSN dengan verifikasi privasi aman.'
    },
    {
        targetId: 'daftarMandiriSection',
        badge: 'Pendaftaran',
        title: 'Pendaftaran Mandiri & Geotagging GPS',
        desc: 'Bagi keluarga yang belum terdata, ajukan data survei mandiri dengan mengisi 10 indikator kelayakan SPK BWM-SAW dan mengunci koordinat titik GPS rumah Anda.'
    },
    {
        targetId: 'pantauAduanSection',
        badge: 'Pengaduan',
        title: 'Pantau Progres Penanganan Aduan',
        desc: 'Akses cepat berbasis NIK untuk langsung melihat tahapan investigasi kendala pendaftaran atau sengketa penyaluran tanpa membuat laporan baru.'
    },
    {
        targetId: 'bantuanSection',
        badge: 'Edukasi',
        title: 'Pusat Edukasi & Bantuan (FAQ)',
        desc: 'Panduan lengkap mengenai regulasi desil 1–4, prosedur sanggah desil faktual, dan tindakan penyelesaian jika fisik bantuan belum diterima.'
    },
    {
        targetId: 'chatbotFabBtn',
        badge: 'Asisten Virtual',
        title: 'Asisten Cerdas & Jalur Pengaduan',
        desc: 'Jika Anda belum terdaftar atau terkendala teknis saat mendaftar, klik ikon robot di pojok kanan bawah untuk diarahkan langsung ke Dashboard Khusus Pengaduan.'
    }
];

window.mulaiTurInteraktif = function () {
    window.tutupModalPanduan();
    if (typeof Swal !== 'undefined') Swal.close();

    activeTourIndex = 0;
    window.jalankanLangkahTur(activeTourIndex);
};

window.jalankanLangkahTur = function (index) {
    if (index < 0 || index >= daftarLangkahTur.length) {
        window.tutupTurInteraktif();
        return;
    }

    activeTourIndex = index;
    const step = daftarLangkahTur[index];

    document.querySelectorAll('.highlight-focus').forEach(el => el.classList.remove('highlight-focus'));

    if (step.targetId === 'chatbotFabBtn') {
        const botBtn = document.getElementById('chatbotFabBtn') || document.getElementById('chatbotTriggerBtn');
        if (botBtn) {
            botBtn.classList.add('highlight-focus');
            botBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
        window.switchTabPublik(step.targetId);
        const cardTarget = document.getElementById(step.targetId);
        if (cardTarget) {
            cardTarget.classList.add('highlight-focus');
            cardTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    let tourBox = document.getElementById('floatingTourGuideBar');
    if (!tourBox) {
        tourBox = document.createElement('div');
        tourBox.id = 'floatingTourGuideBar';
        tourBox.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            width: 92%;
            max-width: 660px;
            background: #ffffff;
            border-radius: 20px;
            border: 2px solid #009846;
            box-shadow: 0 16px 45px rgba(15, 23, 42, 0.25);
            padding: 18px 24px;
            z-index: 999999;
            animation: slideUpTourBar 0.3s ease;
        `;
        document.body.appendChild(tourBox);
    }

    const isLast = (index === daftarLangkahTur.length - 1);
    tourBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="background:#e6f9f0; color:#009846; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:12px; letter-spacing:0.3px;">
                <i class="fas fa-compass"></i> LANGKAH ${index + 1} DARI ${daftarLangkahTur.length}: ${step.badge.toUpperCase()}
            </span>
            <button type="button" onclick="window.tutupTurInteraktif()" style="background:none; border:none; color:#94a3b8; font-size:1.4rem; cursor:pointer; line-height:1;" title="Tutup Tur">&times;</button>
        </div>
        <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:4px 0 6px 0;">${step.title}</h4>
        <p style="font-size:0.88rem; color:#475569; line-height:1.55; margin:0 0 16px 0;">${step.desc}</p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <button type="button" onclick="window.tutupTurInteraktif()" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#64748b; padding:8px 16px; border-radius:20px; font-weight:700; font-size:0.82rem; cursor:pointer;">
                Lewati Tur
            </button>
            <div style="display:flex; gap:8px;">
                <button type="button" onclick="window.jalankanLangkahTur(${index - 1})" ${index === 0 ? 'disabled' : ''} style="background:${index === 0 ? '#f1f5f9' : '#ffffff'}; border:1px solid #cbd5e1; color:${index === 0 ? '#cbd5e1' : '#0f172a'}; padding:8px 16px; border-radius:20px; font-weight:700; font-size:0.82rem; cursor:${index === 0 ? 'not-allowed' : 'pointer'};">
                    &larr; Sebelumnya
                </button>
                <button type="button" onclick="window.jalankanLangkahTur(${index + 1})" style="background:#009846; border:none; color:#ffffff; padding:8px 20px; border-radius:20px; font-weight:800; font-size:0.82rem; cursor:pointer; box-shadow:0 3px 10px rgba(0,152,70,0.25);">
                    ${isLast ? '<i class="fas fa-check"></i> Selesai Tur' : 'Lanjut &rarr;'}
                </button>
            </div>
        </div>
    `;
};

window.tutupTurInteraktif = function () {
    document.querySelectorAll('.highlight-focus').forEach(el => el.classList.remove('highlight-focus'));
    const tourBox = document.getElementById('floatingTourGuideBar');
    if (tourBox) tourBox.remove();
};

window.bukaModalPanduanPortal = function () {
    const m = document.getElementById('modalPanduanPortal');
    if (m) m.style.display = 'flex';
};

window.tutupModalPanduan = function () {
    const m = document.getElementById('modalPanduanPortal');
    if (m) m.style.display = 'none';
};

window.navigasiPanduan = function (targetId) {
    window.tutupModalPanduan();

    if (targetId === 'chatbot') {
        window.toggleChatbotWindow();
        return;
    }

    window.switchTabPublik(targetId);

    const card = document.getElementById(targetId);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.remove('highlight-focus');
        void card.offsetWidth;
        card.classList.add('highlight-focus');
        setTimeout(() => card.classList.remove('highlight-focus'), 3000);
    }
};

// =========================================================================
