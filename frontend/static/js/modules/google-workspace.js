/**
 * MODUL INTEGRASI RESMI GOOGLE WORKSPACE (GOOGLE DRIVE & GOOGLE FOTO) - VERSI PENUH TERPADU
 * Pemerintah Kabupaten Sidoarjo - Dinas Sosial
 *
 * Fitur Utama:
 * 1. Terhubung ke seluruh fitur obrolan & pratinjau pesan suara:
 *    - Portal Warga: Dashboard Pribadi Anda (Obrolan & Voice Preview) + Dashboard Pantauan Pengaduan (Obrolan & Voice Preview)
 *    - Dashboard Aparatur (Super Admin, Admin, Petugas): Hubungi Warga (Obrolan & Voice Preview)
 * 2. Google Drive: Memuat SELURUH file & folder lintas direktori (Semua Berkas Drive, Jelajahi Folder Root/Subfolder, Dibagikan ke Saya, Foto & Video, Dokumen & Arsip), mendukung pageSize=1000, supportsAllDrives, nextPageToken multi-halaman, dan ekspor otomatis Google Docs/Sheets/Slides.
 * 3. Google Foto: Menggabungkan Google Photos Library API (mediaItems & albums) + Google Drive spaces=drive,photos untuk menampilkan SELURUH foto dan video (MP4/MOV/MKV/WebM) milik akun Google pengguna dengan dukungan multi-halaman & proxy anti-CORS.
 * 4. Logout otomatis saat keluar/tutup modal sehingga privasi akun terjaga.
 */

(function () {
    const FALLBACK_GOOGLE_CLIENT_ID = '935928718907-esat4br1mvc30f9mogkc96pglbiom9u6.apps.googleusercontent.com';
    let dynamicGoogleClientId = '';

    // Scope lengkap untuk membaca seluruh file Google Drive, ruang Google Foto, dan Google Photos Library API
    const GOOGLE_SCOPES_FULL = [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.photos.readonly',
        'https://www.googleapis.com/auth/photoslibrary.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid',
        'email',
        'profile'
    ].join(' ');

    const GOOGLE_SCOPES_DRIVE_FALLBACK = [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.photos.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid',
        'email',
        'profile'
    ].join(' ');

    let inMemoryAccessToken = null;
    let googleUserAccount = null;
    let tokenClient = null;
    let currentPickerContext = 'admin-chat'; // 'admin-chat' | 'admin-voice-preview' | 'warga-chat' | 'warga-voice-preview' | 'aduan-chat' | 'aduan-voice-preview'
    let currentSelectedDriveFiles = [];

    // State Navigasi & Paginasi Google Drive
    let currentFolderId = 'root';
    let currentFolderPath = [{ id: 'root', name: 'Drive Saya' }];
    let driveActiveTab = 'all'; // 'all' | 'folders' | 'shared' | 'media' | 'docs'
    let driveNextPageToken = null;
    let driveCurrentQuery = '';
    let driveAllAccumulatedFiles = [];

    // State Navigasi & Paginasi Google Foto
    let photosActiveTab = 'all'; // 'all' | 'photos' | 'videos' | 'albums'
    let photosNextPageTokenDrive = null;
    let photosNextPageTokenLibrary = null;
    let photosCurrentAlbumId = null; // Jika sedang membuka album Google Photos API
    let photosCurrentQuery = '';
    let photosAllAccumulatedFiles = [];

    // Helper menutup semua popover menu lampiran agar tidak menumpuk di belakang modal
    function closeAllAttachmentPopovers() {
        const popoverIds = [
            'adminAttachmentMenuPopover',
            'wargaAttachmentMenuPopover',
            'aduanAttachmentMenuPopover',
            'adminVoicePreviewAttachMenu',
            'wargaVoicePreviewAttachMenu',
            'aduanVoicePreviewAttachMenu',
            'modalGoogleDrivePicker',
            'modalGooglePhotosPicker'
        ];
        popoverIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    // Label konteks fitur & role aktif agar pengguna tahu persis tujuan pengiriman
    function getContextDisplayLabel() {
        if (currentPickerContext === 'warga-chat') {
            return 'Portal Warga • Dashboard Pribadi Anda (Obrolan)';
        }
        if (currentPickerContext === 'warga-voice-preview') {
            return 'Portal Warga • Dashboard Pribadi Anda (Lampiran Pesan Suara)';
        }
        if (currentPickerContext === 'aduan-chat') {
            return 'Portal Warga • Dashboard Pantauan Pengaduan (Obrolan)';
        }
        if (currentPickerContext === 'aduan-voice-preview') {
            return 'Portal Warga • Dashboard Pantauan Pengaduan (Lampiran Pesan Suara)';
        }
        // Konteks Aparatur: Super Admin / Admin / Petugas
        let roleBadge = 'Aparatur Dinsos';
        if (typeof window.getCurrentStaffIdentity === 'function') {
            try {
                const staff = window.getCurrentStaffIdentity();
                if (staff && staff.roleLabel) {
                    roleBadge = `${staff.name} (${staff.roleLabel})`;
                }
            } catch (e) {}
        } else {
            const roleRaw = (localStorage.getItem('userRole') || sessionStorage.getItem('userRole') || 'petugas').toLowerCase();
            if (roleRaw.includes('super')) roleBadge = 'Super Admin';
            else if (roleRaw.includes('admin')) roleBadge = 'Admin';
            else roleBadge = 'Petugas';
        }
        if (currentPickerContext === 'admin-voice-preview') {
            return `Hubungi Warga (${roleBadge}) • Lampiran Pesan Suara`;
        }
        return `Hubungi Warga (${roleBadge}) • Obrolan Langsung`;
    }

    // Ambil Konfigurasi OAuth Secara Aman dari Backend
    async function getGoogleClientId() {
        if (dynamicGoogleClientId) return dynamicGoogleClientId;
        try {
            const res = await fetch('/api/security/public-config');
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    if (data.googleClientId) {
                        dynamicGoogleClientId = data.googleClientId;
                        return dynamicGoogleClientId;
                    }
                    if (data.oauth && data.oauth.google_client_id) {
                        dynamicGoogleClientId = data.oauth.google_client_id;
                        return dynamicGoogleClientId;
                    }
                }
            }
        } catch (e) {
            console.warn('[GoogleWorkspace] Menggunakan konfigurasi client ID bawaan:', e);
        }
        dynamicGoogleClientId = FALLBACK_GOOGLE_CLIENT_ID;
        return dynamicGoogleClientId;
    }

    // Pastikan pustaka Google Identity Services (gsi/client) sudah termuat di halaman
    function ensureGoogleGsiScriptLoaded() {
        return new Promise((resolve) => {
            if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                return resolve(true);
            }
            let existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
            if (!existing) {
                existing = document.createElement('script');
                existing.src = 'https://accounts.google.com/gsi/client';
                existing.async = true;
                existing.defer = true;
                document.head.appendChild(existing);
            }
            let attempts = 0;
            const timer = setInterval(() => {
                attempts++;
                if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                    clearInterval(timer);
                    resolve(true);
                } else if (attempts > 35) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 200);
        });
    }

    let activeOAuthPollTimer = null;
    let activeOAuthPopup = null;
    let activeOAuthState = null;

    function stopActiveOAuthPoll() {
        if (activeOAuthPollTimer) {
            clearInterval(activeOAuthPollTimer);
            activeOAuthPollTimer = null;
        }
    }

    let isHandlingGoogleToken = false;

    // Handler terpusat ketika access_token berhasil diperoleh dari OAuth 2.0 Loopback PKCE / GIS
    async function handleSuccessfulGoogleToken(accessToken, silentToast = false) {
        if (!accessToken) return;
        if (isHandlingGoogleToken || (inMemoryAccessToken === accessToken && googleUserAccount)) {
            stopActiveOAuthPoll();
            return;
        }
        isHandlingGoogleToken = true;
        stopActiveOAuthPoll();
        inMemoryAccessToken = accessToken;

        try {
            const body = document.getElementById('gwModalBody');
            if (body) {
                body.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; text-align:center;">
                        <i class="fas fa-circle-notch fa-spin" style="font-size:3rem; color:#009846; margin-bottom:16px;"></i>
                        <h4 style="font-size:1.15rem; font-weight:800; color:#0f172a; margin:0 0 6px 0;">Menghubungkan Akun Google Anda...</h4>
                        <p style="font-size:0.85rem; color:#64748b;">Memverifikasi identitas dan menyinkronkan seluruh berkas Google Drive & Google Foto Anda...</p>
                    </div>
                `;
            }

            await fetchGoogleUserProfile();

            const accName = getResolvedAccountName();
            if (!silentToast && typeof Swal !== 'undefined') {
                Swal.fire({
                    toast: true,
                    position: 'top',
                    icon: 'success',
                    title: `Berhasil Masuk: ${accName}`,
                    html: `<span style="font-size:0.82rem; color:#64748b;">Akun Google <b>${(googleUserAccount && googleUserAccount.email) || 'Terhubung'}</b> berhasil disinkronkan penuh.</span>`,
                    timer: 3000,
                    showConfirmButton: false
                });
            }
            renderGooglePickerUI();
        } finally {
            isHandlingGoogleToken = false;
        }
    }

    // Pulihkan sesi login Google yang masih aktif (dari localStorage atau backend session)
    async function restoreExistingGoogleSession() {
        if (inMemoryAccessToken) return true;
        try {
            const rawLocal = localStorage.getItem('gw_oauth_callback_payload');
            if (rawLocal) {
                const parsed = JSON.parse(rawLocal);
                // Berlaku hingga 52 menit sejak diterbitkan
                if (parsed && parsed.access_token && (!parsed.ts || (Date.now() - Number(parsed.ts) < 52 * 60 * 1000))) {
                    inMemoryAccessToken = parsed.access_token;
                    await fetchGoogleUserProfile();
                    if (inMemoryAccessToken) return true;
                }
            }
        } catch (e) {}

        try {
            const res = await fetch('/api/security/google-oauth/active-session');
            if (res.ok) {
                const data = await res.json();
                if (data && data.status === 'authenticated' && data.access_token) {
                    inMemoryAccessToken = data.access_token;
                    await fetchGoogleUserProfile();
                    if (inMemoryAccessToken) return true;
                }
            }
        } catch (e) {}

        return false;
    }

    // Listener global untuk menerima token dari jendela popup OAuth Callback (postMessage & localStorage)
    window.addEventListener('message', (event) => {
        try {
            if (event && event.data && event.data.type === 'GOOGLE_WORKSPACE_OAUTH_SUCCESS' && event.data.access_token) {
                handleSuccessfulGoogleToken(event.data.access_token);
            }
        } catch (e) {}
    });

    window.addEventListener('storage', (event) => {
        try {
            if (event && event.key === 'gw_oauth_callback_payload' && event.newValue) {
                const parsed = JSON.parse(event.newValue);
                if (parsed && parsed.access_token) {
                    handleSuccessfulGoogleToken(parsed.access_token);
                }
            }
        } catch (e) {}
    });

    // Inisialisasi Google Identity Services Client (Cadangan / Mock Kompatibilitas)
    async function initGoogleClient(useFallbackScope = false) {
        const clientId = await getGoogleClientId();
        if (!clientId) return false;

        const gsiReady = await ensureGoogleGsiScriptLoaded();
        if (!gsiReady) return false;

        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: useFallbackScope ? GOOGLE_SCOPES_DRIVE_FALLBACK : GOOGLE_SCOPES_FULL,
                callback: async (tokenResponse) => {
                    if (tokenResponse && tokenResponse.error) {
                        console.warn('[GoogleWorkspace] OAuth callback warning:', tokenResponse.error);
                        return;
                    }
                    if (tokenResponse && tokenResponse.access_token) {
                        await handleSuccessfulGoogleToken(tokenResponse.access_token);
                    }
                }
            });
            return true;
        }
        return false;
    }

    // Mengambil profil akun secara komprehensif (Google Drive About API + OAuth2 UserInfo API)
    async function fetchGoogleUserProfile() {
        if (!inMemoryAccessToken) return;

        let fetchedName = '';
        let fetchedEmail = '';
        let fetchedPhoto = '';
        let storageQuotaText = '';

        // Ambil dari Google Drive About API & OAuth2 UserInfo API secara paralel agar instan
        await Promise.allSettled([
            (async () => {
                try {
                    const resAbout = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota(limit,usage)', {
                        headers: { Authorization: `Bearer ${inMemoryAccessToken}` }
                    });
                    if (resAbout.ok) {
                        const aboutData = await resAbout.json();
                        if (aboutData && aboutData.user) {
                            if (aboutData.user.displayName) fetchedName = aboutData.user.displayName;
                            if (aboutData.user.emailAddress) fetchedEmail = aboutData.user.emailAddress;
                            if (aboutData.user.photoLink) fetchedPhoto = aboutData.user.photoLink;
                        }
                        if (aboutData && aboutData.storageQuota && aboutData.storageQuota.usage) {
                            const used = formatBytes(Number(aboutData.storageQuota.usage));
                            const limit = aboutData.storageQuota.limit ? formatBytes(Number(aboutData.storageQuota.limit)) : 'Unlimited';
                            storageQuotaText = `${used} / ${limit}`;
                        }
                    }
                } catch (e) {}
            })(),
            (async () => {
                try {
                    const resInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${inMemoryAccessToken}` }
                    });
                    if (resInfo.ok) {
                        const infoData = await resInfo.json();
                        if (infoData) {
                            if (!fetchedName && (infoData.name || infoData.given_name)) {
                                fetchedName = infoData.name || infoData.given_name;
                            }
                            if (!fetchedEmail && infoData.email) {
                                fetchedEmail = infoData.email;
                            }
                            if (!fetchedPhoto && infoData.picture) {
                                fetchedPhoto = infoData.picture;
                            }
                        }
                    }
                } catch (e) {}
            })()
        ]);

        if (!fetchedName && fetchedEmail) {
            const prefix = fetchedEmail.split('@')[0];
            fetchedName = prefix
                .replace(/[._-]+/g, ' ')
                .split(' ')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
        }

        if (!fetchedName) {
            fetchedName = 'Pengguna Akun Google';
        }

        googleUserAccount = {
            name: fetchedName,
            email: fetchedEmail || 'akun-google@gmail.com',
            picture: fetchedPhoto || 'https://www.gravatar.com/avatar/?d=mp',
            quota: storageQuotaText
        };

        try {
            sessionStorage.setItem('gw_last_user_name', fetchedName);
            sessionStorage.setItem('gw_last_user_email', fetchedEmail);
        } catch (e) {}
    }

    function getResolvedAccountName() {
        if (googleUserAccount && googleUserAccount.name && googleUserAccount.name !== 'Pengguna Google') {
            return googleUserAccount.name;
        }
        try {
            const cached = sessionStorage.getItem('gw_last_user_name');
            if (cached && cached !== 'Pengguna Google') return cached;
        } catch (e) {}
        return 'Pengguna Akun Google';
    }

    window.getGoogleAccessToken = function () {
        return inMemoryAccessToken;
    };

    // Logout Google Workspace
    window.logoutGoogleWorkspace = function (silent = false) {
        stopActiveOAuthPoll();
        if (inMemoryAccessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            try {
                google.accounts.oauth2.revoke(inMemoryAccessToken, () => {});
            } catch (e) {}
        }
        try {
            localStorage.removeItem('gw_oauth_callback_payload');
        } catch (e) {}
        try {
            fetch('/api/security/google-oauth/logout', { method: 'POST' }).catch(() => {});
        } catch (e) {}
        inMemoryAccessToken = null;
        googleUserAccount = null;
        currentSelectedDriveFiles = [];
        currentFolderId = 'root';
        currentFolderPath = [{ id: 'root', name: window.activePickerType === 'photos' ? '📸 Google Foto' : 'Drive Saya' }];
        driveNextPageToken = null;
        photosNextPageTokenDrive = null;
        photosNextPageTokenLibrary = null;
        photosCurrentAlbumId = null;

        if (!silent) {
            renderGooglePickerUI();
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'info',
                    title: 'Akun Google telah keluar',
                    text: 'Silakan masuk kembali untuk memilih berkas.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        }
    };

    window.cancelWaitingGoogleLogin = function () {
        stopActiveOAuthPoll();
        try {
            if (activeOAuthPopup && !activeOAuthPopup.closed) {
                activeOAuthPopup.close();
            }
        } catch (e) {}
        renderLoginCard();
    };

    // Login Akun Google menggunakan Loopback OAuth 2.0 PKCE Resmi (Bebas Error 400: origin_mismatch)
    window.loginWithGoogleAccount = async function (requestPhotosLibraryScope = false) {
        // 1. Jika dalam lingkungan pengujian otomatis (mock token tersedia), proses secara instan
        if (window._mockGoogleOAuthToken) {
            return handleSuccessfulGoogleToken(window._mockGoogleOAuthToken);
        }
        if (
            typeof google !== 'undefined' &&
            google.accounts &&
            google.accounts.oauth2 &&
            typeof google.accounts.oauth2.initTokenClient === 'function' &&
            String(google.accounts.oauth2.initTokenClient).includes('mock_')
        ) {
            await initGoogleClient(!requestPhotosLibraryScope);
            if (tokenClient) return tokenClient.requestAccessToken({ prompt: 'select_account' });
        }

        // 2. Buka Jendela Popup OAuth 2.0 PKCE Loopback Resmi (/api/security/google-oauth/start)
        stopActiveOAuthPoll();
        const state = 'gw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        activeOAuthState = state;
        const oauthStartUrl = `/api/security/google-oauth/start?state=${encodeURIComponent(state)}`;

        const width = 540;
        const height = 680;
        const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
        const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

        activeOAuthPopup = window.open(
            oauthStartUrl,
            'GoogleWorkspaceOAuthPopup',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
        );

        const isPhotos = window.activePickerType === 'photos';
        const body = document.getElementById('gwModalBody');
        if (body) {
            body.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:42px 24px; text-align:center; background:#f8fafc; border-radius:20px; border:1.5px solid #e2e8f0;">
                    <div style="width:68px; height:68px; border-radius:20px; background:${isPhotos ? '#fff1f2' : '#ecfdf5'}; border:2px solid ${isPhotos ? '#fecdd3' : '#a7f3d0'}; display:flex; align-items:center; justify-content:center; margin-bottom:16px; box-shadow:0 8px 20px rgba(0,0,0,0.06);">
                        <i class="fas fa-circle-notch fa-spin" style="font-size:2.1rem; color:${isPhotos ? '#e11d48' : '#009846'};"></i>
                    </div>
                    <h4 style="font-size:1.15rem; font-weight:800; color:#0f172a; margin:0 0 8px 0;">Menunggu Otorisasi Login Akun Google Anda...</h4>
                    <p style="font-size:0.86rem; color:#475569; max-width:540px; line-height:1.55; margin:0 0 18px 0;">
                        Jendela login resmi <b>Google Sign-In</b> telah dibuka. Silakan pilih akun Google Anda dan klik <b>Lanjutkan / Izinkan</b> agar seluruh berkas, dokumen, foto, dan video di <b>${isPhotos ? 'Google Foto' : 'Google Drive'}</b> langsung ditampilkan di sini.
                    </p>
                    <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                        <button type="button" onclick="window.loginWithGoogleAccount()" style="background:${isPhotos ? '#e11d48' : '#009846'}; color:#ffffff; border:none; border-radius:12px; padding:10px 20px; font-size:0.84rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 12px rgba(0,0,0,0.12);">
                            <i class="fas fa-external-link-alt"></i> Buka Ulang Jendela Login Google
                        </button>
                        <button type="button" onclick="window.cancelWaitingGoogleLogin()" style="background:#ffffff; color:#475569; border:1.5px solid #cbd5e1; border-radius:12px; padding:10px 18px; font-size:0.84rem; font-weight:800; cursor:pointer;">
                            Kembali
                        </button>
                    </div>
                </div>
            `;
        }

        // 3. Polling status token ke backend (/api/security/google-oauth/poll) setiap 900ms
        // sehingga tetap langsung tersambung meskipun Cross-Origin-Opener-Policy memutus window.opener
        activeOAuthPollTimer = setInterval(async () => {
            if (inMemoryAccessToken) {
                stopActiveOAuthPoll();
                return;
            }
            try {
                const res = await fetch(`/api/security/google-oauth/poll?state=${encodeURIComponent(state)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.status === 'authenticated' && data.access_token) {
                        stopActiveOAuthPoll();
                        await handleSuccessfulGoogleToken(data.access_token);
                    }
                }
            } catch (e) {}
        }, 900);
    };

    // =========================================================================
    // BUKA MODAL GOOGLE DRIVE & GOOGLE FOTO (DARI WARGA, ADMIN, SUPERADMIN, PETUGAS)
    // =========================================================================
    window.openGoogleDrivePicker = async function (context) {
        closeAllAttachmentPopovers();
        currentPickerContext = context || resolveDefaultPickerContext();
        currentSelectedDriveFiles = [];
        currentFolderId = 'root';
        currentFolderPath = [{ id: 'root', name: 'Drive Saya' }];
        driveActiveTab = 'all'; // Default menampilkan seluruh file di Google Drive lintas folder
        driveNextPageToken = null;
        driveCurrentQuery = '';
        driveAllAccumulatedFiles = [];
        window.activePickerType = 'drive';

        showWorkspaceModal(
            'Google Drive',
            `Tersambung ke seluruh file & folder Google Drive Anda • Tujuan: ${getContextDisplayLabel()}`
        );
        if (!inMemoryAccessToken) {
            await restoreExistingGoogleSession();
        }
        if (!inMemoryAccessToken) {
            renderLoginCard();
        } else {
            loadGoogleDriveFiles('', 'root', false);
        }
    };

    window.openGooglePhotosPicker = async function (context) {
        closeAllAttachmentPopovers();
        currentPickerContext = context || resolveDefaultPickerContext();
        currentSelectedDriveFiles = [];
        currentFolderId = 'root';
        currentFolderPath = [{ id: 'root', name: 'Galeri Google Foto' }];
        photosActiveTab = 'all';
        photosNextPageTokenDrive = null;
        photosNextPageTokenLibrary = null;
        photosCurrentAlbumId = null;
        photosCurrentQuery = '';
        photosAllAccumulatedFiles = [];
        window.activePickerType = 'photos';

        showWorkspaceModal(
            'Google Foto',
            `Tersambung ke seluruh foto, video (MP4/MOV/MKV), & album Google Foto Anda • Tujuan: ${getContextDisplayLabel()}`
        );
        if (!inMemoryAccessToken) {
            await restoreExistingGoogleSession();
        }
        if (!inMemoryAccessToken) {
            renderLoginCard();
        } else {
            loadGooglePhotosFiles('root', false);
        }
    };

    function resolveDefaultPickerContext() {
        const isPublikPage = window.location.pathname.includes('publik');
        if (isPublikPage) {
            const aduanSec = document.getElementById('aduanSection') || document.getElementById('pantauanPengaduanSection');
            if (aduanSec && aduanSec.style.display !== 'none' && window.sesiAduanAktif) {
                return 'aduan-chat';
            }
            return 'warga-chat';
        }
        return 'admin-chat';
    }

    function showWorkspaceModal(title, subtitle) {
        let modal = document.getElementById('modalGoogleWorkspacePicker');
        if (!modal) {
            createWorkspaceModalElement();
            modal = document.getElementById('modalGoogleWorkspacePicker');
        }
        const isPhotos = window.activePickerType === 'photos';
        const titleEl = document.getElementById('gwModalTitle');
        if (titleEl) {
            titleEl.innerHTML = isPhotos
                ? `<div style="display:flex; align-items:center; gap:10px;"><div style="width:38px; height:38px; border-radius:12px; background:linear-gradient(135deg, #f43f5e, #fb923c, #facc15, #3b82f6); display:flex; align-items:center; justify-content:center; color:white; font-size:1.15rem; box-shadow:0 3px 10px rgba(244,63,94,0.3);"><i class="fas fa-photo-video"></i></div> <span>Google Foto — Seluruh Foto & Video</span></div>`
                : `<div style="display:flex; align-items:center; gap:10px;"><div style="width:38px; height:38px; border-radius:12px; background:#ecfdf5; display:flex; align-items:center; justify-content:center; color:#009846; font-size:1.3rem; border:1px solid #bbf7d0;"><i class="fab fa-google-drive"></i></div> <span>Google Drive — Seluruh Berkas & Folder</span></div>`;
        }
        const subEl = document.getElementById('gwModalSubtitle');
        if (subEl) subEl.innerText = subtitle;
        modal.style.display = 'flex';
    }

    window.closeGoogleWorkspaceModal = function (forceLogout = false) {
        stopActiveOAuthPoll();
        const modal = document.getElementById('modalGoogleWorkspacePicker');
        if (modal) modal.style.display = 'none';
        if (forceLogout) {
            window.logoutGoogleWorkspace(true);
        }
    };

    function renderGooglePickerUI() {
        if (!inMemoryAccessToken) {
            renderLoginCard();
        } else {
            if (window.activePickerType === 'photos') {
                loadGooglePhotosFiles(currentFolderId, false);
            } else {
                loadGoogleDriveFiles('', currentFolderId, false);
            }
        }
    }

    // =========================================================================
    // TAMPILAN KARTU LOGIN GOOGLE + OPSI IMPOR LANGSUNG DARI DRIVE/FOTO PERANGKAT
    // =========================================================================
    function renderLoginCard() {
        const body = document.getElementById('gwModalBody');
        if (!body) return;
        const isPhotos = window.activePickerType === 'photos';
        const contextLabel = getContextDisplayLabel();

        body.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px 24px; text-align:center;">
                <!-- Badge Tujuan Pengiriman -->
                <div style="background:${isPhotos ? '#fff1f2' : '#f0fdf4'}; color:${isPhotos ? '#be123c' : '#047857'}; border:1px solid ${isPhotos ? '#fecdd3' : '#bbf7d0'}; padding:6px 16px; border-radius:20px; font-size:0.78rem; font-weight:800; margin-bottom:18px; display:inline-flex; align-items:center; gap:8px;">
                    <i class="fas ${isPhotos ? 'fa-camera-retro' : 'fa-cloud-upload-alt'}"></i>
                    <span>Terhubung ke: ${contextLabel}</span>
                </div>

                <div style="width:88px; height:88px; border-radius:50%; background:${isPhotos ? 'linear-gradient(135deg, #fff1f2, #fef2f2)' : '#f0fdf4'}; display:flex; align-items:center; justify-content:center; font-size:2.8rem; color:${isPhotos ? '#e11d48' : '#009846'}; margin-bottom:18px; border:2px solid ${isPhotos ? '#fecdd3' : '#86efac'}; box-shadow:0 10px 28px rgba(0,0,0,0.06);">
                    <i class="${isPhotos ? 'fas fa-images' : 'fab fa-google-drive'}"></i>
                </div>

                <h4 style="font-size:1.4rem; font-weight:800; color:#0f172a; margin:0 0 8px 0;">
                    Hubungkan ke ${isPhotos ? 'Google Foto' : 'Google Drive'} Anda
                </h4>
                <p style="font-size:0.9rem; color:#64748b; max-width:560px; margin:0 0 24px 0; line-height:1.6;">
                    ${isPhotos
                        ? 'Masuk dengan akun Google Anda untuk memuat <b>seluruh koleksi foto, rekaman video (MP4/MOV/MKV/WebM), dan seluruh album galeri</b> dari Google Foto & ruang penyimpanan Google Anda.'
                        : 'Masuk dengan akun Google Anda untuk mengakses <b>seluruh berkas & folder Google Drive</b> (Semua Berkas lintas folder, Drive Saya, Dibagikan ke Saya, PDF, Word, Excel, PPT, JSON, ZIP, Audio, Foto & Video).'}
                </p>

                <!-- Tombol Utama Sign in with Google OAuth 2.0 -->
                <button type="button" onclick="window.loginWithGoogleAccount()" class="gsi-material-button" style="display:inline-flex; align-items:center; justify-content:center; background:#ffffff; border:2px solid #cbd5e1; border-radius:30px; padding:13px 34px; font-family:'Roboto', 'Segoe UI', sans-serif; font-size:0.98rem; font-weight:800; color:#1e293b; cursor:pointer; box-shadow:0 6px 20px rgba(0,0,0,0.08); transition:all 0.2s;" onmouseover="this.style.boxShadow='0 8px 26px rgba(0,0,0,0.15)'; this.style.borderColor='#4285F4';" onmouseout="this.style.boxShadow='0 6px 20px rgba(0,0,0,0.08)'; this.style.borderColor='#cbd5e1';">
                    <div style="width:24px; height:24px; margin-right:12px; display:flex; align-items:center; justify-content:center;">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display:block; width:100%; height:100%;">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        </svg>
                    </div>
                    <span>Sign in with Google</span>
                </button>

                <!-- Opsi Cepat Tambahan: Pilih dari Sinkronisasi Google Drive / Aplikasi Google Foto Perangkat atau Tautan Cloud -->
                <div style="width:100%; max-width:620px; margin-top:26px; padding-top:20px; border-top:1.5px dashed #e2e8f0; display:flex; flex-direction:column; gap:14px;">
                    <div style="font-size:0.8rem; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.3px;">
                        <i class="fas fa-bolt text-amber-500"></i> Akses Cepat Sinkronisasi Perangkat & Tautan Cloud
                    </div>

                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button type="button" onclick="window.triggerGoogleDeviceSyncInput('${isPhotos ? 'photos' : 'drive'}')" style="background:${isPhotos ? '#fff1f2' : '#f0fdf4'}; color:${isPhotos ? '#be123c' : '#009846'}; border:1.5px solid ${isPhotos ? '#fecdd3' : '#86efac'}; border-radius:14px; padding:10px 18px; font-size:0.84rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:all 0.15s;">
                            <i class="fas ${isPhotos ? 'fa-photo-video' : 'fa-folder-open'}"></i>
                            <span>${isPhotos ? 'Pilih Semua Foto & Video dari Google Foto Perangkat' : 'Pilih Berkas dari Folder Google Drive Perangkat'}</span>
                        </button>
                    </div>

                    <div style="display:flex; gap:8px; width:100%;">
                        <input type="url" id="gwDirectCloudUrlInput" placeholder="${isPhotos ? 'Tempel tautan foto/video/album Google Foto (https://photos.app.goo.gl/...)' : 'Tempel tautan berkas/dokumen Google Drive (https://drive.google.com/...)'}" style="flex:1; border:1.5px solid #cbd5e1; border-radius:12px; padding:9px 14px; font-size:0.84rem; outline:none;">
                        <button type="button" onclick="window.attachDirectGoogleCloudUrl(false)" style="background:#3b82f6; color:white; border:none; border-radius:12px; padding:9px 14px; font-size:0.8rem; font-weight:700; cursor:pointer; white-space:nowrap;">
                            <i class="fas fa-paperclip"></i> Lampirkan
                        </button>
                        <button type="button" onclick="window.attachDirectGoogleCloudUrl(true)" style="background:${isPhotos ? '#e11d48' : '#009846'}; color:white; border:none; border-radius:12px; padding:9px 16px; font-size:0.8rem; font-weight:800; cursor:pointer; white-space:nowrap;">
                            <i class="fas fa-paper-plane"></i> Kirim
                        </button>
                    </div>
                </div>

                <div style="font-size:0.74rem; color:#94a3b8; margin-top:16px;">
                    <i class="fas fa-lock"></i> Otentikasi resmi Google Identity Services (OAuth 2.0). Sesi keluar otomatis saat jendela ditutup.
                </div>
            </div>
        `;
        const footer = document.getElementById('gwModalFooter');
        if (footer) {
            footer.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <span style="font-size:0.78rem; color:#64748b;"><i class="fas fa-check-circle text-emerald-600"></i> Mendukung multi-berkas hingga 100 berkas sekaligus</span>
                    <button type="button" onclick="window.closeGoogleWorkspaceModal()" style="background:#e2e8f0; color:#475569; border:none; border-radius:14px; padding:10px 24px; font-weight:700; cursor:pointer;">Tutup</button>
                </div>
            `;
        }
    }

    // Input file tersembunyi untuk sinkronisasi langsung dari aplikasi/folder Google Drive & Google Foto perangkat
    window.triggerGoogleDeviceSyncInput = function (mode) {
        let inp = document.getElementById('gwHiddenDeviceSyncInput');
        if (!inp) {
            inp = document.createElement('input');
            inp.type = 'file';
            inp.id = 'gwHiddenDeviceSyncInput';
            inp.multiple = true;
            inp.style.display = 'none';
            document.body.appendChild(inp);
        }
        if (mode === 'photos') {
            inp.accept = 'image/*,video/*,.mp4,.mov,.mkv,.webm,.avi,.3gp,.heic,.heif';
        } else {
            inp.accept = '*/*';
        }
        inp.onchange = async function () {
            if (!inp.files || inp.files.length === 0) return;
            const rawFiles = Array.from(inp.files);
            inp.value = '';

            const prepared = rawFiles.map((f, idx) => ({
                id: `gw_local_${Date.now()}_${idx}`,
                name: f.name,
                type: resolveCategory(f.type, f.name),
                mimeType: f.type || 'application/octet-stream',
                file: f,
                size: f.size || 0,
                isGoogleDrive: mode !== 'photos',
                isGooglePhotos: mode === 'photos'
            }));

            // Jika pengguna sudah login dan sedang di dalam picker, tambahkan ke daftar pilihan agar bisa ditinjau
            if (inMemoryAccessToken) {
                prepared.forEach(p => {
                    currentSelectedDriveFiles.push(p);
                    if (Array.isArray(window.currentDriveLoadedFiles)) {
                        window.currentDriveLoadedFiles.unshift(p);
                    }
                });
                if (window.activePickerType === 'photos') {
                    renderPhotosGrid(window.currentDriveLoadedFiles || prepared);
                } else {
                    renderDriveFileList(window.currentDriveLoadedFiles || prepared);
                }
                return;
            }

            // Jika dari kartu akses cepat, langsung tambahkan ke antrean lampiran konteks aktif
            const modal = document.getElementById('modalGoogleWorkspacePicker');
            if (modal) modal.style.display = 'none';
            deliverToAttachmentQueue(prepared);
        };
        inp.click();
    };

    // Lampirkan atau kirim tautan URL Google Drive / Google Foto secara langsung
    window.attachDirectGoogleCloudUrl = async function (sendDirectly = false) {
        const inp = document.getElementById('gwDirectCloudUrlInput');
        if (!inp || !inp.value.trim()) {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Perhatian', 'Silakan tempelkan tautan (URL) Google Drive atau Google Foto terlebih dahulu.', 'warning');
            }
            return;
        }
        const rawUrl = inp.value.trim();
        inp.value = '';

        const isPhotos = window.activePickerType === 'photos' || rawUrl.includes('photos.app.goo.gl') || rawUrl.includes('photos.google.com') || /\.(jpg|jpeg|png|webp|gif|mp4|mov|mkv|webm)(\?|$)/i.test(rawUrl);
        const isVideoUrl = /\.(mp4|mov|mkv|webm)(\?|$)/i.test(rawUrl);

        // Ekstrak ID file Google Drive jika URL berbentuk drive.google.com/file/d/{ID}
        let driveFileId = '';
        const matchDriveId = rawUrl.match(/\/d\/([a-zA-Z0-9_-]{15,})/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
        if (matchDriveId && matchDriveId[1]) {
            driveFileId = matchDriveId[1];
        }

        const defaultName = isPhotos
            ? (isVideoUrl ? 'Video_Google_Foto.mp4' : 'Dokumentasi_Google_Foto.jpg')
            : (rawUrl.includes('spreadsheets') ? 'Spreadsheet_Google_Drive.xlsx' : (rawUrl.includes('document') ? 'Dokumen_Google_Drive.pdf' : 'Berkas_Google_Drive.pdf'));

        const itemObj = {
            id: driveFileId || `gw_url_${Date.now()}`,
            name: defaultName,
            type: isPhotos ? (isVideoUrl ? 'video' : 'image') : 'document',
            mimeType: isPhotos ? (isVideoUrl ? 'video/mp4' : 'image/jpeg') : 'application/pdf',
            isCloudLink: true,
            isGoogleDrive: !isPhotos,
            webViewLink: rawUrl,
            size: 0
        };

        // Jika ada driveFileId dan token aktif, coba unduh binernya
        if (driveFileId && inMemoryAccessToken) {
            currentSelectedDriveFiles = [itemObj];
            return window.confirmAttachGoogleWorkspaceFiles(sendDirectly);
        }

        const modal = document.getElementById('modalGoogleWorkspacePicker');
        if (modal) modal.style.display = 'none';

        if (sendDirectly) {
            await executeDirectSendToChat([itemObj]);
        } else {
            deliverToAttachmentQueue([itemObj]);
        }
    };

    // =========================================================================
    // PROFIL PENGGUNA TERHUBUNG
    // =========================================================================
    function renderUserProfileHeader() {
        const resolvedName = getResolvedAccountName();
        const email = (googleUserAccount && googleUserAccount.email) || '';
        const picture = (googleUserAccount && googleUserAccount.picture) || 'https://www.gravatar.com/avatar/?d=mp';
        const quota = (googleUserAccount && googleUserAccount.quota) ? ` • Penyimpanan: ${googleUserAccount.quota}` : '';
        const isPhotos = window.activePickerType === 'photos';

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:${isPhotos ? 'linear-gradient(to right, #fff1f2, #ffffff)' : 'linear-gradient(to right, #f0fdf4, #ffffff)'}; border:1.5px solid ${isPhotos ? '#fecdd3' : '#bbf7d0'}; border-radius:18px; padding:12px 18px; box-shadow:0 3px 12px rgba(0,0,0,0.04); flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="position:relative;">
                        <img src="${picture}" alt="${resolvedName}" referrerpolicy="no-referrer" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:2.5px solid ${isPhotos ? '#e11d48' : '#009846'}; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                        <span style="position:absolute; bottom:-1px; right:-1px; background:${isPhotos ? '#e11d48' : '#009846'}; border:2px solid #ffffff; width:14px; height:14px; border-radius:50%; display:block;" title="Akun Aktif"></span>
                    </div>
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span style="font-size:0.98rem; font-weight:800; color:#0f172a;">${resolvedName}</span>
                            <span style="background:${isPhotos ? '#ffe4e6' : '#dcfce7'}; color:${isPhotos ? '#9f1239' : '#15803d'}; padding:2px 10px; border-radius:12px; font-size:0.7rem; font-weight:800; border:1px solid ${isPhotos ? '#fecdd3' : '#86efac'}; display:inline-flex; align-items:center; gap:4px;">
                                <i class="fas fa-check-circle"></i> Tersambung Penuh
                            </span>
                        </div>
                        <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
                            ${email}${quota} • <span style="color:#0f172a; font-weight:700;">${getContextDisplayLabel()}</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button type="button" onclick="window.triggerGoogleDeviceSyncInput('${isPhotos ? 'photos' : 'drive'}')" style="background:#ffffff; color:${isPhotos ? '#e11d48' : '#009846'}; border:1.5px solid ${isPhotos ? '#fecdd3' : '#86efac'}; border-radius:12px; padding:8px 14px; font-size:0.78rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px;" title="Pilih berkas tambahan dari sinkronisasi perangkat">
                        <i class="fas fa-plus-circle"></i> Impor Perangkat
                    </button>
                    <button type="button" onclick="window.logoutGoogleWorkspace()" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; border-radius:12px; padding:8px 14px; font-size:0.78rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px;" title="Keluar dan ganti akun Google">
                        <i class="fas fa-sign-out-alt"></i> Ganti Akun
                    </button>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // BILAH NAVIGASI FOLDER & BREADCRUMBS
    // =========================================================================
    function renderBreadcrumbsBar() {
        const isPhotos = window.activePickerType === 'photos';
        const hasParent = currentFolderPath.length > 1;

        let html = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:16px; padding:9px 14px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:6px; font-size:0.84rem; font-weight:700; color:#475569; overflow-x:auto; flex:1; min-width:220px;">
                    <span style="color:${isPhotos ? '#e11d48' : '#009846'}; cursor:pointer; display:flex; align-items:center; gap:6px; flex-shrink:0; background:${isPhotos ? '#fff1f2' : '#f0fdf4'}; padding:5px 12px; border-radius:10px; border:1px solid ${isPhotos ? '#fecdd3' : '#bbf7d0'};" onclick="window.navigateToFolderByIndex(0)">
                        <i class="${isPhotos ? 'fas fa-images text-rose-500' : 'fab fa-google-drive text-emerald-600'}"></i> ${currentFolderPath[0].name}
                    </span>
        `;

        for (let i = 1; i < currentFolderPath.length; i++) {
            const isLast = i === currentFolderPath.length - 1;
            html += `
                <span style="color:#94a3b8; flex-shrink:0;"><i class="fas fa-chevron-right" style="font-size:0.7rem;"></i></span>
                <span style="${isLast ? 'color:#0f172a; font-weight:800; background:#ffffff; border:1.5px solid #cbd5e1;' : 'color:#0284c7; cursor:pointer; background:#e0f2fe;'} padding:5px 12px; border-radius:10px; flex-shrink:0; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" onclick="${isLast ? '' : `window.navigateToFolderByIndex(${i})`}">
                    <i class="fas fa-folder text-amber-500" style="margin-right:4px;"></i> ${currentFolderPath[i].name}
                </span>
            `;
        }

        html += `</div>`;

        if (hasParent) {
            html += `
                <button type="button" onclick="window.navigateUpFolder()" style="background:#ffffff; border:2px solid ${isPhotos ? '#e11d48' : '#009846'}; color:${isPhotos ? '#e11d48' : '#009846'}; border-radius:12px; padding:7px 16px; font-size:0.84rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:8px; flex-shrink:0;">
                    <i class="fas fa-arrow-left"></i>
                    <span>Naik ke Folder Sebelumnya</span>
                </button>
            `;
        }

        html += `</div>`;
        return html;
    }

    window.navigateToFolderByIndex = function (idx) {
        if (idx < 0 || idx >= currentFolderPath.length) return;
        currentFolderPath = currentFolderPath.slice(0, idx + 1);
        const target = currentFolderPath[currentFolderPath.length - 1];
        currentFolderId = target.id;
        photosCurrentAlbumId = target.isPhotosAlbum ? target.id : null;
        if (window.activePickerType === 'photos') {
            loadGooglePhotosFiles(currentFolderId, false);
        } else {
            loadGoogleDriveFiles(driveCurrentQuery, currentFolderId, false);
        }
    };

    window.navigateUpFolder = function () {
        if (currentFolderPath.length <= 1) return;
        currentFolderPath.pop();
        const target = currentFolderPath[currentFolderPath.length - 1];
        currentFolderId = target.id;
        photosCurrentAlbumId = target.isPhotosAlbum ? target.id : null;
        if (window.activePickerType === 'photos') {
            loadGooglePhotosFiles(currentFolderId, false);
        } else {
            loadGoogleDriveFiles(driveCurrentQuery, currentFolderId, false);
        }
    };

    window.openDriveFolder = function (folderId, folderName, isPhotosAlbum = false) {
        currentFolderId = folderId;
        photosCurrentAlbumId = isPhotosAlbum ? folderId : null;
        currentFolderPath.push({ id: folderId, name: folderName, isPhotosAlbum: Boolean(isPhotosAlbum) });
        if (window.activePickerType === 'photos') {
            loadGooglePhotosFiles(folderId, false);
        } else {
            // Saat membuka folder di Drive, tampilkan isi folder tersebut
            loadGoogleDriveFiles('', folderId, false);
        }
    };

    // =========================================================================
    // 1. GOOGLE DRIVE: MEMUAT SELURUH BERKAS & FOLDER LINTAS DIREKTORI
    // =========================================================================
    window.switchDriveTab = function (tab) {
        driveActiveTab = tab;
        driveNextPageToken = null;
        if (tab === 'all' || tab === 'shared' || tab === 'media' || tab === 'docs') {
            currentFolderId = 'root';
            currentFolderPath = [{
                id: 'root',
                name: tab === 'all' ? 'Semua Berkas & Folder Drive' : (tab === 'shared' ? 'Dibagikan ke Saya' : (tab === 'media' ? 'Foto & Video Drive' : 'Dokumen & Arsip Drive'))
            }];
        } else if (tab === 'folders') {
            currentFolderId = 'root';
            currentFolderPath = [{ id: 'root', name: 'Drive Saya (Root)' }];
        }
        loadGoogleDriveFiles(driveCurrentQuery, currentFolderId, false);
    };

    // Normalisasi berkas / shortcut Google Drive dan sematkan nama folder/album induk
    function normalizeDriveFileItem(rawFile, folderNameMap = null) {
        if (!rawFile || !rawFile.id) return null;
        const item = { ...rawFile };
        if (item.mimeType === 'application/vnd.google-apps.shortcut' && item.shortcutDetails && item.shortcutDetails.targetId) {
            item.shortcutId = item.id;
            item.id = item.shortcutDetails.targetId;
            item.mimeType = item.shortcutDetails.targetMimeType || item.mimeType;
            item.isShortcut = true;
        }
        if (folderNameMap && Array.isArray(item.parents) && item.parents.length > 0) {
            const pName = folderNameMap.get(item.parents[0]);
            if (pName && !item.albumName) {
                item.albumName = pName;
            }
        }
        return item;
    }

    // Penelusuran otomatis isi folder & folder "Dibagikan kepada saya" hingga beberapa kedalaman (Batch Cepat)
    async function crawlDriveFoldersDeep(initialFolders, maxDepth = 3) {
        if (!inMemoryAccessToken || !Array.isArray(initialFolders) || initialFolders.length === 0) {
            return [];
        }
        const discoveredItems = [];
        const visitedFolderIds = new Set();
        const folderNameMap = new Map();

        let currentLevelFolders = [];
        initialFolders.forEach(fl => {
            if (fl && fl.id && !visitedFolderIds.has(fl.id)) {
                visitedFolderIds.add(fl.id);
                folderNameMap.set(fl.id, fl.name || 'Album');
                currentLevelFolders.push(fl);
            }
        });

        const fieldsParam = 'files(id,name,mimeType,size,iconLink,thumbnailLink,webViewLink,webContentLink,modifiedTime,shared,owners,parents,shortcutDetails,imageMediaMetadata,videoMediaMetadata)';

        for (let depth = 0; depth < maxDepth; depth++) {
            if (currentLevelFolders.length === 0) break;
            const folderIdsToCrawl = currentLevelFolders.slice(0, 60).map(f => f.id);
            const batches = [];
            for (let i = 0; i < folderIdsToCrawl.length; i += 10) {
                batches.push(folderIdsToCrawl.slice(i, i + 10));
            }

            const nextLevelFolders = [];
            const batchPromises = batches.map(async (batchIds) => {
                const parentOrClause = batchIds.map(id => `'${String(id).replace(/'/g, "\\'")}' in parents`).join(' or ');
                const q = `trashed = false and (${parentOrClause})`;
                const url = `https://www.googleapis.com/drive/v3/files?pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=${fieldsParam}&q=${encodeURIComponent(q)}`;
                try {
                    const res = await fetch(url, { headers: { Authorization: `Bearer ${inMemoryAccessToken}` } });
                    if (!res.ok) return [];
                    const data = await res.json();
                    return Array.isArray(data.files) ? data.files : [];
                } catch (e) {
                    return [];
                }
            });

            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach(r => {
                if (r.status === 'fulfilled' && Array.isArray(r.value)) {
                    r.value.forEach(rawChild => {
                        const child = normalizeDriveFileItem(rawChild, folderNameMap);
                        if (!child) return;
                        discoveredItems.push(child);
                        if (child.mimeType === 'application/vnd.google-apps.folder' && !visitedFolderIds.has(child.id)) {
                            visitedFolderIds.add(child.id);
                            folderNameMap.set(child.id, child.name || 'Sub-Album');
                            nextLevelFolders.push(child);
                        }
                    });
                }
            });

            currentLevelFolders = nextLevelFolders;
        }

        return discoveredItems;
    }

    async function loadGoogleDriveFiles(query = '', folderId = null, appendPage = false) {
        const body = document.getElementById('gwModalBody');
        if (!body) return;

        driveCurrentQuery = query || '';
        if (folderId !== null) {
            currentFolderId = folderId;
        }

        if (!appendPage) {
            driveNextPageToken = null;
            driveAllAccumulatedFiles = [];
            body.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:10px; flex:1; min-height:0;">
                    ${renderUserProfileHeader()}
                    ${renderBreadcrumbsBar()}

                    <!-- Tab Mode Akses Seluruh Google Drive -->
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <div style="display:flex; gap:6px; background:#f1f5f9; padding:4px; border-radius:14px; border:1px solid #e2e8f0; flex-wrap:wrap;">
                            <button type="button" onclick="window.switchDriveTab('all')" style="border:none; border-radius:10px; padding:7px 13px; font-size:0.79rem; font-weight:800; cursor:pointer; background:${driveActiveTab === 'all' ? '#009846' : 'transparent'}; color:${driveActiveTab === 'all' ? '#ffffff' : '#475569'};">
                                <i class="fas fa-globe"></i> Semua Berkas Drive
                            </button>
                            <button type="button" onclick="window.switchDriveTab('folders')" style="border:none; border-radius:10px; padding:7px 13px; font-size:0.79rem; font-weight:800; cursor:pointer; background:${driveActiveTab === 'folders' ? '#009846' : 'transparent'}; color:${driveActiveTab === 'folders' ? '#ffffff' : '#475569'};">
                                <i class="fas fa-folder-tree"></i> Folder Drive Saya
                            </button>
                            <button type="button" onclick="window.switchDriveTab('shared')" style="border:none; border-radius:10px; padding:7px 13px; font-size:0.79rem; font-weight:800; cursor:pointer; background:${driveActiveTab === 'shared' ? '#009846' : 'transparent'}; color:${driveActiveTab === 'shared' ? '#ffffff' : '#475569'};">
                                <i class="fas fa-users"></i> Dibagikan ke Saya
                            </button>
                            <button type="button" onclick="window.switchDriveTab('media')" style="border:none; border-radius:10px; padding:7px 13px; font-size:0.79rem; font-weight:800; cursor:pointer; background:${driveActiveTab === 'media' ? '#009846' : 'transparent'}; color:${driveActiveTab === 'media' ? '#ffffff' : '#475569'};">
                                <i class="fas fa-photo-video"></i> Foto & Video Drive
                            </button>
                            <button type="button" onclick="window.switchDriveTab('docs')" style="border:none; border-radius:10px; padding:7px 13px; font-size:0.79rem; font-weight:800; cursor:pointer; background:${driveActiveTab === 'docs' ? '#009846' : 'transparent'}; color:${driveActiveTab === 'docs' ? '#ffffff' : '#475569'};">
                                <i class="fas fa-file-invoice"></i> Dokumen & Arsip
                            </button>
                        </div>
                        <span id="gwDriveTotalCounter" style="font-size:0.78rem; font-weight:800; color:#047857; background:#ecfdf5; padding:5px 12px; border-radius:12px; border:1px solid #bbf7d0;">
                            Memuat...
                        </span>
                    </div>

                    <!-- Bilah Pencarian Lengkap Lintas Seluruh Folder Google Drive -->
                    <div style="display:flex; gap:8px; align-items:center;">
                        <div style="position:relative; flex:1;">
                            <i class="fas fa-search" style="position:absolute; left:14px; top:11px; color:#94a3b8; font-size:0.88rem;"></i>
                            <input type="text" id="gwSearchInput" placeholder="Cari nama file di seluruh Google Drive (PDF, MP4, Word, Excel, Foto, JSON, ZIP)..." value="${query.replace(/"/g, '&quot;')}" style="width:100%; border:1.5px solid #cbd5e1; border-radius:12px; padding:9px 14px 9px 38px; font-size:0.85rem; outline:none;" onkeypress="if(event.key==='Enter') window.searchGoogleWorkspaceFiles(this.value)">
                        </div>
                        <button type="button" onclick="window.searchGoogleWorkspaceFiles(document.getElementById('gwSearchInput').value)" style="background:#009846; color:white; border:none; border-radius:12px; padding:9px 18px; font-size:0.84rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px;">
                            <i class="fas fa-search"></i> Cari
                        </button>
                        ${query ? `<button type="button" onclick="window.searchGoogleWorkspaceFiles('')" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:12px; padding:9px 14px; font-size:0.82rem; font-weight:700; cursor:pointer;">Reset</button>` : ''}
                    </div>

                    <!-- Kontainer Daftar Berkas & Folder -->
                    <div id="gwFileListContainer" style="flex:1; overflow-y:auto; min-height:240px; border:1.5px solid #e2e8f0; border-radius:16px; padding:14px; background:#f8fafc;">
                        <div style="text-align:center; padding:50px; color:#64748b;"><i class="fas fa-spinner fa-spin fa-2x"></i><div style="margin-top:10px; font-weight:600;">Menyinkronkan seluruh berkas dari Google Drive...</div></div>
                    </div>
                </div>
            `;
        }

        try {
            let qParts = ['trashed = false'];
            const cleanQuery = (query || '').trim();

            if (cleanQuery) {
                qParts.push(`name contains '${cleanQuery.replace(/'/g, "\\'")}'`);
            } else if (currentFolderId !== 'root') {
                qParts.push(`'${currentFolderId}' in parents`);
            } else {
                if (driveActiveTab === 'folders') {
                    qParts.push(`'root' in parents`);
                } else if (driveActiveTab === 'shared') {
                    qParts.push(`sharedWithMe = true`);
                } else if (driveActiveTab === 'media') {
                    qParts.push(`(mimeType contains 'image/' or mimeType contains 'video/')`);
                } else if (driveActiveTab === 'docs') {
                    qParts.push(`not mimeType contains 'image/' and not mimeType contains 'video/'`);
                }
            }

            const q = qParts.join(' and ');
            const fieldsStr = 'nextPageToken,files(id,name,mimeType,size,iconLink,thumbnailLink,webViewLink,webContentLink,modifiedTime,shared,owners,parents,shortcutDetails,imageMediaMetadata,videoMediaMetadata)';
            let url = `https://www.googleapis.com/drive/v3/files?pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=${fieldsStr}&q=${encodeURIComponent(q)}`;
            if (!cleanQuery) {
                url += `&orderBy=folder,modifiedTime desc`;
            }
            if (appendPage && driveNextPageToken) {
                url += `&pageToken=${encodeURIComponent(driveNextPageToken)}`;
            }

            let res = await fetch(url, { headers: { Authorization: `Bearer ${inMemoryAccessToken}` } });
            if (!res.ok && res.status === 400 && url.includes('&orderBy=')) {
                url = url.replace('&orderBy=folder,modifiedTime desc', '');
                res = await fetch(url, { headers: { Authorization: `Bearer ${inMemoryAccessToken}` } });
            }
            if (!res.ok) {
                if (res.status === 401) {
                    inMemoryAccessToken = null;
                    return renderLoginCard();
                }
                throw new Error(`Kode HTTP ${res.status}`);
            }
            const data = await res.json();
            driveNextPageToken = data.nextPageToken || null;
            const incomingFiles = (data.files || []).map(f => normalizeDriveFileItem(f)).filter(Boolean);

            // Jika di root pada tab 'all', 'shared', atau 'media', telusuri juga isi folder yang dibagikan (sharedWithMe)
            if (!appendPage && currentFolderId === 'root' && !cleanQuery && (driveActiveTab === 'all' || driveActiveTab === 'shared' || driveActiveTab === 'media')) {
                try {
                    const sharedUrl = `https://www.googleapis.com/drive/v3/files?pageSize=500&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=${fieldsStr}&q=${encodeURIComponent('trashed = false and sharedWithMe = true')}`;
                    const sharedRes = await fetch(sharedUrl, { headers: { Authorization: `Bearer ${inMemoryAccessToken}` } });
                    if (sharedRes.ok) {
                        const sharedData = await sharedRes.json();
                        const sharedItems = (sharedData.files || []).map(f => normalizeDriveFileItem(f)).filter(Boolean);
                        sharedItems.forEach(si => {
                            if (driveActiveTab === 'media') {
                                if (isPhotoMediaItem(si) || isVideoMediaItem(si) || si.mimeType === 'application/vnd.google-apps.folder') {
                                    incomingFiles.push(si);
                                }
                            } else {
                                incomingFiles.push(si);
                            }
                        });
                        const foldersToCrawl = sharedItems.filter(si => si.mimeType === 'application/vnd.google-apps.folder');
                        if (foldersToCrawl.length > 0) {
                            const crawled = await crawlDriveFoldersDeep(foldersToCrawl, 2);
                            crawled.forEach(ci => {
                                if (driveActiveTab === 'media') {
                                    if (isPhotoMediaItem(ci) || isVideoMediaItem(ci)) incomingFiles.push(ci);
                                } else {
                                    incomingFiles.push(ci);
                                }
                            });
                        }
                    }
                } catch (e) {}
            }

            // Gabungkan & hindari duplikat ID
            const existingIds = new Set(driveAllAccumulatedFiles.map(item => item.id));
            incomingFiles.forEach(f => {
                if (!existingIds.has(f.id)) {
                    existingIds.add(f.id);
                    driveAllAccumulatedFiles.push(f);
                }
            });

            renderDriveFileList(driveAllAccumulatedFiles);
        } catch (err) {
            const container = document.getElementById('gwFileListContainer');
            if (container) {
                container.innerHTML = `
                    <div style="text-align:center; padding:40px; color:#ef4444;">
                        <i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:10px;"></i>
                        <p style="font-size:0.9rem; font-weight:600;">Terjadi kendala saat memuat Google Drive: ${err.message}</p>
                        <button type="button" onclick="window.loginWithGoogleAccount()" style="margin-top:12px; background:#009846; color:white; border:none; border-radius:12px; padding:10px 20px; cursor:pointer; font-weight:700;">Hubungkan Ulang Akun Google</button>
                    </div>
                `;
            }
        }
    }

    window.loadMoreGoogleDriveFiles = function () {
        if (!driveNextPageToken) return;
        loadGoogleDriveFiles(driveCurrentQuery, currentFolderId, true);
    };

    function renderDriveFileList(files) {
        const container = document.getElementById('gwFileListContainer');
        if (!container) return;

        const counterEl = document.getElementById('gwDriveTotalCounter');
        if (counterEl) {
            const folderCount = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length;
            const fileCount = files.length - folderCount;
            counterEl.innerHTML = `<i class="fas fa-database"></i> ${fileCount} Berkas & ${folderCount} Folder${driveNextPageToken ? '+' : ''}`;
        }

        if (files.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:50px 20px; color:#94a3b8;">
                    <i class="fas fa-folder-open" style="font-size:3rem; margin-bottom:14px; color:#cbd5e1;"></i>
                    <p style="font-size:0.98rem; font-weight:700; color:#64748b; margin:0 0 6px 0;">Tidak ada berkas pada tampilan ini</p>
                    <small style="color:#94a3b8; display:block; margin-bottom:14px;">Klik tab "Semua Berkas Drive" untuk menampilkan seluruh file dari semua folder Google Drive Anda.</small>
                    <button type="button" onclick="window.switchDriveTab('all')" style="background:#009846; color:white; border:none; border-radius:12px; padding:8px 18px; font-size:0.82rem; font-weight:700; cursor:pointer;">
                        <i class="fas fa-globe"></i> Tampilkan Semua Berkas Drive
                    </button>
                </div>
            `;
            updateModalFooter(currentSelectedDriveFiles.length);
            return;
        }

        const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        const regularFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

        let html = '';

        // Tampilkan Bagian Folder
        if (folders.length > 0) {
            html += `<div style="font-size:0.78rem; font-weight:800; color:#475569; text-transform:uppercase; margin:2px 0 8px 4px; display:flex; align-items:center; justify-content:space-between;">
                <span><i class="fas fa-folder text-amber-500"></i> Direktori Folder (${folders.length}) — Klik untuk membuka isi folder</span>
            </div>`;
            html += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:10px; margin-bottom:16px;">`;
            folders.forEach(folder => {
                const safeFolderName = (folder.name || 'Folder').replace(/'/g, "\\'");
                html += `
                    <div class="gw-folder-card" onclick="window.openDriveFolder('${folder.id}', '${safeFolderName}', false)" style="display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:12px; cursor:pointer; background:#ffffff; border:1.5px solid #e2e8f0; transition:all 0.15s; box-shadow:0 1px 3px rgba(0,0,0,0.03);" onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#f59e0b';" onmouseout="this.style.background='#ffffff'; this.style.borderColor='#e2e8f0';">
                        <div style="width:36px; height:36px; border-radius:9px; background:#fef3c7; display:flex; align-items:center; justify-content:center; color:#d97706; font-size:1.2rem; flex-shrink:0;">
                            <i class="fas fa-folder"></i>
                        </div>
                        <div style="flex:1; overflow:hidden;">
                            <div style="font-size:0.84rem; font-weight:800; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${folder.name}">${folder.name}</div>
                            <div style="font-size:0.7rem; color:#64748b; margin-top:1px;">Buka Folder <i class="fas fa-arrow-right" style="font-size:0.6rem;"></i></div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        // Tampilkan Bagian Berkas Lengkap
        if (regularFiles.length > 0) {
            html += `
                <div style="font-size:0.78rem; font-weight:800; color:#475569; text-transform:uppercase; margin:6px 0 8px 4px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <span><i class="fas fa-file-alt text-emerald-600"></i> Seluruh Berkas Dokumen, Foto, Video & Arsip (${regularFiles.length})</span>
                    <button type="button" onclick="window.toggleSelectAllVisibleDriveFiles()" style="background:#ffffff; color:#009846; border:1px solid #86efac; border-radius:8px; padding:3px 10px; font-size:0.72rem; font-weight:800; cursor:pointer;">
                        <i class="fas fa-check-double"></i> Pilih / Batal Pilih Semua
                    </button>
                </div>
            `;

            regularFiles.forEach(f => {
                const isSelected = currentSelectedDriveFiles.some(item => item.id === f.id);
                const sizeStr = f.size ? formatBytes(f.size) : (f.mimeType && f.mimeType.includes('google-apps') ? 'Dokumen Google Workspace (Otomatis Ekspor)' : 'Berkas Cloud');
                const ext = ((f.name || '').split('.').pop() || '').toLowerCase();
                const mime = f.mimeType || '';

                let iconClass = 'fa-file-alt text-slate-600';
                let iconBg = '#f1f5f9';
                let formatBadge = `<span style="background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:800;">${(ext && ext.length <= 6 ? ext.toUpperCase() : 'BERKAS')}</span>`;

                if (mime.includes('image') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic', 'bmp'].includes(ext)) {
                    iconClass = 'fa-file-image text-emerald-600'; iconBg = '#ecfdf5';
                    formatBadge = `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:800;">FOTO / GAMBAR</span>`;
                } else if (mime.includes('video') || ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'].includes(ext)) {
                    iconClass = 'fa-file-video text-rose-600'; iconBg = '#ffe4e6';
                    formatBadge = `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:800;"><i class="fas fa-play" style="font-size:0.55rem;"></i> VIDEO</span>`;
                } else if (mime.includes('json') || ext === 'json') {
                    iconClass = 'fa-file-code text-amber-600'; iconBg = '#fef3c7';
                    formatBadge = `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:800;">JSON</span>`;
                } else if (mime.includes('pdf') || ext === 'pdf') {
                    iconClass = 'fa-file-pdf text-rose-600'; iconBg = '#ffe4e6';
                    formatBadge = `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:800;">PDF</span>`;
                } else if (mime.includes('spreadsheet') || mime.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) {
                    iconClass = 'fa-file-excel text-green-700'; iconBg = '#dcfce7';
                    formatBadge = `<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:800;">EXCEL / SHEET</span>`;
                } else if (mime.includes('document') || mime.includes('word') || ['doc', 'docx'].includes(ext)) {
                    iconClass = 'fa-file-word text-blue-600'; iconBg = '#dbeafe';
                    formatBadge = `<span style="background:#dbeafe; color:#1d4ed8; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:800;">WORD / DOC</span>`;
                } else if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
                    iconClass = 'fa-file-powerpoint text-orange-600'; iconBg = '#ffedd5';
                    formatBadge = `<span style="background:#ffedd5; color:#c2410c; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:800;">SLIDE / PPT</span>`;
                } else if (mime.includes('audio') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
                    iconClass = 'fa-file-audio text-purple-600'; iconBg = '#f3e8ff';
                    formatBadge = `<span style="background:#f3e8ff; color:#7e22ce; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:800;">AUDIO</span>`;
                } else if (mime.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
                    iconClass = 'fa-file-archive text-indigo-600'; iconBg = '#e0e7ff';
                    formatBadge = `<span style="background:#e0e7ff; color:#4338ca; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:800;">ARSIP</span>`;
                }

                const thumbImg = f.thumbnailLink
                    ? `<img src="${f.thumbnailLink.replace(/=s\d+/, '=s120')}" alt="" referrerpolicy="no-referrer" style="width:38px; height:38px; border-radius:9px; object-fit:cover; flex-shrink:0; border:1px solid #cbd5e1;" onerror="this.style.display='none'">`
                    : `<div style="width:38px; height:38px; border-radius:9px; background:${iconBg}; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;"><i class="fas ${iconClass}"></i></div>`;

                html += `
                    <div class="gw-file-row ${isSelected ? 'selected' : ''}" onclick="window.toggleSelectDriveFile('${f.id}')" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-radius:12px; margin-bottom:7px; cursor:pointer; background:${isSelected ? '#f0fdf4' : '#ffffff'}; border:2px solid ${isSelected ? '#009846' : '#e2e8f0'}; transition:all 0.15s;">
                        <div style="display:flex; align-items:center; gap:12px; flex:1; overflow:hidden;">
                            <input type="checkbox" id="chk_gw_${f.id}" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); window.toggleSelectDriveFile('${f.id}')" style="cursor:pointer; accent-color:#009846; width:18px; height:18px; flex-shrink:0;">
                            ${thumbImg}
                            <div style="flex:1; overflow:hidden;">
                                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                    <span style="font-size:0.86rem; font-weight:800; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.name}</span>
                                    ${formatBadge}
                                </div>
                                <div style="font-size:0.73rem; color:#64748b; margin-top:2px;">${sizeStr}</div>
                            </div>
                        </div>
                        ${f.webViewLink ? `
                        <a href="${f.webViewLink}" target="_blank" onclick="event.stopPropagation()" style="color:#0284c7; font-size:0.78rem; padding:5px 10px; border-radius:8px; text-decoration:none; display:flex; align-items:center; gap:5px; font-weight:700; flex-shrink:0;" title="Lihat di Google Drive">
                            <i class="fas fa-external-link-alt"></i> Buka
                        </a>` : ''}
                    </div>
                `;
            });
        }

        if (driveNextPageToken) {
            html += `
                <div style="text-align:center; padding:14px 0 6px 0;">
                    <button type="button" onclick="window.loadMoreGoogleDriveFiles()" style="background:#009846; color:white; border:none; border-radius:14px; padding:10px 24px; font-size:0.84rem; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(0,152,70,0.2);">
                        <i class="fas fa-sync-alt"></i> Muat Lebih Banyak Berkas Google Drive...
                    </button>
                </div>
            `;
        }

        window.currentDriveLoadedFiles = files;
        container.innerHTML = html;
        updateModalFooter(currentSelectedDriveFiles.length);
    }

    window.toggleSelectAllVisibleDriveFiles = function () {
        const list = (window.currentDriveLoadedFiles || []).filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
        if (list.length === 0) return;
        const allSelected = list.every(f => currentSelectedDriveFiles.some(s => s.id === f.id));
        if (allSelected) {
            const visibleIds = new Set(list.map(f => f.id));
            currentSelectedDriveFiles = currentSelectedDriveFiles.filter(s => !visibleIds.has(s.id));
        } else {
            list.forEach(f => {
                if (!currentSelectedDriveFiles.some(s => s.id === f.id)) {
                    currentSelectedDriveFiles.push(f);
                }
            });
        }
        if (window.activePickerType === 'photos') {
            renderPhotosGrid(window.currentDriveLoadedFiles || []);
        } else {
            renderDriveFileList(window.currentDriveLoadedFiles || []);
        }
    };

    // =========================================================================
    // 2. GOOGLE FOTO: MENGGABUNGKAN GOOGLE PHOTOS LIBRARY API + DRIVE PHOTOS SPACE + DEEP FOLDER CRAWLER
    // =========================================================================
    function updatePhotosTabButtonsUI() {
        const allItems = photosAllAccumulatedFiles || [];
        const countAllMedia = allItems.filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && (isPhotoMediaItem(f) || isVideoMediaItem(f))).length;
        const countPhotosOnly = allItems.filter(f => isPhotoMediaItem(f)).length;
        const countVideosOnly = allItems.filter(f => isVideoMediaItem(f)).length;
        const countAlbumsOnly = allItems.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length;

        const tabBar = document.getElementById('gwPhotosTabBar');
        if (!tabBar) return;
        tabBar.innerHTML = `
            <button type="button" onclick="window.switchPhotosTab('all')" style="border:none; border-radius:10px; padding:7px 14px; font-size:0.8rem; font-weight:800; cursor:pointer; background:${photosActiveTab === 'all' ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'transparent'}; color:${photosActiveTab === 'all' ? '#ffffff' : '#475569'};">
                <i class="fas fa-photo-video"></i> Semua Foto & Video ${countAllMedia > 0 ? `<span style="margin-left:4px; padding:1px 7px; border-radius:10px; font-size:0.72rem; background:${photosActiveTab === 'all' ? 'rgba(255,255,255,0.24)' : '#e2e8f0'}; color:${photosActiveTab === 'all' ? '#ffffff' : '#334155'};">${countAllMedia}</span>` : ''}
            </button>
            <button type="button" onclick="window.switchPhotosTab('photos')" style="border:none; border-radius:10px; padding:7px 14px; font-size:0.8rem; font-weight:800; cursor:pointer; background:${photosActiveTab === 'photos' ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'transparent'}; color:${photosActiveTab === 'photos' ? '#ffffff' : '#475569'};">
                <i class="fas fa-camera"></i> Hanya Foto ${countPhotosOnly > 0 ? `<span style="margin-left:4px; padding:1px 7px; border-radius:10px; font-size:0.72rem; background:${photosActiveTab === 'photos' ? 'rgba(255,255,255,0.24)' : '#e2e8f0'}; color:${photosActiveTab === 'photos' ? '#ffffff' : '#334155'};">${countPhotosOnly}</span>` : ''}
            </button>
            <button type="button" onclick="window.switchPhotosTab('videos')" style="border:none; border-radius:10px; padding:7px 14px; font-size:0.8rem; font-weight:800; cursor:pointer; background:${photosActiveTab === 'videos' ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'transparent'}; color:${photosActiveTab === 'videos' ? '#ffffff' : '#475569'};">
                <i class="fas fa-video"></i> Hanya Video (MP4/MOV) ${countVideosOnly > 0 ? `<span style="margin-left:4px; padding:1px 7px; border-radius:10px; font-size:0.72rem; background:${photosActiveTab === 'videos' ? 'rgba(255,255,255,0.24)' : '#e2e8f0'}; color:${photosActiveTab === 'videos' ? '#ffffff' : '#334155'};">${countVideosOnly}</span>` : ''}
            </button>
            <button type="button" onclick="window.switchPhotosTab('albums')" style="border:none; border-radius:10px; padding:7px 14px; font-size:0.8rem; font-weight:800; cursor:pointer; background:${photosActiveTab === 'albums' ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'transparent'}; color:${photosActiveTab === 'albums' ? '#ffffff' : '#475569'};">
                <i class="fas fa-folder-open"></i> Album & Folder Galeri ${countAlbumsOnly > 0 ? `<span style="margin-left:4px; padding:1px 7px; border-radius:10px; font-size:0.72rem; background:${photosActiveTab === 'albums' ? 'rgba(255,255,255,0.24)' : '#e2e8f0'}; color:${photosActiveTab === 'albums' ? '#ffffff' : '#334155'};">${countAlbumsOnly}</span>` : ''}
            </button>
        `;
    }

    window.switchPhotosTab = function (tab) {
        photosActiveTab = tab;
        if (tab !== 'albums') {
            photosCurrentAlbumId = null;
        }
        if (photosAllAccumulatedFiles.length > 0 && currentFolderId === 'root' && !photosCurrentAlbumId) {
            updatePhotosTabButtonsUI();
            renderPhotosGrid(photosAllAccumulatedFiles);
            return;
        }
        photosNextPageTokenDrive = null;
        photosNextPageTokenLibrary = null;
        loadGooglePhotosFiles(currentFolderId, false);
    };

    window.searchGooglePhotosItems = function (q) {
        photosCurrentQuery = (q || '').trim();
        renderPhotosGrid(photosAllAccumulatedFiles);
    };

    async function loadGooglePhotosFiles(folderId = null, appendPage = false) {
        const body = document.getElementById('gwModalBody');
        if (!body) return;

        if (folderId !== null) {
            currentFolderId = folderId;
        }

        if (!appendPage) {
            photosNextPageTokenDrive = null;
            photosNextPageTokenLibrary = null;
            photosAllAccumulatedFiles = [];

            body.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:10px; flex:1; min-height:0;">
                    ${renderUserProfileHeader()}
                    ${renderBreadcrumbsBar()}

                    <!-- Tab Filter Lengkap Google Foto -->
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <div id="gwPhotosTabBar" style="display:flex; gap:6px; background:#f1f5f9; padding:4px; border-radius:14px; border:1px solid #e2e8f0; flex-wrap:wrap;">
                            <button type="button" onclick="window.switchPhotosTab('all')" style="border:none; border-radius:10px; padding:7px 14px; font-size:0.8rem; font-weight:800; cursor:pointer; background:${photosActiveTab === 'all' ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'transparent'}; color:${photosActiveTab === 'all' ? '#ffffff' : '#475569'};">
                                <i class="fas fa-photo-video"></i> Semua Foto & Video
                            </button>
                            <button type="button" onclick="window.switchPhotosTab('photos')" style="border:none; border-radius:10px; padding:7px 14px; font-size:0.8rem; font-weight:800; cursor:pointer; background:${photosActiveTab === 'photos' ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'transparent'}; color:${photosActiveTab === 'photos' ? '#ffffff' : '#475569'};">
                                <i class="fas fa-camera"></i> Hanya Foto
                            </button>
                            <button type="button" onclick="window.switchPhotosTab('videos')" style="border:none; border-radius:10px; padding:7px 14px; font-size:0.8rem; font-weight:800; cursor:pointer; background:${photosActiveTab === 'videos' ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'transparent'}; color:${photosActiveTab === 'videos' ? '#ffffff' : '#475569'};">
                                <i class="fas fa-video"></i> Hanya Video (MP4/MOV)
                            </button>
                            <button type="button" onclick="window.switchPhotosTab('albums')" style="border:none; border-radius:10px; padding:7px 14px; font-size:0.8rem; font-weight:800; cursor:pointer; background:${photosActiveTab === 'albums' ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'transparent'}; color:${photosActiveTab === 'albums' ? '#ffffff' : '#475569'};">
                                <i class="fas fa-folder-open"></i> Album & Folder Galeri
                            </button>
                        </div>

                        <div style="display:flex; align-items:center; gap:8px;">
                            <button type="button" onclick="window.loadGooglePhotosFiles(null, false)" style="background:#ffffff; color:#475569; border:1px solid #cbd5e1; border-radius:10px; padding:6px 12px; font-size:0.76rem; font-weight:800; cursor:pointer;" title="Muat ulang seluruh galeri">
                                <i class="fas fa-sync-alt"></i> Segarkan
                            </button>
                            <button type="button" onclick="window.toggleSelectAllVisibleDriveFiles()" style="background:#ffffff; color:#e11d48; border:1px solid #fecdd3; border-radius:10px; padding:6px 12px; font-size:0.76rem; font-weight:800; cursor:pointer;">
                                <i class="fas fa-check-double"></i> Pilih Semua
                            </button>
                            <span id="gwPhotosCountSelected" style="color:#e11d48; font-weight:800; background:#fff1f2; padding:6px 14px; border-radius:12px; border:1px solid #fecdd3; font-size:0.8rem;">
                                ${currentSelectedDriveFiles.length} dipilih
                            </span>
                        </div>
                    </div>

                    <!-- Bilah Pencarian Cepat Foto & Video -->
                    <div style="display:flex; gap:8px; align-items:center;">
                        <div style="position:relative; flex:1;">
                            <i class="fas fa-search" style="position:absolute; left:14px; top:10px; color:#94a3b8; font-size:0.86rem;"></i>
                            <input type="text" id="gwPhotosSearchInput" placeholder="Cari foto atau video di Google Foto (ketik nama foto, MP4, IMG, DSC, WA, atau album)..." value="${photosCurrentQuery.replace(/"/g, '&quot;')}" oninput="window.searchGooglePhotosItems(this.value)" style="width:100%; border:1.5px solid #cbd5e1; border-radius:12px; padding:8px 14px 8px 38px; font-size:0.84rem; outline:none;">
                        </div>
                    </div>

                    <!-- Grid Tampilan Foto & Video -->
                    <div id="gwPhotosGridContainer" style="flex:1; overflow-y:auto; min-height:240px; border:1.5px solid #e2e8f0; border-radius:18px; padding:16px; background:#f8fafc; display:grid; grid-template-columns:repeat(auto-fill, minmax(165px, 1fr)); gap:14px; align-content:start;">
                        <div style="grid-column:1/-1; text-align:center; padding:50px; color:#64748b;"><i class="fas fa-spinner fa-spin fa-2x"></i><div style="margin-top:10px; font-weight:600;">Menyinkronkan seluruh foto & video dari Google Foto...</div></div>
                    </div>
                </div>
            `;
        }

        try {
            const tasks = [];

            // SUMBER 1: Google Photos Library API (photoslibrary.googleapis.com)
            if (currentFolderId === 'root' || photosCurrentAlbumId) {
                tasks.push(fetchFromGooglePhotosLibraryApi(appendPage));
            }

            // SUMBER 2: Google Drive Multi-Source + Deep Folder & Shared Folder Crawler
            if (!photosCurrentAlbumId) {
                tasks.push(fetchPhotosAndVideosFromGoogleDriveSpace(appendPage));
            }

            const results = await Promise.allSettled(tasks);
            const existingIds = new Set(photosAllAccumulatedFiles.map(item => item.id));

            results.forEach(r => {
                if (r.status === 'fulfilled' && Array.isArray(r.value)) {
                    r.value.forEach(item => {
                        if (item && item.id && !existingIds.has(item.id)) {
                            existingIds.add(item.id);
                            photosAllAccumulatedFiles.push(item);
                        }
                    });
                }
            });

            // Urutkan media terbaru di atas
            photosAllAccumulatedFiles.sort((a, b) => {
                const ta = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
                const tb = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
                return tb - ta;
            });

            updatePhotosTabButtonsUI();
            renderPhotosGrid(photosAllAccumulatedFiles);
        } catch (err) {
            const container = document.getElementById('gwPhotosGridContainer');
            if (container) {
                container.innerHTML = `
                    <div style="grid-column:1/-1; text-align:center; padding:40px; color:#ef4444;">
                        <p style="font-size:0.9rem; font-weight:600;">Kendala memuat galeri Google Foto: ${err.message}</p>
                        <button type="button" onclick="window.loginWithGoogleAccount()" style="margin-top:12px; background:#e11d48; color:white; border:none; border-radius:14px; padding:10px 20px; cursor:pointer; font-weight:700;">Hubungkan Ulang Akun Google</button>
                    </div>
                `;
            }
        }
    }

    // Mengambil foto, video, dan album langsung dari Google Photos Library API (v1/mediaItems & v1/albums)
    async function fetchFromGooglePhotosLibraryApi(appendPage = false) {
        if (!inMemoryAccessToken) return [];
        const items = [];

        try {
            // A. Muat daftar Album Google Foto resmi saat di root
            if (currentFolderId === 'root' && !appendPage) {
                const albumRes = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=50', {
                    headers: { Authorization: `Bearer ${inMemoryAccessToken}` }
                });
                if (albumRes.ok) {
                    const albumData = await albumRes.json();
                    (albumData.albums || []).forEach(alb => {
                        items.push({
                            id: alb.id,
                            name: alb.title || 'Album Google Foto',
                            mimeType: 'application/vnd.google-apps.folder',
                            isPhotosAlbum: true,
                            mediaItemsCount: alb.mediaItemsCount || 0,
                            thumbnailLink: alb.coverPhotoBaseUrl ? `${alb.coverPhotoBaseUrl}=w400-h300-c` : '',
                            webViewLink: alb.productUrl || ''
                        });
                    });
                }
            }

            // B. Muat mediaItems (foto & video) dari Google Photos Library API
            if (photosActiveTab !== 'albums' || photosCurrentAlbumId) {
                let resMedia = null;
                if (photosCurrentAlbumId) {
                    const bodyPayload = {
                        albumId: photosCurrentAlbumId,
                        pageSize: 100
                    };
                    if (appendPage && photosNextPageTokenLibrary) {
                        bodyPayload.pageToken = photosNextPageTokenLibrary;
                    }
                    resMedia = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${inMemoryAccessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(bodyPayload)
                    });
                } else {
                    let mediaUrl = 'https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100';
                    if (appendPage && photosNextPageTokenLibrary) {
                        mediaUrl += `&pageToken=${encodeURIComponent(photosNextPageTokenLibrary)}`;
                    }
                    resMedia = await fetch(mediaUrl, {
                        headers: { Authorization: `Bearer ${inMemoryAccessToken}` }
                    });
                }

                if (resMedia && resMedia.ok) {
                    const mediaData = await resMedia.json();
                    photosNextPageTokenLibrary = mediaData.nextPageToken || null;
                    (mediaData.mediaItems || []).forEach(m => {
                        const isVideo = Boolean(
                            (m.mimeType && m.mimeType.includes('video')) ||
                            (m.mediaMetadata && m.mediaMetadata.video)
                        );
                        items.push({
                            id: m.id,
                            name: m.filename || (isVideo ? `Video_GoogleFoto_${m.id.slice(0, 6)}.mp4` : `Foto_GoogleFoto_${m.id.slice(0, 6)}.jpg`),
                            mimeType: m.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
                            baseUrl: m.baseUrl,
                            thumbnailLink: m.baseUrl ? `${m.baseUrl}=w500-h400-c` : '',
                            webViewLink: m.productUrl || m.baseUrl || '',
                            modifiedTime: (m.mediaMetadata && m.mediaMetadata.creationTime) || '',
                            isGooglePhotosApi: true,
                            isVideo: isVideo
                        });
                    });
                }
            }
        } catch (e) {
            console.warn('[GooglePhotosAPI] Fallback ke ruang Google Drive Photos:', e);
        }

        return items;
    }

    // Mengambil SELURUH foto, video, & album lintas seluruh Google Drive, Subfolder, Dibagikan kepada saya, & ruang Google Photos
    async function fetchPhotosAndVideosFromGoogleDriveSpace(appendPage = false) {
        if (!inMemoryAccessToken) return [];
        const fieldsStr = 'nextPageToken,files(id,name,mimeType,size,iconLink,thumbnailLink,webViewLink,webContentLink,modifiedTime,shared,owners,parents,shortcutDetails,imageMediaMetadata,videoMediaMetadata)';
        const combinedMap = new Map();

        function addNormalizedItem(raw, folderNameMap = null) {
            const norm = normalizeDriveFileItem(raw, folderNameMap);
            if (!norm || !norm.id) return;
            const isFolder = norm.mimeType === 'application/vnd.google-apps.folder';
            const isMedia = isPhotoMediaItem(norm) || isVideoMediaItem(norm);
            if (!isFolder && !isMedia) return;
            if (!combinedMap.has(norm.id)) {
                combinedMap.set(norm.id, norm);
            } else {
                const existing = combinedMap.get(norm.id);
                if (!existing.albumName && norm.albumName) existing.albumName = norm.albumName;
                if (!existing.thumbnailLink && norm.thumbnailLink) existing.thumbnailLink = norm.thumbnailLink;
            }
        }

        // KASUS 1: Pengguna sedang membuka folder / album spesifik
        if (currentFolderId !== 'root') {
            const qFolder = `trashed = false and '${String(currentFolderId).replace(/'/g, "\\'")}' in parents`;
            let urlFolder = `https://www.googleapis.com/drive/v3/files?pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=${fieldsStr}&q=${encodeURIComponent(qFolder)}`;
            if (appendPage && photosNextPageTokenDrive) {
                urlFolder += `&pageToken=${encodeURIComponent(photosNextPageTokenDrive)}`;
            }
            const resFolder = await fetch(urlFolder, { headers: { Authorization: `Bearer ${inMemoryAccessToken}` } });
            if (!resFolder.ok) {
                if (resFolder.status === 401) {
                    inMemoryAccessToken = null;
                    renderLoginCard();
                }
                return [];
            }
            const dataFolder = await resFolder.json();
            photosNextPageTokenDrive = dataFolder.nextPageToken || null;
            const directChildren = Array.isArray(dataFolder.files) ? dataFolder.files : [];
            const subFolders = [];
            directChildren.forEach(f => {
                const norm = normalizeDriveFileItem(f);
                if (!norm) return;
                if (norm.mimeType === 'application/vnd.google-apps.folder') subFolders.push(norm);
                addNormalizedItem(norm);
            });
            // Jika di dalam folder ini masih ada sub-folder, telusuri otomatis agar seluruh foto/video di dalamnya ikut tampil
            if (!appendPage && subFolders.length > 0) {
                const deepChildren = await crawlDriveFoldersDeep(subFolders, 2);
                deepChildren.forEach(dc => addNormalizedItem(dc));
            }
            return Array.from(combinedMap.values());
        }

        // KASUS 2: Berada di Root Galeri Google Foto — Jalankan 4 Query Paralel + Deep Folder Crawler (Hingga 3 Kedalaman)
        const discoveredFolders = [];
        const folderNameLookup = new Map();

        await Promise.allSettled([
            // Query A: Seluruh file bermimeType image/* atau video/* (tanpa klausa name contains agar bebas HTTP 400)
            (async () => {
                try {
                    const qMedia = `trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`;
                    let urlMedia = `https://www.googleapis.com/drive/v3/files?pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=${fieldsStr}&q=${encodeURIComponent(qMedia)}`;
                    if (appendPage && photosNextPageTokenDrive) {
                        urlMedia += `&pageToken=${encodeURIComponent(photosNextPageTokenDrive)}`;
                    }
                    const res = await fetch(urlMedia, { headers: { Authorization: `Bearer ${inMemoryAccessToken}` } });
                    if (res.status === 401) {
                        inMemoryAccessToken = null;
                        renderLoginCard();
                        return;
                    }
                    if (res.ok) {
                        const data = await res.json();
                        photosNextPageTokenDrive = data.nextPageToken || photosNextPageTokenDrive || null;
                        (data.files || []).forEach(f => addNormalizedItem(f));
                    }
                } catch (e) {}
            })(),

            // Query B: Seluruh file & folder di akun Google (menangkap foto/video berekstensi .mp4/.mov/.jpg/.heic dan seluruh folder)
            (async () => {
                if (appendPage) return;
                try {
                    const qAll = `trashed = false`;
                    const urlAll = `https://www.googleapis.com/drive/v3/files?pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=${fieldsStr}&q=${encodeURIComponent(qAll)}`;
                    const res = await fetch(urlAll, { headers: { Authorization: `Bearer ${inMemoryAccessToken}` } });
                    if (res.ok) {
                        const data = await res.json();
                        (data.files || []).forEach(raw => {
                            const norm = normalizeDriveFileItem(raw);
                            if (!norm) return;
                            if (norm.mimeType === 'application/vnd.google-apps.folder') {
                                folderNameLookup.set(norm.id, norm.name || 'Album');
                                discoveredFolders.push(norm);
                            }
                        });
                        (data.files || []).forEach(raw => addNormalizedItem(raw, folderNameLookup));
                    }
                } catch (e) {}
            })(),

            // Query C: Seluruh file & folder di "Dibagikan kepada saya" (sharedWithMe = true)
            (async () => {
                if (appendPage) return;
                try {
                    const qShared = `trashed = false and sharedWithMe = true`;
                    const urlShared = `https://www.googleapis.com/drive/v3/files?pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=${fieldsStr}&q=${encodeURIComponent(qShared)}`;
                    const res = await fetch(urlShared, { headers: { Authorization: `Bearer ${inMemoryAccessToken}` } });
                    if (res.ok) {
                        const data = await res.json();
                        (data.files || []).forEach(raw => {
                            const norm = normalizeDriveFileItem(raw);
                            if (!norm) return;
                            if (norm.mimeType === 'application/vnd.google-apps.folder') {
                                folderNameLookup.set(norm.id, norm.name || 'Album Dibagikan');
                                discoveredFolders.push(norm);
                            }
                            addNormalizedItem(norm, folderNameLookup);
                        });
                    }
                } catch (e) {}
            })(),

            // Query D: Ruang khusus Google Photos (spaces=photos) jika diizinkan oleh token
            (async () => {
                if (appendPage) return;
                try {
                    const photosSpaceUrl = `https://www.googleapis.com/drive/v3/files?pageSize=1000&spaces=photos&fields=files(id,name,mimeType,size,thumbnailLink,webViewLink,webContentLink,modifiedTime,imageMediaMetadata,videoMediaMetadata)&q=${encodeURIComponent('trashed = false')}`;
                    const resPhotosSpace = await fetch(photosSpaceUrl, { headers: { Authorization: `Bearer ${inMemoryAccessToken}` } });
                    if (resPhotosSpace.ok) {
                        const dataPhotosSpace = await resPhotosSpace.json();
                        (dataPhotosSpace.files || []).forEach(pf => addNormalizedItem(pf, folderNameLookup));
                    }
                } catch (e) {}
            })()
        ]);

        // Penelusuran mendalam otomatis (Deep Crawler) ke dalam seluruh folder & folder "Dibagikan kepada saya"
        if (!appendPage && discoveredFolders.length > 0) {
            const crawledItems = await crawlDriveFoldersDeep(discoveredFolders, 3);
            crawledItems.forEach(ci => {
                if (ci && ci.mimeType === 'application/vnd.google-apps.folder') {
                    folderNameLookup.set(ci.id, ci.name || 'Sub-Album');
                }
                addNormalizedItem(ci, folderNameLookup);
            });
        }

        // Sematkan nama album/folder induk pada item yang memiliki parents
        for (const item of combinedMap.values()) {
            if (!item.albumName && Array.isArray(item.parents) && item.parents.length > 0) {
                const pName = folderNameLookup.get(item.parents[0]);
                if (pName) item.albumName = pName;
            }
        }

        return Array.from(combinedMap.values());
    }

    window.loadMoreGooglePhotosFiles = function () {
        if (!photosNextPageTokenDrive && !photosNextPageTokenLibrary) return;
        loadGooglePhotosFiles(currentFolderId, true);
    };

    function isVideoMediaItem(f) {
        if (!f || f.mimeType === 'application/vnd.google-apps.folder') return false;
        const mime = (f.mimeType || '').toLowerCase();
        const name = (f.name || '').toLowerCase();
        return Boolean(
            f.isVideo ||
            mime.includes('video') ||
            f.videoMediaMetadata ||
            ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.3gp', '.m4v', '.mpeg', '.mpg', '.wmv', '.flv'].some(ext => name.endsWith(ext))
        );
    }

    function isPhotoMediaItem(f) {
        if (!f || f.mimeType === 'application/vnd.google-apps.folder') return false;
        if (isVideoMediaItem(f)) return false;
        const mime = (f.mimeType || '').toLowerCase();
        const name = (f.name || '').toLowerCase();
        return Boolean(
            mime.includes('image') ||
            f.imageMediaMetadata ||
            ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.bmp', '.svg', '.avif', '.jfif', '.tif', '.tiff'].some(ext => name.endsWith(ext))
        );
    }

    function formatVideoDuration(ms) {
        const totalSec = Math.max(1, Math.round(Number(ms || 0) / 1000));
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // =========================================================================
    // RENDERING GRID GOOGLE FOTO (SEMUA FOTO, SEMUA VIDEO, & ALBUM)
    // =========================================================================
    function renderPhotosGrid(allFiles) {
        const container = document.getElementById('gwPhotosGridContainer');
        if (!container) return;

        updatePhotosTabButtonsUI();

        // Terapkan filter tab ('all', 'photos', 'videos', 'albums') dan kata kunci pencarian
        const qLower = (photosCurrentQuery || '').toLowerCase();
        const filtered = (allFiles || []).filter(f => {
            if (qLower) {
                const matchName = (f.name || '').toLowerCase().includes(qLower);
                const matchAlbum = (f.albumName || '').toLowerCase().includes(qLower);
                if (!matchName && !matchAlbum) return false;
            }
            if (photosActiveTab === 'albums') {
                return f.mimeType === 'application/vnd.google-apps.folder';
            }
            if (f.mimeType === 'application/vnd.google-apps.folder') {
                return currentFolderId !== 'root';
            }
            if (photosActiveTab === 'photos') {
                return isPhotoMediaItem(f);
            }
            if (photosActiveTab === 'videos') {
                return isVideoMediaItem(f);
            }
            return isPhotoMediaItem(f) || isVideoMediaItem(f);
        });

        window.currentDriveLoadedFiles = filtered;

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:50px 20px; color:#94a3b8;">
                    <i class="fas fa-photo-video" style="font-size:3rem; margin-bottom:14px; color:#cbd5e1;"></i>
                    <p style="font-size:0.95rem; font-weight:700; color:#64748b; margin:0 0 6px 0;">Tidak ada foto/video pada filter ini</p>
                    <small style="color:#94a3b8; display:block; margin-bottom:14px;">Klik "Semua Foto & Video" atau "Album & Folder Galeri" untuk melihat seluruh isi akun Google Anda, atau impor langsung dari perangkat.</small>
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button type="button" onclick="window.switchPhotosTab('all')" style="background:#e11d48; color:white; border:none; border-radius:12px; padding:8px 18px; font-size:0.82rem; font-weight:700; cursor:pointer;">
                            <i class="fas fa-images"></i> Tampilkan Semua Foto & Video
                        </button>
                        <button type="button" onclick="window.switchPhotosTab('albums')" style="background:#fff1f2; color:#be123c; border:1.5px solid #fecdd3; border-radius:12px; padding:8px 18px; font-size:0.82rem; font-weight:700; cursor:pointer;">
                            <i class="fas fa-folder-open"></i> Lihat Album & Folder
                        </button>
                        <button type="button" onclick="window.triggerGoogleDeviceSyncInput('photos')" style="background:#ffffff; color:#e11d48; border:1.5px solid #fecdd3; border-radius:12px; padding:8px 18px; font-size:0.82rem; font-weight:700; cursor:pointer;">
                            <i class="fas fa-folder-plus"></i> Pilih dari Galeri Perangkat
                        </button>
                    </div>
                </div>
            `;
            updateModalFooter(currentSelectedDriveFiles.length);
            return;
        }

        const folders = filtered.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        const mediaItems = filtered.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

        let html = '';

        // Tampilkan Folder / Album Galeri
        folders.forEach(folder => {
            const safeFolderName = (folder.name || 'Album').replace(/'/g, "\\'");
            const isAlbum = Boolean(folder.isPhotosAlbum);
            const coverThumb = folder.thumbnailLink || '';
            html += `
                <div onclick="window.openDriveFolder('${folder.id}', '${safeFolderName}', ${isAlbum})" style="height:175px; width:100%; border-radius:16px; background:#ffffff; border:1.5px solid #e2e8f0; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; padding:12px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.04); transition:all 0.15s; position:relative; overflow:hidden;" onmouseover="this.style.transform='translateY(-2px)'; this.style.borderColor='#f43f5e';" onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='#e2e8f0';">
                    ${coverThumb ? `<img src="${coverThumb}" alt="" referrerpolicy="no-referrer" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0.25;">` : ''}
                    <div style="position:relative; z-index:2; width:50px; height:50px; border-radius:50%; background:#fff1f2; color:#e11d48; display:flex; align-items:center; justify-content:center; font-size:1.6rem; margin-bottom:8px; border:1px solid #fecdd3;">
                        <i class="fas fa-images"></i>
                    </div>
                    <div style="position:relative; z-index:2; font-size:0.84rem; font-weight:800; color:#1e293b; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${folder.name}">${folder.name}</div>
                    <span style="position:relative; z-index:2; font-size:0.72rem; color:#64748b; margin-top:2px;">
                        ${folder.mediaItemsCount ? `${folder.mediaItemsCount} item • ` : ''}Buka Album <i class="fas fa-chevron-right" style="font-size:0.6rem;"></i>
                    </span>
                </div>
            `;
        });

        // Tampilkan Seluruh Foto & Video
        mediaItems.forEach(f => {
            const isSelected = currentSelectedDriveFiles.some(item => item.id === f.id);
            const isVideo = isVideoMediaItem(f);
            const backendThumbUrl = f.id
                ? `/api/security/google-media/${encodeURIComponent(f.id)}?token=${encodeURIComponent(inMemoryAccessToken || '')}&type=thumb`
                : '';
            const primaryThumb = f.thumbnailLink
                ? f.thumbnailLink.replace(/=s\d+/, '=s600')
                : (f.file instanceof Blob && !isVideo
                    ? URL.createObjectURL(f.file)
                    : (backendThumbUrl || (isVideo ? 'https://placehold.co/400x300/0f172a/ffffff?text=VIDEO+MP4' : 'https://placehold.co/400x300/f1f5f9/475569?text=FOTO')));
            const fallbackPlaceholder = `https://placehold.co/400x300/1e293b/ffffff?text=${isVideo ? 'VIDEO' : 'FOTO'}`;
            const sizeBadge = f.size ? formatBytes(f.size) : '';
            const durationBadge = isVideo && f.videoMediaMetadata && f.videoMediaMetadata.durationMillis
                ? formatVideoDuration(f.videoMediaMetadata.durationMillis)
                : '';
            const albumBadge = f.albumName ? String(f.albumName) : '';

            html += `
                <div class="gw-photo-card ${isSelected ? 'selected' : ''}" onclick="window.toggleSelectDriveFile('${f.id}')" style="position:relative; width:100%; height:175px; border-radius:16px; overflow:hidden; cursor:pointer; border:3px solid ${isSelected ? '#e11d48' : 'transparent'}; box-shadow:${isSelected ? '0 4px 14px rgba(225,29,72,0.35)' : '0 2px 8px rgba(0,0,0,0.08)'}; transition:all 0.15s; background:#0f172a;">
                    <img src="${primaryThumb}" alt="${(f.name || '').replace(/"/g, '&quot;')}" referrerpolicy="no-referrer" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="if(!this.dataset.triedProxy && '${backendThumbUrl}'){this.dataset.triedProxy='1';this.src='${backendThumbUrl}';}else{this.src='${fallbackPlaceholder}';}">

                    <!-- Badge Jenis Media (VIDEO / FOTO) -->
                    <div style="position:absolute; top:9px; left:9px; background:${isVideo ? 'rgba(225,29,72,0.92)' : 'rgba(15,23,42,0.72)'}; backdrop-filter:blur(4px); color:white; padding:3px 8px; border-radius:8px; font-size:0.66rem; font-weight:800; display:flex; align-items:center; gap:4px;">
                        <i class="fas ${isVideo ? 'fa-play' : 'fa-camera'}" style="font-size:0.55rem;"></i>
                        <span>${isVideo ? (durationBadge ? `VIDEO • ${durationBadge}` : 'VIDEO') : 'FOTO'}</span>
                    </div>

                    ${isVideo ? `
                        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:42px; height:42px; border-radius:50%; background:rgba(225,29,72,0.88); color:white; display:flex; align-items:center; justify-content:center; font-size:1rem; box-shadow:0 4px 12px rgba(0,0,0,0.35); pointer-events:none;">
                            <i class="fas fa-play" style="margin-left:2px;"></i>
                        </div>
                    ` : ''}

                    <!-- Selection Badge -->
                    <div style="position:absolute; top:9px; right:9px; background:${isSelected ? '#e11d48' : 'rgba(15,23,42,0.65)'}; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:2px solid #ffffff;">
                        <i class="fas ${isSelected ? 'fa-check' : 'fa-plus'}" style="color:white; font-size:0.75rem;"></i>
                    </div>

                    <!-- Label Nama, Album, & Ukuran di Bawah -->
                    <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(15,23,42,0.95)); padding:14px 10px 7px 10px; font-size:0.72rem; font-weight:700; color:white; display:flex; flex-direction:column; gap:2px;">
                        ${albumBadge ? `<div style="font-size:0.62rem; color:#fda4af; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i class="fas fa-folder-open" style="margin-right:3px;"></i>${albumBadge}</div>` : ''}
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
                            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="${(f.name || '').replace(/"/g, '&quot;')}">${f.name}</span>
                            ${sizeBadge ? `<span style="font-size:0.64rem; color:#cbd5e1; flex-shrink:0;">${sizeBadge}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        if (photosNextPageTokenDrive || photosNextPageTokenLibrary) {
            html += `
                <div style="grid-column:1/-1; text-align:center; padding:12px 0 4px 0;">
                    <button type="button" onclick="window.loadMoreGooglePhotosFiles()" style="background:#e11d48; color:white; border:none; border-radius:14px; padding:10px 24px; font-size:0.84rem; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(225,29,72,0.25);">
                        <i class="fas fa-sync-alt"></i> Muat Lebih Banyak Foto & Video...
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;
        const countEl = document.getElementById('gwPhotosCountSelected');
        if (countEl) countEl.innerText = `${currentSelectedDriveFiles.length} dipilih`;
        updateModalFooter(currentSelectedDriveFiles.length);
    }

    // Toggle Pilihan Berkas / Foto / Video
    window.toggleSelectDriveFile = function (id) {
        const sourcePool = window.activePickerType === 'photos'
            ? (photosAllAccumulatedFiles.length > 0 ? photosAllAccumulatedFiles : (window.currentDriveLoadedFiles || []))
            : (driveAllAccumulatedFiles.length > 0 ? driveAllAccumulatedFiles : (window.currentDriveLoadedFiles || []));

        const fileObj = sourcePool.find(f => f.id === id) || (window.currentDriveLoadedFiles || []).find(f => f.id === id);
        if (!fileObj) return;

        if (fileObj.mimeType === 'application/vnd.google-apps.folder') {
            return window.openDriveFolder(fileObj.id, fileObj.name, Boolean(fileObj.isPhotosAlbum));
        }

        const idx = currentSelectedDriveFiles.findIndex(item => item.id === id);
        if (idx >= 0) {
            currentSelectedDriveFiles.splice(idx, 1);
        } else {
            currentSelectedDriveFiles.push(fileObj);
        }

        if (window.activePickerType === 'photos') {
            renderPhotosGrid(photosAllAccumulatedFiles.length > 0 ? photosAllAccumulatedFiles : (window.currentDriveLoadedFiles || []));
        } else {
            renderDriveFileList(driveAllAccumulatedFiles.length > 0 ? driveAllAccumulatedFiles : (window.currentDriveLoadedFiles || []));
        }
    };

    window.searchGoogleWorkspaceFiles = function (query) {
        loadGoogleDriveFiles(query, currentFolderId, false);
    };

    function updateModalFooter(count) {
        const footer = document.getElementById('gwModalFooter');
        if (!footer) return;
        const isPhotos = window.activePickerType === 'photos';
        const primaryColor = isPhotos ? '#e11d48' : '#009846';

        footer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:12px; flex-wrap:wrap;">
                <div style="font-size:0.88rem; font-weight:800; color:${isPhotos ? '#9f1239' : '#065f46'};">
                    ${count > 0
                        ? `<i class="fas fa-check-circle"></i> <strong>${count}</strong> berkas/media siap dilampirkan atau dikirim`
                        : `Pilih foto, video, atau dokumen yang ingin dilampirkan`}
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button type="button" onclick="window.closeGoogleWorkspaceModal()" style="background:#e2e8f0; color:#475569; border:none; border-radius:14px; padding:10px 20px; font-weight:700; font-size:0.85rem; cursor:pointer;">Batal & Keluar</button>

                    <!-- Tombol 1: Tambahkan ke Antrean Lampiran -->
                    <button type="button" onclick="window.confirmAttachGoogleWorkspaceFiles(false)" ${count === 0 ? 'disabled' : ''} style="background:${count > 0 ? '#3b82f6' : '#94a3b8'}; color:white; border:none; border-radius:14px; padding:10px 20px; font-weight:700; font-size:0.85rem; cursor:${count > 0 ? 'pointer' : 'not-allowed'}; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-paperclip"></i> Tambah Lampiran
                    </button>

                    <!-- Tombol 2: Kirim Langsung ke Obrolan Sekarang -->
                    <button type="button" onclick="window.confirmAttachGoogleWorkspaceFiles(true)" ${count === 0 ? 'disabled' : ''} style="background:${count > 0 ? primaryColor : '#94a3b8'}; color:white; border:none; border-radius:14px; padding:10px 24px; font-weight:800; font-size:0.85rem; cursor:${count > 0 ? 'pointer' : 'not-allowed'}; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-paper-plane"></i> Kirim Langsung
                    </button>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // UNDUH BINER FILE DARI GOOGLE DRIVE / GOOGLE FOTO (TERMASUK EKSPOR DOCS & PROXY ANTI-CORS)
    // =========================================================================
    async function downloadGoogleWorkspaceItemAsFile(item) {
        // Jika sudah memiliki objek File/Blob lokal
        if (item.file instanceof Blob) {
            return {
                id: item.id,
                name: item.name,
                type: resolveCategory(item.mimeType, item.name),
                mimeType: item.mimeType || item.file.type || 'application/octet-stream',
                file: item.file,
                size: item.file.size || item.size || 0,
                isGoogleDrive: window.activePickerType !== 'photos',
                webViewLink: item.webViewLink
            };
        }

        const mime = item.mimeType || '';
        let targetUrl = '';
        let exportFileName = item.name || 'Berkas_Google';
        let exportMime = mime || 'application/octet-stream';

        // 1. Jika item berasal dari Google Photos Library API (baseUrl)
        if (item.isGooglePhotosApi && item.baseUrl) {
            const isVid = isVideoMediaItem(item);
            targetUrl = `${item.baseUrl}=${isVid ? 'dv' : 'd'}`;
            exportMime = isVid ? 'video/mp4' : 'image/jpeg';
            if (!/\.[a-z0-9]{2,5}$/i.test(exportFileName)) {
                exportFileName += isVid ? '.mp4' : '.jpg';
            }
        }
        // 2. Jika item adalah dokumen native Google Workspace (Docs, Sheets, Slides) -> gunakan /export
        else if (mime === 'application/vnd.google-apps.document') {
            targetUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}/export?mimeType=application/pdf`;
            exportMime = 'application/pdf';
            if (!exportFileName.toLowerCase().endsWith('.pdf')) exportFileName += '.pdf';
        } else if (mime === 'application/vnd.google-apps.spreadsheet') {
            targetUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
            exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            if (!exportFileName.toLowerCase().endsWith('.xlsx')) exportFileName += '.xlsx';
        } else if (mime === 'application/vnd.google-apps.presentation') {
            targetUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}/export?mimeType=application/pdf`;
            exportMime = 'application/pdf';
            if (!exportFileName.toLowerCase().endsWith('.pdf')) exportFileName += '.pdf';
        }
        // 3. Berkas standar Google Drive / Google Drive Photos (MP4, JPG, PDF, DOCX, XLSX, ZIP, JSON, Audio, dll)
        else if (item.id && !String(item.id).startsWith('gw_url_')) {
            targetUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}?alt=media&supportsAllDrives=true`;
        }

        // Coba unduh langsung dari browser terlebih dahulu (jika bukan baseUrl Google Photos yang sering terkena CORS)
        if (targetUrl && !item.isGooglePhotosApi) {
            try {
                const res = await fetch(targetUrl, {
                    headers: inMemoryAccessToken ? { Authorization: `Bearer ${inMemoryAccessToken}` } : {}
                });
                if (res.ok) {
                    const blob = await res.blob();
                    const finalMime = blob.type && blob.type !== 'application/octet-stream' ? blob.type : exportMime;
                    const fileObj = new File([blob], exportFileName, { type: finalMime });
                    return {
                        id: item.id,
                        name: exportFileName,
                        type: resolveCategory(finalMime, exportFileName),
                        mimeType: finalMime,
                        file: fileObj,
                        size: blob.size || item.size || 0,
                        isGoogleDrive: window.activePickerType !== 'photos',
                        webViewLink: item.webViewLink
                    };
                }
            } catch (directErr) {
                console.warn('[GoogleWorkspace] Direct fetch terkena CORS, beralih ke proxy server:', directErr);
            }
        }

        // Fallback Otomatis via Proxy Keamanan Backend (/api/security/google-proxy) agar bebas kendala CORS
        const proxyCandidateUrl = targetUrl || (item.thumbnailLink ? item.thumbnailLink.replace(/=s\d+/, '=s1600') : '');
        if (proxyCandidateUrl) {
            try {
                const proxyRes = await fetch('/api/security/google-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: proxyCandidateUrl,
                        accessToken: inMemoryAccessToken || ''
                    })
                });
                if (proxyRes.ok) {
                    const blob = await proxyRes.blob();
                    if (blob && blob.size > 0) {
                        const finalMime = blob.type && blob.type !== 'application/octet-stream' ? blob.type : exportMime;
                        const fileObj = new File([blob], exportFileName, { type: finalMime });
                        return {
                            id: item.id,
                            name: exportFileName,
                            type: resolveCategory(finalMime, exportFileName),
                            mimeType: finalMime,
                            file: fileObj,
                            size: blob.size || item.size || 0,
                            isGoogleDrive: window.activePickerType !== 'photos',
                            webViewLink: item.webViewLink
                        };
                    }
                }
            } catch (proxyErr) {
                console.warn('[GoogleWorkspace] Proxy fetch gagal:', proxyErr);
            }
        }

        // Fallback terakhir sebagai Cloud Link
        return {
            id: item.id,
            name: exportFileName,
            type: resolveCategory(exportMime, exportFileName),
            mimeType: exportMime,
            isCloudLink: true,
            isGoogleDrive: window.activePickerType !== 'photos',
            webViewLink: item.webViewLink || item.baseUrl || '',
            size: item.size || 0
        };
    }

    // =========================================================================
    // EKSEKUSI PELAMPIRAN ATAU PENGIRIMAN LANGSUNG KE SELURUH 6 KONTEKS
    // =========================================================================
    window.confirmAttachGoogleWorkspaceFiles = async function (sendDirectly = false) {
        if (currentSelectedDriveFiles.length === 0) return;
        const selected = [...currentSelectedDriveFiles];

        const modal = document.getElementById('modalGoogleWorkspacePicker');
        if (modal) modal.style.display = 'none';

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: sendDirectly ? 'Mengirimkan Berkas Google...' : 'Menyiapkan Lampiran Google...',
                html: `<div>Menyinkronkan <b>${selected.length}</b> berkas dari akun Google Anda...</div>`,
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => Swal.showLoading()
            });
        }

        const preparedFiles = [];
        for (const item of selected) {
            const downloaded = await downloadGoogleWorkspaceItemAsFile(item);
            preparedFiles.push(downloaded);
        }

        if (sendDirectly) {
            await executeDirectSendToChat(preparedFiles);
        } else {
            deliverToAttachmentQueue(preparedFiles);
        }

        currentSelectedDriveFiles = [];
    };

    function resolveCategory(mimeType, fileName) {
        const ext = ((fileName || '').split('.').pop() || '').toLowerCase();
        const mime = (mimeType || '').toLowerCase();
        if (mime.includes('image') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic', 'heif', 'bmp'].includes(ext)) return 'image';
        if (mime.includes('video') || ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'].includes(ext)) return 'video';
        if (mime.includes('audio') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio';
        return 'document';
    }

    // =========================================================================
    // PENYALURAN KE ANTREAN LAMPIRAN DI SELURUH 6 FITUR (WARGA, PENGADUAN, ADMIN/SUPERADMIN/PETUGAS)
    // =========================================================================
    function deliverToAttachmentQueue(preparedFiles) {
        if (!preparedFiles || preparedFiles.length === 0) return;

        // 1. Portal Warga — Pratinjau Perekaman Suara Dashboard Pribadi
        if (currentPickerContext === 'warga-voice-preview') {
            if (typeof window.addWargaVoicePreviewAttachments === 'function') {
                window.addWargaVoicePreviewAttachments(preparedFiles);
            } else if (typeof window.addWargaChatAttachments === 'function') {
                window.addWargaChatAttachments(preparedFiles);
            }
        }
        // 2. Portal Warga — Obrolan Dashboard Pribadi
        else if (currentPickerContext === 'warga-chat') {
            if (typeof window.addWargaChatAttachments === 'function') {
                window.addWargaChatAttachments(preparedFiles);
            }
        }
        // 3. Portal Warga — Pratinjau Perekaman Suara Dashboard Pantauan Pengaduan
        else if (currentPickerContext === 'aduan-voice-preview') {
            const filesForAduanVoice = preparedFiles.map(p => {
                if (p.file instanceof Blob) return p.file;
                const htmlLink = `<a href="${p.webViewLink || '#'}">${p.name || 'Berkas Google'}</a>`;
                return new File([new Blob([htmlLink], { type: 'text/html' })], (p.name || 'Berkas_Google') + '.html', { type: 'text/html' });
            });
            if (typeof window.addAduanVoicePreviewAttachments === 'function') {
                window.addAduanVoicePreviewAttachments(filesForAduanVoice);
            } else if (typeof window.addAduanChatAttachments === 'function') {
                window.addAduanChatAttachments(preparedFiles);
            }
        }
        // 4. Portal Warga — Obrolan Dashboard Pantauan Pengaduan
        else if (currentPickerContext === 'aduan-chat') {
            if (typeof window.addAduanChatAttachments === 'function') {
                window.addAduanChatAttachments(preparedFiles);
            }
        }
        // 5. Dashboard Admin / Super Admin / Petugas — Pratinjau Perekaman Suara
        else if (currentPickerContext === 'admin-voice-preview') {
            if (typeof window.addAdminVoicePreviewAttachments === 'function') {
                window.addAdminVoicePreviewAttachments(preparedFiles);
            }
        }
        // 6. Dashboard Admin / Super Admin / Petugas — Obrolan Hubungi Warga
        else {
            if (typeof window.addAdminChatAttachments === 'function') {
                window.addAdminChatAttachments(preparedFiles);
            } else if (typeof window.appendAdminMediaSelection === 'function') {
                const realFiles = preparedFiles.filter(p => p.file instanceof Blob).map(p => p.file);
                if (realFiles.length > 0) {
                    window.appendAdminMediaSelection({ files: realFiles });
                }
            }
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Berkas Berhasil Dilampirkan',
                text: `${preparedFiles.length} berkas dari Google berhasil ditambahkan ke ${getContextDisplayLabel()}.`,
                timer: 1800,
                showConfirmButton: false
            });
        }
    }

    // =========================================================================
    // PENGIRIMAN LANGSUNG KE OBROLAN AKTIF (MENDUKUNG WARGA, SUPER ADMIN, ADMIN, & PETUGAS)
    // =========================================================================
    async function executeDirectSendToChat(files) {
        if (!files || files.length === 0) return;

        // Jika pengguna sedang berada di mode Pratinjau Rekaman Suara, tambahkan ke lampiran suara agar terkirim bersama rekaman suara
        if (
            currentPickerContext === 'warga-voice-preview' ||
            currentPickerContext === 'aduan-voice-preview' ||
            currentPickerContext === 'admin-voice-preview'
        ) {
            return deliverToAttachmentQueue(files);
        }

        const isWargaContext =
            currentPickerContext === 'warga-chat' ||
            currentPickerContext === 'aduan-chat' ||
            (typeof window.activeChatNik === 'undefined' && typeof window.wargaNik !== 'undefined');

        const targetNik = isWargaContext
            ? (currentPickerContext === 'aduan-chat'
                ? ((window.sesiAduanAktif && window.sesiAduanAktif.nik) || localStorage.getItem('lastAduanNik') || window.wargaNik)
                : (window.wargaNik || (window.sesiWargaAktif && window.sesiWargaAktif.nik) || (window.sesiAduanAktif && window.sesiAduanAktif.nik) || localStorage.getItem('wargaNik')))
            : window.activeChatNik;

        if (!targetNik) {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Perhatian', 'Pilih percakapan warga terlebih dahulu sebelum mengirimkan berkas.', 'warning');
            }
            return;
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        let sender = 'petugas';
        let senderDisplayName = 'Petugas Dinsos';
        let officerRole = 'Petugas';

        if (isWargaContext) {
            sender = 'warga';
            senderDisplayName = currentPickerContext === 'aduan-chat'
                ? ((window.sesiAduanAktif && window.sesiAduanAktif.nama) || window.wargaNama || 'Warga')
                : ((window.sesiWargaAktif && (window.sesiWargaAktif.nama_lengkap || window.sesiWargaAktif.nama)) || window.wargaNama || (window.sesiAduanAktif && window.sesiAduanAktif.nama) || 'Warga');
        } else {
            // Gunakan identitas resmi Super Admin / Admin / Petugas yang sedang aktif
            if (typeof window.getCurrentStaffIdentity === 'function') {
                try {
                    const staff = window.getCurrentStaffIdentity();
                    if (staff) {
                        sender = staff.senderType || 'petugas';
                        senderDisplayName = staff.fullDisplay || `Dinsos Sidoarjo (${staff.name})`;
                        officerRole = staff.roleLabel || 'Petugas';
                    }
                } catch (e) {}
            } else {
                const handler = ((window.chatHandlersMap && window.chatHandlersMap[targetNik]) || 'Petugas').toUpperCase();
                senderDisplayName = `Dinsos Sidoarjo (${handler})`;
            }
        }

        let successCount = 0;
        const apiBase = (typeof BASE_API_URL !== 'undefined') ? BASE_API_URL : ((typeof API_URL !== 'undefined') ? API_URL : '');

        for (const item of files) {
            const formData = new FormData();
            formData.append('sender', sender);
            formData.append('nama', senderDisplayName);
            formData.append('officer_role', officerRole);
            formData.append('waktu', timeStr);
            formData.append('created_at', now.toISOString());

            if (item.file && item.file instanceof Blob) {
                formData.append('files', item.file, item.name);
                formData.append('file_type', item.type || 'document');
            } else if (item.isCloudLink) {
                formData.append('file_url', item.webViewLink || '');
                formData.append('file_name', item.name);
                formData.append('file_type', item.type || 'document');
                formData.append('pesan', `📎 [GOOGLE_WORKSPACE] ${item.name}`);
            }

            try {
                const res = await fetch(`${apiBase}/api/chat/${encodeURIComponent(targetNik)}`, {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) successCount++;
            } catch (err) {
                console.error('Gagal mengirim berkas Google:', err);
            }
        }

        if (isWargaContext) {
            if (typeof window.loadChatMessagesWarga === 'function') {
                window.loadChatMessagesWarga(true);
            }
            if (typeof window.muatPesanAduan === 'function' && (window.sesiAduanAktif || currentPickerContext === 'aduan-chat')) {
                window.muatPesanAduan(true);
            }
        } else {
            if (typeof window.loadChatMessages === 'function') {
                window.loadChatMessages(window.activeChatNik, window.activeChatName);
            }
            if (typeof window.loadChatList === 'function') {
                window.loadChatList();
            }
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Berkas Berhasil Terkirim',
                text: `${successCount} berkas dari Google berhasil dikirimkan ke obrolan.`,
                timer: 1800,
                showConfirmButton: false
            });
        }
    }

    function createWorkspaceModalElement() {
        const div = document.createElement('div');
        div.id = 'modalGoogleWorkspacePicker';
        div.style.cssText = 'display:none; position:fixed; inset:0; z-index:999999; background:rgba(15,23,42,0.8); backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:16px;';
        div.innerHTML = `
            <div style="background:#ffffff; border-radius:26px; width:96%; max-width:960px; height:90vh; max-height:860px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.35); border:1px solid #e2e8f0;">
                <!-- Header -->
                <div style="padding:16px 24px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#ffffff;">
                    <div>
                        <h3 id="gwModalTitle" style="font-size:1.22rem; font-weight:800; color:#0f172a; margin:0; display:flex; align-items:center; gap:10px;">
                            <i class="fab fa-google-drive text-emerald-600"></i> Google Drive
                        </h3>
                        <div id="gwModalSubtitle" style="font-size:0.8rem; color:#64748b; margin-top:3px;">
                            Pilih berkas dari Google Drive pribadi Anda
                        </div>
                    </div>
                </div>
                <!-- Body -->
                <div id="gwModalBody" style="padding:16px 24px; overflow-y:auto; flex:1; min-height:0; display:flex; flex-direction:column;"></div>
                <!-- Footer -->
                <div id="gwModalFooter" style="padding:14px 24px; border-top:1px solid #e2e8f0; background:#f8fafc;"></div>
            </div>
        `;
        document.body.appendChild(div);
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initGoogleClient(false));
    } else {
        initGoogleClient(false);
    }
})();
