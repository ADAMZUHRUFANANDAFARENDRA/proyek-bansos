/**
 * MODUL INTEGRASI RESMI GOOGLE WORKSPACE (GOOGLE DRIVE & GOOGLE FOTO)
 * Pemerintah Kabupaten Sidoarjo - Dinas Sosial
 * Fitur Utama:
 * 1. Logout otomatis saat keluar/tutup modal, sehingga saat masuk berikutnya wajib login ulang.
 * 2. Setelah login langsung memunculkan nama akun dari profil Google secara nyata (Bukan "Pengguna Google").
 * 3. Tombol "Naik ke Folder Sebelumnya" berukuran besar, tegas, dan tidak tertutup layout lain.
 * 4. Google Foto: Khusus dan terpisah total dari Drive biasa, memuat semua foto, video (MP4), dan album galeri.
 * 5. Google Drive: Mendukung format lengkap (MP4, JSON, PDF, DOCX, XLSX, PPTX, ZIP, RAR, TXT, CSV, AUDIO).
 * 6. Pengiriman berkas langsung ke obrolan atau penambahan ke antrean lampiran pesan.
 */

(function () {
    const GOOGLE_CLIENT_ID = '935928718907-esat4br1mvc30f9mogkc96pglbiom9u6.apps.googleusercontent.com';
    const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.photos.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid email profile';

    let inMemoryAccessToken = null;
    let googleUserAccount = null;
    let tokenClient = null;
    let currentPickerContext = 'admin-chat'; // 'admin-chat' | 'admin-voice-preview' | 'warga-chat' | 'warga-voice-preview'
    let currentSelectedDriveFiles = []; // Berkas yang sedang dicentang/dipilih

    // Navigasi Folder
    let currentFolderId = 'root';
    let currentFolderPath = [{ id: 'root', name: 'Drive Saya' }];
    let photosActiveTab = 'all'; // 'all' (Semua Foto & Video) | 'albums' (Album Galeri) | 'videos' (Video MP4)

    // Inisialisasi Google Identity Services Client
    function initGoogleClient() {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: GOOGLE_SCOPES,
                callback: async (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        inMemoryAccessToken = tokenResponse.access_token;
                        
                        // Tampilkan loading profil
                        const body = document.getElementById('gwModalBody');
                        if (body) {
                            body.innerHTML = `
                                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; text-align:center;">
                                    <i class="fas fa-circle-notch fa-spin" style="font-size:3rem; color:#009846; margin-bottom:16px;"></i>
                                    <h4 style="font-size:1.15rem; font-weight:800; color:#0f172a; margin:0 0 6px 0;">Menghubungkan Akun Google Anda...</h4>
                                    <p style="font-size:0.85rem; color:#64748b;">Memverifikasi identitas dan memuat profil resmi akun Anda...</p>
                                </div>
                            `;
                        }

                        await fetchGoogleUserProfile();

                        // Tampilkan toast penyambutan dengan nama akun nyata
                        const accName = getResolvedAccountName();
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                toast: true,
                                position: 'top',
                                icon: 'success',
                                title: `Berhasil Masuk: ${accName}`,
                                html: `<span style="font-size:0.82rem; color:#64748b;">Akun Google <b>${(googleUserAccount && googleUserAccount.email) || 'Terhubung'}</b> berhasil aktif.</span>`,
                                timer: 3000,
                                showConfirmButton: false
                            });
                        }
                        renderGooglePickerUI();
                    }
                }
            });
        }
    }

    // Mengambil profil akun secara komprehensif (Userinfo + Google Drive About API)
    async function fetchGoogleUserProfile() {
        if (!inMemoryAccessToken) return;
        
        let fetchedName = '';
        let fetchedEmail = '';
        let fetchedPhoto = '';

        // 1. Coba dari Google Drive About API (selalu terotorisasi dengan drive.readonly)
        try {
            const resAbout = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink)', {
                headers: { Authorization: `Bearer ${inMemoryAccessToken}` }
            });
            if (resAbout.ok) {
                const aboutData = await resAbout.json();
                if (aboutData && aboutData.user) {
                    if (aboutData.user.displayName) fetchedName = aboutData.user.displayName;
                    if (aboutData.user.emailAddress) fetchedEmail = aboutData.user.emailAddress;
                    if (aboutData.user.photoLink) fetchedPhoto = aboutData.user.photoLink;
                }
            }
        } catch (e) {
            console.warn('Gagal membaca profil dari Drive About API:', e);
        }

        // 2. Coba dari OAuth2 UserInfo API untuk melengkapi
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
        } catch (e) {
            console.warn('Gagal membaca profil dari UserInfo API:', e);
        }

        // 3. Jika nama belum ditemukan, olah dari email
        if (!fetchedName && fetchedEmail) {
            const prefix = fetchedEmail.split('@')[0];
            // Format budi.santoso -> Budi Santoso
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
            picture: fetchedPhoto || 'https://www.gravatar.com/avatar/?d=mp'
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

    // Logout Google Workspace (Sesi selesai, token dibersihkan total)
    window.logoutGoogleWorkspace = function (silent = false) {
        if (inMemoryAccessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            try {
                google.accounts.oauth2.revoke(inMemoryAccessToken, () => {});
            } catch (e) {}
        }
        inMemoryAccessToken = null;
        googleUserAccount = null;
        currentSelectedDriveFiles = [];
        currentFolderId = 'root';
        currentFolderPath = [{ id: 'root', name: window.activePickerType === 'photos' ? '📸 Google Foto' : 'Drive Saya' }];

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

    window.loginWithGoogleAccount = function () {
        if (!tokenClient) {
            initGoogleClient();
        }
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: 'select_account' });
        } else {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'info',
                    title: 'Menghubungkan ke Google',
                    text: 'Memuat pustaka Google Identity Services... Silakan coba beberapa detik lagi.'
                });
            }
            setTimeout(initGoogleClient, 1000);
        }
    };

    // Buka Modal Google Drive
    window.openGoogleDrivePicker = function (context) {
        currentPickerContext = context || 'admin-chat';
        currentSelectedDriveFiles = [];
        currentFolderId = 'root';
        currentFolderPath = [{ id: 'root', name: 'Drive Saya' }];
        window.activePickerType = 'drive';
        showWorkspaceModal('Google Drive', 'Jelajahi berkas lengkap (MP4, JSON, PDF, Dokumen, Spreadsheet, dll)');
        if (!inMemoryAccessToken) {
            renderLoginCard();
        } else {
            loadGoogleDriveFiles('', 'root');
        }
    };

    // Buka Modal Google Foto
    window.openGooglePhotosPicker = function (context) {
        currentPickerContext = context || 'admin-chat';
        currentSelectedDriveFiles = [];
        currentFolderId = 'root';
        currentFolderPath = [{ id: 'root', name: '📸 Google Foto (Koleksi Galeri)' }];
        window.activePickerType = 'photos';
        photosActiveTab = 'all';
        showWorkspaceModal('Google Foto', 'Galeri foto & video resmi dari akun Google Anda');
        if (!inMemoryAccessToken) {
            renderLoginCard();
        } else {
            loadGooglePhotosFiles('root');
        }
    };

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
                ? `<div style="display:flex; align-items:center; gap:10px;"><div style="width:36px; height:36px; border-radius:12px; background:linear-gradient(135deg, #f43f5e, #fb923c, #facc15, #3b82f6); display:flex; align-items:center; justify-content:center; color:white; font-size:1.15rem; box-shadow:0 3px 10px rgba(244,63,94,0.3);"><i class="fas fa-photo-video"></i></div> <span>Google Foto</span></div>`
                : `<div style="display:flex; align-items:center; gap:10px;"><div style="width:36px; height:36px; border-radius:12px; background:#ecfdf5; display:flex; align-items:center; justify-content:center; color:#009846; font-size:1.3rem; border:1px solid #bbf7d0;"><i class="fab fa-google-drive"></i></div> <span>Google Drive</span></div>`;
        }
        const subEl = document.getElementById('gwModalSubtitle');
        if (subEl) subEl.innerText = subtitle;
        modal.style.display = 'flex';
    }

    // KETIKA KELUAR / TUTUP: Otomatis LOGOUT agar kunjungan berikutnya wajib login ulang
    window.closeGoogleWorkspaceModal = function () {
        const modal = document.getElementById('modalGoogleWorkspacePicker');
        if (modal) modal.style.display = 'none';
        // Eksekusi logout langsung saat modal ditutup sehingga kunjungan berikutnya wajib login lagi
        window.logoutGoogleWorkspace(true);
    };

    function renderGooglePickerUI() {
        if (!inMemoryAccessToken) {
            renderLoginCard();
        } else {
            if (window.activePickerType === 'photos') {
                loadGooglePhotosFiles(currentFolderId);
            } else {
                loadGoogleDriveFiles('', currentFolderId);
            }
        }
    }

    function renderLoginCard() {
        const body = document.getElementById('gwModalBody');
        if (!body) return;
        const isPhotos = window.activePickerType === 'photos';
        body.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:50px 24px; text-align:center;">
                <div style="width:92px; height:92px; border-radius:50%; background:${isPhotos ? 'linear-gradient(135deg, #fff1f2, #fef2f2)' : '#f0fdf4'}; display:flex; align-items:center; justify-content:center; font-size:3rem; color:${isPhotos ? '#e11d48' : '#009846'}; margin-bottom:20px; border:2px solid ${isPhotos ? '#fecdd3' : '#86efac'}; box-shadow:0 10px 28px rgba(0,0,0,0.06);">
                    <i class="${isPhotos ? 'fas fa-images' : 'fab fa-google-drive'}"></i>
                </div>
                <h4 style="font-size:1.45rem; font-weight:800; color:#0f172a; margin-bottom:8px;">
                    Masuk ke Akun Google Anda
                </h4>
                <p style="font-size:0.92rem; color:#64748b; max-width:520px; margin-bottom:26px; line-height:1.6;">
                    ${isPhotos 
                        ? 'Masuk untuk membuka galeri foto, rekaman video (MP4), dan album Google Foto milik akun Anda, lalu kirimkan langsung ke obrolan.' 
                        : 'Masuk untuk mengakses Google Drive pribadi Anda: Dokumen, MP4, JSON Data, PDF, Spreadsheet Excel, dan folder bertingkat.'}
                </p>
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
                <div style="font-size:0.75rem; color:#94a3b8; margin-top:20px;">
                    <i class="fas fa-lock"></i> Otentikasi aman melalui Google Identity Services. Sesi akan keluar otomatis saat jendela ditutup.
                </div>
            </div>
        `;
        document.getElementById('gwModalFooter').innerHTML = `
            <div style="display:flex; justify-content:flex-end; width:100%;">
                <button type="button" onclick="window.closeGoogleWorkspaceModal()" style="background:#e2e8f0; color:#475569; border:none; border-radius:14px; padding:10px 24px; font-weight:700; cursor:pointer;">Tutup</button>
            </div>
        `;
    }

    // =========================================================================
    // PROFIL PENGGUNA TERHUBUNG (MEMUNCULKAN NAMA AKUN ASLI DENGAN JELAS & TEGAS)
    // =========================================================================
    function renderUserProfileHeader() {
        const resolvedName = getResolvedAccountName();
        const email = (googleUserAccount && googleUserAccount.email) || '';
        const picture = (googleUserAccount && googleUserAccount.picture) || 'https://www.gravatar.com/avatar/?d=mp';
        const isPhotos = window.activePickerType === 'photos';

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:${isPhotos ? 'linear-gradient(to right, #fff1f2, #ffffff)' : 'linear-gradient(to right, #f0fdf4, #ffffff)'}; border:1.5px solid ${isPhotos ? '#fecdd3' : '#bbf7d0'}; border-radius:20px; padding:14px 20px; box-shadow:0 3px 12px rgba(0,0,0,0.04); margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <div style="position:relative;">
                        <img src="${picture}" alt="${resolvedName}" referrerpolicy="no-referrer" style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:2.5px solid ${isPhotos ? '#e11d48' : '#009846'}; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                        <span style="position:absolute; bottom:-1px; right:-1px; background:${isPhotos ? '#e11d48' : '#009846'}; border:2px solid #ffffff; width:15px; height:15px; border-radius:50%; display:block;" title="Akun Aktif"></span>
                    </div>
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span style="font-size:1.02rem; font-weight:800; color:#0f172a; letter-spacing:0.2px;">${resolvedName}</span>
                            <span style="background:${isPhotos ? '#ffe4e6' : '#dcfce7'}; color:${isPhotos ? '#9f1239' : '#15803d'}; padding:2px 10px; border-radius:12px; font-size:0.72rem; font-weight:800; border:1px solid ${isPhotos ? '#fecdd3' : '#86efac'}; display:inline-flex; align-items:center; gap:4px;">
                                <i class="fas fa-check-circle"></i> Akun Terhubung
                            </span>
                        </div>
                        <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
                            ${email} • <span style="color:#0f172a; font-weight:700;">${isPhotos ? 'Koleksi Google Foto' : 'Google Drive'}</span>
                        </div>
                    </div>
                </div>
                <button type="button" onclick="window.logoutGoogleWorkspace()" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; border-radius:14px; padding:9px 18px; font-size:0.82rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.15s;" onmouseover="this.style.background='#fecdd3'" onmouseout="this.style.background='#fee2e2'" title="Keluar dan ganti akun Google">
                    <i class="fas fa-sign-out-alt"></i> Keluar Akun
                </button>
            </div>
        `;
    }

    // =========================================================================
    // BILAH NAVIGASI FOLDER DENGAN TOMBOL "NAIK KE FOLDER SEBELUMNYA" BESAR & JELAS
    // =========================================================================
    function renderBreadcrumbsBar() {
        const isPhotos = window.activePickerType === 'photos';
        const hasParent = currentFolderPath.length > 1;

        let html = `
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:12px;">
                <!-- Baris Navigasi Utama -->
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:18px; padding:12px 18px; box-shadow:0 2px 6px rgba(0,0,0,0.02); flex-wrap:wrap;">
                    <!-- Breadcrumbs Jalur Folder -->
                    <div style="display:flex; align-items:center; gap:8px; font-size:0.9rem; font-weight:700; color:#475569; overflow-x:auto; flex:1; min-width:240px; padding:4px 0;">
                        <span style="color:${isPhotos ? '#e11d48' : '#009846'}; cursor:pointer; display:flex; align-items:center; gap:6px; flex-shrink:0; background:${isPhotos ? '#fff1f2' : '#f0fdf4'}; padding:6px 14px; border-radius:12px; border:1px solid ${isPhotos ? '#fecdd3' : '#bbf7d0'};" onclick="window.navigateToFolderByIndex(0)">
                            <i class="${isPhotos ? 'fas fa-images text-rose-500' : 'fab fa-google-drive text-emerald-600'}"></i> ${currentFolderPath[0].name}
                        </span>
        `;

        for (let i = 1; i < currentFolderPath.length; i++) {
            const isLast = i === currentFolderPath.length - 1;
            html += `
                <span style="color:#94a3b8; flex-shrink:0;"><i class="fas fa-chevron-right" style="font-size:0.75rem;"></i></span>
                <span style="${isLast ? 'color:#0f172a; font-weight:800; background:#ffffff; border:1.5px solid #cbd5e1; box-shadow:0 1px 4px rgba(0,0,0,0.06);' : 'color:#0284c7; cursor:pointer; background:#e0f2fe;'} padding:6px 14px; border-radius:12px; flex-shrink:0; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" onclick="${isLast ? '' : `window.navigateToFolderByIndex(${i})`}">
                    <i class="fas fa-folder text-amber-500" style="margin-right:4px;"></i> ${currentFolderPath[i].name}
                </span>
            `;
        }

        html += `</div>`;

        // TOMBOL NAIK KE FOLDER ATAS / SEBELUMNYA BESAR & SANGAT TERLIHAT JIKA BERADA DI SUBFOLDER
        if (hasParent) {
            html += `
                <button type="button" onclick="window.navigateUpFolder()" style="background:#ffffff; border:2.5px solid ${isPhotos ? '#e11d48' : '#009846'}; color:${isPhotos ? '#e11d48' : '#009846'}; border-radius:16px; padding:11px 24px; font-size:0.94rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:10px; box-shadow:0 4px 14px ${isPhotos ? 'rgba(225,29,72,0.18)' : 'rgba(0,152,70,0.18)'}; transition:all 0.15s; flex-shrink:0;" onmouseover="this.style.background='${isPhotos ? '#fff1f2' : '#f0fdf4'}'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='#ffffff'; this.style.transform='translateY(0)';">
                    <i class="fas fa-arrow-left fa-lg"></i>
                    <span>Naik ke Folder Sebelumnya</span>
                </button>
            `;
        }

        html += `</div></div>`;
        return html;
    }

    window.navigateToFolderByIndex = function (idx) {
        if (idx < 0 || idx >= currentFolderPath.length) return;
        currentFolderPath = currentFolderPath.slice(0, idx + 1);
        currentFolderId = currentFolderPath[currentFolderPath.length - 1].id;
        if (window.activePickerType === 'photos') {
            loadGooglePhotosFiles(currentFolderId);
        } else {
            loadGoogleDriveFiles('', currentFolderId);
        }
    };

    window.navigateUpFolder = function () {
        if (currentFolderPath.length <= 1) return;
        currentFolderPath.pop();
        currentFolderId = currentFolderPath[currentFolderPath.length - 1].id;
        if (window.activePickerType === 'photos') {
            loadGooglePhotosFiles(currentFolderId);
        } else {
            loadGoogleDriveFiles('', currentFolderId);
        }
    };

    window.openDriveFolder = function (folderId, folderName) {
        currentFolderId = folderId;
        currentFolderPath.push({ id: folderId, name: folderName });
        if (window.activePickerType === 'photos') {
            loadGooglePhotosFiles(folderId);
        } else {
            loadGoogleDriveFiles('', folderId);
        }
    };

    // =========================================================================
    // MEMUAT BERKAS GOOGLE DRIVE LENGKAP (MP4, JSON, PDF, DOCX, XLSX, DLL)
    // =========================================================================
    async function loadGoogleDriveFiles(query = '', folderId = null) {
        const body = document.getElementById('gwModalBody');
        if (!body) return;

        if (folderId !== null) {
            currentFolderId = folderId;
        }

        body.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px; height:100%;">
                ${renderUserProfileHeader()}
                ${renderBreadcrumbsBar()}

                <!-- Bilah Pencarian Lengkap -->
                <div style="display:flex; gap:10px; align-items:center;">
                    <div style="position:relative; flex:1;">
                        <i class="fas fa-search" style="position:absolute; left:14px; top:12px; color:#94a3b8; font-size:0.9rem;"></i>
                        <input type="text" id="gwSearchInput" placeholder="Cari berkas (JSON, MP4, PDF, Word, Excel, ZIP, dll)..." value="${query}" style="width:100%; border:1.5px solid #cbd5e1; border-radius:14px; padding:10px 14px 10px 38px; font-size:0.88rem; outline:none; transition:border-color 0.2s;" onfocus="this.style.borderColor='#009846'" onblur="this.style.borderColor='#cbd5e1'" onkeypress="if(event.key==='Enter') window.searchGoogleWorkspaceFiles(this.value)">
                    </div>
                    <button type="button" onclick="window.searchGoogleWorkspaceFiles(document.getElementById('gwSearchInput').value)" style="background:#009846; color:white; border:none; border-radius:14px; padding:10px 22px; font-size:0.86rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-search"></i> Cari
                    </button>
                    ${query ? `<button type="button" onclick="loadGoogleDriveFiles('', currentFolderId)" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:14px; padding:10px 16px; font-size:0.86rem; font-weight:700; cursor:pointer;" title="Reset Pencarian">Reset</button>` : ''}
                </div>

                <!-- Kontainer Daftar Berkas & Folder -->
                <div id="gwFileListContainer" style="flex:1; overflow-y:auto; min-height:360px; max-height:490px; border:1.5px solid #e2e8f0; border-radius:18px; padding:16px; background:#f8fafc;">
                    <div style="text-align:center; padding:50px; color:#64748b;"><i class="fas fa-spinner fa-spin fa-2x"></i><div style="margin-top:10px; font-weight:600;">Memuat berkas dari Google Drive...</div></div>
                </div>
            </div>
        `;

        try {
            let q = "trashed = false";
            if (query && query.trim()) {
                q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
            } else {
                q += ` and '${currentFolderId}' in parents`;
            }

            const url = `https://www.googleapis.com/drive/v3/files?pageSize=100&fields=nextPageToken,files(id,name,mimeType,size,iconLink,thumbnailLink,webViewLink,webContentLink,modifiedTime)&q=${encodeURIComponent(q)}&orderBy=folder,modifiedTime desc`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${inMemoryAccessToken}` } });
            if (!res.ok) {
                if (res.status === 401) {
                    inMemoryAccessToken = null;
                    return renderLoginCard();
                }
                throw new Error('Gagal memuat berkas Drive');
            }
            const data = await res.json();
            renderDriveFileList(data.files || []);
        } catch (err) {
            const container = document.getElementById('gwFileListContainer');
            if (container) {
                container.innerHTML = `
                    <div style="text-align:center; padding:40px; color:#ef4444;">
                        <i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:10px;"></i>
                        <p style="font-size:0.9rem; font-weight:600;">Terjadi kendala saat memuat Google Drive: ${err.message}</p>
                        <button type="button" onclick="window.loginWithGoogleAccount()" style="margin-top:12px; background:#009846; color:white; border:none; border-radius:12px; padding:10px 20px; cursor:pointer; font-weight:700;">Masuk Ulang Akun Google</button>
                    </div>
                `;
            }
        }
    }

    // =========================================================================
    // RENDERING DAFTAR BERKAS DRIVE DENGAN DUKUNGAN SEMUA FORMAT LENGKAP
    // =========================================================================
    function renderDriveFileList(files) {
        const container = document.getElementById('gwFileListContainer');
        if (!container) return;

        if (files.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#94a3b8;">
                    <i class="fas fa-folder-open" style="font-size:3rem; margin-bottom:14px; color:#cbd5e1;"></i>
                    <p style="font-size:0.98rem; font-weight:700; color:#64748b; margin:0 0 4px 0;">Folder ini kosong</p>
                    <small style="color:#94a3b8;">Tidak ada berkas atau sub-folder di direktori ini.</small>
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
            html += `<div style="font-size:0.8rem; font-weight:800; color:#475569; text-transform:uppercase; margin:4px 0 10px 4px; display:flex; align-items:center; gap:8px;"><i class="fas fa-folder text-amber-500"></i> Folder Direktori (${folders.length}) - Klik untuk masuk</div>`;
            html += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px; margin-bottom:18px;">`;
            folders.forEach(folder => {
                html += `
                    <div class="gw-folder-card" onclick="window.openDriveFolder('${folder.id}', '${folder.name.replace(/'/g, "\\'")}')" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:14px; cursor:pointer; background:#ffffff; border:1.5px solid #e2e8f0; transition:all 0.15s; box-shadow:0 1px 3px rgba(0,0,0,0.03);" onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#f59e0b'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='#ffffff'; this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)';">
                        <div style="width:40px; height:40px; border-radius:10px; background:#fef3c7; display:flex; align-items:center; justify-content:center; color:#d97706; font-size:1.4rem; flex-shrink:0;">
                            <i class="fas fa-folder"></i>
                        </div>
                        <div style="flex:1; overflow:hidden;">
                            <div style="font-size:0.88rem; font-weight:800; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${folder.name}</div>
                            <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">Buka Sub-folder <i class="fas fa-arrow-right" style="font-size:0.65rem;"></i></div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        // Tampilkan Bagian Berkas Lengkap (MP4, JSON, PDF, XLS, DOCX, ZIP, AUDIO, DLL)
        if (regularFiles.length > 0) {
            if (folders.length > 0) {
                html += `<div style="font-size:0.8rem; font-weight:800; color:#475569; text-transform:uppercase; margin:8px 0 10px 4px; display:flex; align-items:center; gap:8px;"><i class="fas fa-file-alt text-primary"></i> Berkas Dokumen, Video & Media (${regularFiles.length})</div>`;
            }

            regularFiles.forEach(f => {
                const isSelected = currentSelectedDriveFiles.some(item => item.id === f.id);
                const sizeStr = f.size ? formatBytes(f.size) : 'Dokumen Cloud';
                const ext = (f.name.split('.').pop() || '').toLowerCase();

                let iconClass = 'fa-file-alt text-slate-600';
                let iconBg = '#f1f5f9';
                let formatBadge = `<span style="background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800;">${ext.toUpperCase() || 'FILE'}</span>`;

                if (f.mimeType.includes('image') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
                    iconClass = 'fa-file-image text-emerald-600'; iconBg = '#ecfdf5';
                    formatBadge = `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800;">GAMBAR</span>`;
                } else if (f.mimeType.includes('video') || ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'].includes(ext)) {
                    iconClass = 'fa-file-video text-rose-600'; iconBg = '#ffe4e6';
                    formatBadge = `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800;"><i class="fas fa-play" style="font-size:0.6rem;"></i> MP4 / VIDEO</span>`;
                } else if (f.mimeType.includes('json') || ext === 'json') {
                    iconClass = 'fa-file-code text-amber-600'; iconBg = '#fef3c7';
                    formatBadge = `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800;"><i class="fas fa-code"></i> JSON DATA</span>`;
                } else if (f.mimeType.includes('pdf') || ext === 'pdf') {
                    iconClass = 'fa-file-pdf text-rose-600'; iconBg = '#ffe4e6';
                    formatBadge = `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800;">PDF</span>`;
                } else if (f.mimeType.includes('spreadsheet') || f.mimeType.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) {
                    iconClass = 'fa-file-excel text-green-700'; iconBg = '#dcfce7';
                    formatBadge = `<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800;">EXCEL</span>`;
                } else if (f.mimeType.includes('document') || f.mimeType.includes('word') || ['doc', 'docx'].includes(ext)) {
                    iconClass = 'fa-file-word text-blue-600'; iconBg = '#dbeafe';
                    formatBadge = `<span style="background:#dbeafe; color:#1d4ed8; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800;">WORD</span>`;
                } else if (f.mimeType.includes('presentation') || f.mimeType.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
                    iconClass = 'fa-file-powerpoint text-orange-600'; iconBg = '#ffedd5';
                    formatBadge = `<span style="background:#ffedd5; color:#c2410c; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800;">PPT</span>`;
                } else if (f.mimeType.includes('audio') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
                    iconClass = 'fa-file-audio text-purple-600'; iconBg = '#f3e8ff';
                    formatBadge = `<span style="background:#f3e8ff; color:#7e22ce; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800;"><i class="fas fa-music"></i> AUDIO</span>`;
                } else if (f.mimeType.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
                    iconClass = 'fa-file-archive text-indigo-600'; iconBg = '#e0e7ff';
                    formatBadge = `<span style="background:#e0e7ff; color:#4338ca; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800;">ARSIP ZIP</span>`;
                }

                html += `
                    <div class="gw-file-row ${isSelected ? 'selected' : ''}" onclick="window.toggleSelectDriveFile('${f.id}')" style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-radius:14px; margin-bottom:8px; cursor:pointer; background:${isSelected ? '#f0fdf4' : '#ffffff'}; border:2px solid ${isSelected ? '#009846' : '#e2e8f0'}; transition:all 0.15s; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                        <div style="display:flex; align-items:center; gap:14px; flex:1; overflow:hidden;">
                            <input type="checkbox" id="chk_gw_${f.id}" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); window.toggleSelectDriveFile('${f.id}')" style="cursor:pointer; accent-color:#009846; width:19px; height:19px;">
                            <div style="width:40px; height:40px; border-radius:10px; background:${iconBg}; display:flex; align-items:center; justify-content:center; font-size:1.3rem; flex-shrink:0;">
                                <i class="fas ${iconClass}"></i>
                            </div>
                            <div style="flex:1; overflow:hidden;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="font-size:0.9rem; font-weight:800; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.name}</span>
                                    ${formatBadge}
                                </div>
                                <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${sizeStr}</div>
                            </div>
                        </div>
                        <a href="${f.webViewLink}" target="_blank" onclick="event.stopPropagation()" style="color:#0284c7; font-size:0.82rem; padding:6px 12px; border-radius:8px; text-decoration:none; display:flex; align-items:center; gap:6px; font-weight:700;" title="Buka berkas di Google Drive" onmouseover="this.style.background='#e0f2fe'" onmouseout="this.style.background='transparent'">
                            <i class="fas fa-external-link-alt"></i> Pratinjau
                        </a>
                    </div>
                `;
            });
        }

        window.currentDriveLoadedFiles = files;
        container.innerHTML = html;
        updateModalFooter(currentSelectedDriveFiles.length);
    }

    // =========================================================================
    // MEMUAT GOOGLE FOTO RESMI (FOTO, VIDEO MP4, DAN ALBUM GALERI)
    // =========================================================================
    async function loadGooglePhotosFiles(folderId = null) {
        const body = document.getElementById('gwModalBody');
        if (!body) return;

        if (folderId !== null) {
            currentFolderId = folderId;
        }

        body.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px; height:100%;">
                ${renderUserProfileHeader()}
                ${renderBreadcrumbsBar()}

                <!-- Tab Pemilih Khusus Google Foto -->
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; gap:8px; background:#f1f5f9; padding:5px; border-radius:16px; border:1px solid #e2e8f0;">
                        <button type="button" onclick="window.switchPhotosTab('all')" style="border:none; border-radius:12px; padding:8px 18px; font-size:0.84rem; font-weight:800; cursor:pointer; background:${photosActiveTab === 'all' ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'transparent'}; color:${photosActiveTab === 'all' ? '#ffffff' : '#64748b'}; transition:all 0.15s; box-shadow:${photosActiveTab === 'all' ? '0 2px 8px rgba(225,29,72,0.3)' : 'none'};">
                            <i class="fas fa-images"></i> Semua Foto & Video (Galeri)
                        </button>
                        <button type="button" onclick="window.switchPhotosTab('albums')" style="border:none; border-radius:12px; padding:8px 18px; font-size:0.84rem; font-weight:800; cursor:pointer; background:${photosActiveTab === 'albums' ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'transparent'}; color:${photosActiveTab === 'albums' ? '#ffffff' : '#64748b'}; transition:all 0.15s; box-shadow:${photosActiveTab === 'albums' ? '0 2px 8px rgba(225,29,72,0.3)' : 'none'};">
                            <i class="fas fa-folder"></i> Album Google Foto
                        </button>
                        <button type="button" onclick="window.switchPhotosTab('videos')" style="border:none; border-radius:12px; padding:8px 18px; font-size:0.84rem; font-weight:800; cursor:pointer; background:${photosActiveTab === 'videos' ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'transparent'}; color:${photosActiveTab === 'videos' ? '#ffffff' : '#64748b'}; transition:all 0.15s; box-shadow:${photosActiveTab === 'videos' ? '0 2px 8px rgba(225,29,72,0.3)' : 'none'};">
                            <i class="fas fa-play"></i> Video (MP4)
                        </button>
                    </div>
                    <span id="gwPhotosCountSelected" style="color:#e11d48; font-weight:800; background:#fff1f2; padding:6px 16px; border-radius:14px; border:1px solid #fecdd3; font-size:0.84rem;">
                        ${currentSelectedDriveFiles.length} foto/video dipilih
                    </span>
                </div>

                <!-- Grid Tampilan Foto & Video -->
                <div id="gwPhotosGridContainer" style="flex:1; overflow-y:auto; min-height:360px; max-height:490px; border:1.5px solid #e2e8f0; border-radius:20px; padding:18px; background:#f8fafc; display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:16px; align-content:start;">
                    <div style="grid-column:1/-1; text-align:center; padding:50px; color:#64748b;"><i class="fas fa-spinner fa-spin fa-2x"></i><div style="margin-top:10px; font-weight:600;">Memuat galeri foto & video dari Google Foto...</div></div>
                </div>
            </div>
        `;

        try {
            let q = "trashed = false";

            if (currentFolderId === 'root') {
                if (photosActiveTab === 'albums') {
                    // Cari direktori album (misal album/folder kependudukan, dokumentasi, foto dsb)
                    q += ` and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents`;
                } else if (photosActiveTab === 'videos') {
                    // Semua video MP4 di Google Foto & akun Google
                    q += ` and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mov' or name contains '.mkv' or name contains '.webm')`;
                } else {
                    // Tampilkan SEMUA foto & video di akun pengguna (PERSIS seperti aplikasi Google Foto)
                    // Tidak dibatasi ke 'root in parents' agar semua foto dari kamera, galeri, backup tersaji seketika!
                    q += ` and (mimeType contains 'image/' or mimeType contains 'video/')`;
                }
            } else {
                // Di dalam subfolder tertentu
                if (photosActiveTab === 'albums') {
                    q += ` and '${currentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`;
                } else if (photosActiveTab === 'videos') {
                    q += ` and '${currentFolderId}' in parents and (mimeType contains 'video/' or name contains '.mp4')`;
                } else {
                    q += ` and '${currentFolderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/' or mimeType = 'application/vnd.google-apps.folder')`;
                }
            }

            const url = `https://www.googleapis.com/drive/v3/files?pageSize=100&fields=nextPageToken,files(id,name,mimeType,size,thumbnailLink,webViewLink,webContentLink,modifiedTime)&q=${encodeURIComponent(q)}&orderBy=folder,modifiedTime desc`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${inMemoryAccessToken}` } });
            if (!res.ok) {
                if (res.status === 401) {
                    inMemoryAccessToken = null;
                    return renderLoginCard();
                }
                throw new Error('Gagal memuat galeri foto');
            }
            const data = await res.json();
            renderPhotosGrid(data.files || []);
        } catch (err) {
            const container = document.getElementById('gwPhotosGridContainer');
            if (container) {
                container.innerHTML = `
                    <div style="grid-column:1/-1; text-align:center; padding:40px; color:#ef4444;">
                        <p style="font-size:0.9rem; font-weight:600;">Kendala memuat galeri foto: ${err.message}</p>
                        <button type="button" onclick="window.loginWithGoogleAccount()" style="margin-top:12px; background:#e11d48; color:white; border:none; border-radius:14px; padding:10px 20px; cursor:pointer; font-weight:700;">Masuk Ulang Akun Google</button>
                    </div>
                `;
            }
        }
    }

    window.switchPhotosTab = function (tab) {
        photosActiveTab = tab;
        loadGooglePhotosFiles(currentFolderId);
    };

    // =========================================================================
    // RENDERING GRID GOOGLE FOTO (FOTO, VIDEO MP4, DAN ALBUM FOLDER)
    // =========================================================================
    function renderPhotosGrid(files) {
        const container = document.getElementById('gwPhotosGridContainer');
        if (!container) return;

        if (files.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:#94a3b8;">
                    <i class="fas fa-images" style="font-size:3rem; margin-bottom:14px; color:#cbd5e1;"></i>
                    <p style="font-size:0.95rem; font-weight:700; color:#64748b; margin:0 0 4px 0;">Tidak ada foto/video di tampilan ini</p>
                    <small style="color:#94a3b8;">Silakan klik tab "Semua Foto & Video (Galeri)" untuk melihat seluruh media akun Anda.</small>
                </div>
            `;
            updateModalFooter(currentSelectedDriveFiles.length);
            return;
        }

        const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        const mediaItems = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

        let html = '';

        // Tampilkan Folder / Album jika ada
        folders.forEach(folder => {
            html += `
                <div onclick="window.openDriveFolder('${folder.id}', '${folder.name.replace(/'/g, "\\'")}')" style="height:165px; width:100%; border-radius:18px; background:#ffffff; border:1.5px solid #e2e8f0; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; padding:12px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.04); transition:all 0.15s;" onmouseover="this.style.transform='translateY(-3px)'; this.style.borderColor='#f43f5e'; this.style.boxShadow='0 6px 16px rgba(244,63,94,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='#e2e8f0'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)';">
                    <div style="width:52px; height:52px; border-radius:50%; background:#fff1f2; color:#e11d48; display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin-bottom:8px; border:1px solid #fecdd3;">
                        <i class="fas fa-images"></i>
                    </div>
                    <div style="font-size:0.86rem; font-weight:800; color:#1e293b; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${folder.name}</div>
                    <span style="font-size:0.72rem; color:#64748b; margin-top:2px;">Buka Album <i class="fas fa-chevron-right" style="font-size:0.6rem;"></i></span>
                </div>
            `;
        });

        // Tampilkan Foto & Video MP4 Proporsional
        mediaItems.forEach(f => {
            const isSelected = currentSelectedDriveFiles.some(item => item.id === f.id);
            const isVideo = Boolean(f.mimeType.includes('video') || f.name.toLowerCase().endsWith('.mp4') || f.name.toLowerCase().endsWith('.mov') || f.name.toLowerCase().endsWith('.mkv'));
            const thumb = f.thumbnailLink ? f.thumbnailLink.replace(/=s\d+/, '=s500') : (isVideo ? 'https://placehold.co/400x300/1e293b/ffffff?text=Video+MP4' : 'https://placehold.co/400x300?text=Foto');

            html += `
                <div class="gw-photo-card ${isSelected ? 'selected' : ''}" onclick="window.toggleSelectDriveFile('${f.id}')" style="position:relative; width:100%; height:165px; border-radius:18px; overflow:hidden; cursor:pointer; border:3px solid ${isSelected ? '#e11d48' : 'transparent'}; box-shadow:${isSelected ? '0 4px 14px rgba(225,29,72,0.35)' : '0 2px 8px rgba(0,0,0,0.08)'}; transition:all 0.15s; background:#0f172a;" onmouseover="this.style.transform='scale(1.02)';" onmouseout="this.style.transform='scale(1)';">
                    <img src="${thumb}" alt="${f.name}" referrerpolicy="no-referrer" style="width:100%; height:100%; object-fit:cover; display:block;">

                    <!-- Badge Jika Video MP4 -->
                    ${isVideo ? `
                        <div style="position:absolute; top:10px; left:10px; background:rgba(225,29,72,0.9); backdrop-filter:blur(4px); color:white; padding:3px 8px; border-radius:8px; font-size:0.68rem; font-weight:800; display:flex; align-items:center; gap:4px; box-shadow:0 2px 6px rgba(0,0,0,0.3);">
                            <i class="fas fa-play" style="font-size:0.55rem;"></i> MP4 VIDEO
                        </div>
                    ` : ''}

                    <!-- Selection Badge -->
                    <div style="position:absolute; top:10px; right:10px; background:${isSelected ? '#e11d48' : 'rgba(15,23,42,0.65)'}; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3); border:2px solid #ffffff; transition:all 0.15s;">
                        <i class="fas ${isSelected ? 'fa-check' : 'fa-plus'}" style="color:white; font-size:0.75rem;"></i>
                    </div>

                    <!-- Label Nama Foto / Video Bawah -->
                    <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(15,23,42,0.92)); padding:8px 10px; font-size:0.72rem; font-weight:700; color:white; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        ${f.name}
                    </div>
                </div>
            `;
        });

        window.currentDriveLoadedFiles = files;
        container.innerHTML = html;
        updateModalFooter(currentSelectedDriveFiles.length);
    }

    // Toggle Pilihan Berkas / Foto
    window.toggleSelectDriveFile = function (id) {
        const fileObj = (window.currentDriveLoadedFiles || []).find(f => f.id === id);
        if (!fileObj) return;

        // Jika folder diklik, masuk ke dalam folder tersebut
        if (fileObj.mimeType === 'application/vnd.google-apps.folder') {
            return window.openDriveFolder(fileObj.id, fileObj.name);
        }

        const idx = currentSelectedDriveFiles.findIndex(item => item.id === id);
        if (idx >= 0) {
            currentSelectedDriveFiles.splice(idx, 1);
        } else {
            currentSelectedDriveFiles.push(fileObj);
        }

        // Perbarui tampilan
        if (window.activePickerType === 'photos') {
            const countEl = document.getElementById('gwPhotosCountSelected');
            if (countEl) countEl.innerText = `${currentSelectedDriveFiles.length} foto/video dipilih`;
            renderPhotosGrid(window.currentDriveLoadedFiles || []);
        } else {
            renderDriveFileList(window.currentDriveLoadedFiles || []);
        }
    };

    window.searchGoogleWorkspaceFiles = function (query) {
        loadGoogleDriveFiles(query, currentFolderId);
    };

    function updateModalFooter(count) {
        const footer = document.getElementById('gwModalFooter');
        if (!footer) return;
        const isPhotos = window.activePickerType === 'photos';
        const primaryColor = isPhotos ? '#e11d48' : '#009846';

        footer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:12px; flex-wrap:wrap;">
                <div style="font-size:0.9rem; font-weight:800; color:${isPhotos ? '#9f1239' : '#065f46'};">
                    ${count > 0 ? `<i class="fas fa-check-circle"></i> <strong>${count}</strong> berkas dipilih` : `Pilih berkas, foto, atau video yang ingin dikirim`}
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button type="button" onclick="window.closeGoogleWorkspaceModal()" style="background:#e2e8f0; color:#475569; border:none; border-radius:14px; padding:10px 20px; font-weight:700; font-size:0.86rem; cursor:pointer;">Batal & Keluar</button>
                    
                    <!-- Tombol 1: Tambahkan ke Antrean Lampiran -->
                    <button type="button" onclick="window.confirmAttachGoogleWorkspaceFiles(false)" ${count === 0 ? 'disabled' : ''} style="background:${count > 0 ? '#3b82f6' : '#94a3b8'}; color:white; border:none; border-radius:14px; padding:10px 20px; font-weight:700; font-size:0.86rem; cursor:${count > 0 ? 'pointer' : 'not-allowed'}; box-shadow:${count > 0 ? '0 2px 8px rgba(59,130,246,0.3)' : 'none'}; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-paperclip"></i> Tambah Lampiran
                    </button>

                    <!-- Tombol 2: Kirim Langsung ke Obrolan Sekarang -->
                    <button type="button" onclick="window.confirmAttachGoogleWorkspaceFiles(true)" ${count === 0 ? 'disabled' : ''} style="background:${count > 0 ? primaryColor : '#94a3b8'}; color:white; border:none; border-radius:14px; padding:10px 24px; font-weight:800; font-size:0.86rem; cursor:${count > 0 ? 'pointer' : 'not-allowed'}; box-shadow:${count > 0 ? '0 4px 14px rgba(0,0,0,0.2)' : 'none'}; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-paper-plane"></i> Kirim Langsung
                    </button>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // EKSEKUSI PENGIRIMAN ATAU PELAMPIRAN BERKAS GOOGLE SECARA LENGKAP
    // =========================================================================
    window.confirmAttachGoogleWorkspaceFiles = async function (sendDirectly = false) {
        if (currentSelectedDriveFiles.length === 0) return;
        const selected = [...currentSelectedDriveFiles];
        
        // Simpan referensi dan tutup modal
        const modal = document.getElementById('modalGoogleWorkspacePicker');
        if (modal) modal.style.display = 'none';

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: sendDirectly ? 'Mengirimkan Berkas...' : 'Menyiapkan Berkas...',
                html: `<div>Menyiapkan <b>${selected.length}</b> berkas dari Google...</div>`,
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
        }

        const preparedFiles = [];

        for (const item of selected) {
            try {
                // Unduh konten biner file dari Google Drive
                const downloadUrl = `https://www.googleapis.com/drive/v3/files/${item.id}?alt=media`;
                const res = await fetch(downloadUrl, {
                    headers: { Authorization: `Bearer ${inMemoryAccessToken}` }
                });

                if (res.ok) {
                    const blob = await res.blob();
                    const finalType = blob.type || item.mimeType || 'application/octet-stream';
                    const file = new File([blob], item.name, { type: finalType });
                    preparedFiles.push({
                        id: item.id,
                        name: item.name,
                        type: resolveCategory(item.mimeType, item.name),
                        mimeType: finalType,
                        file: file,
                        size: blob.size || item.size || 0,
                        webViewLink: item.webViewLink
                    });
                } else {
                    // Fallback link jika berkas hanya berupa Google Docs / Cloud Link
                    preparedFiles.push({
                        id: item.id,
                        name: item.name,
                        type: resolveCategory(item.mimeType, item.name),
                        mimeType: item.mimeType,
                        isCloudLink: true,
                        webViewLink: item.webViewLink,
                        size: item.size || 0
                    });
                }
            } catch (e) {
                console.warn('Gagal mengunduh biner berkas Google:', item.name, e);
                preparedFiles.push({
                    id: item.id,
                    name: item.name,
                    type: resolveCategory(item.mimeType, item.name),
                    mimeType: item.mimeType,
                    isCloudLink: true,
                    webViewLink: item.webViewLink,
                    size: item.size || 0
                });
            }
        }

        if (sendDirectly) {
            await executeDirectSendToChat(preparedFiles);
        } else {
            // Masukkan ke dalam antrean form obrolan aktif
            deliverToAttachmentQueue(preparedFiles);
        }

        // Logout setelah selesai melampirkan agar berikutnya wajib login lagi
        window.logoutGoogleWorkspace(true);
    };

    function resolveCategory(mimeType, fileName) {
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        if (mimeType && mimeType.includes('image')) return 'image';
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
        if (mimeType && mimeType.includes('video')) return 'video';
        if (['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'].includes(ext)) return 'video';
        if (mimeType && mimeType.includes('audio')) return 'audio';
        if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio';
        if (ext === 'json') return 'document';
        return 'document';
    }

    function deliverToAttachmentQueue(preparedFiles) {
        const isWarga = currentPickerContext === 'warga-chat' || currentPickerContext === 'warga-voice-preview';

        if (isWarga) {
            const rawFiles = preparedFiles.filter(p => p.file instanceof Blob).map(p => p.file);
            if (rawFiles.length > 0 && typeof window.addWargaChatAttachments === 'function') {
                window.addWargaChatAttachments(rawFiles);
            }
        } else {
            const realBinaryFiles = preparedFiles.filter(p => p.file instanceof Blob);
            if (realBinaryFiles.length > 0 && typeof window.appendAdminMediaSelection === 'function') {
                window.appendAdminMediaSelection({ files: realBinaryFiles.map(p => p.file) });
            } else if (typeof window.addAdminChatAttachments === 'function') {
                window.addAdminChatAttachments(preparedFiles);
            }
        }

        if (typeof Swal !== 'undefined' && preparedFiles.length > 0) {
            Swal.fire({
                icon: 'success',
                title: 'Berkas Berhasil Dilampirkan',
                text: `${preparedFiles.length} berkas dari Google berhasil ditambahkan ke lampiran pesan.`,
                timer: 1600,
                showConfirmButton: false
            });
        }
    }

    // Eksekusi pengiriman langsung ke sesi percakapan chat aktif
    async function executeDirectSendToChat(files) {
        if (!files || files.length === 0) return;

        const isWargaContext = currentPickerContext === 'warga-chat' || currentPickerContext === 'warga-voice-preview' || (typeof window.activeChatNik === 'undefined' && typeof window.wargaNik !== 'undefined');
        const targetNik = isWargaContext 
            ? (window.wargaNik || (window.sesiWargaAktif && window.sesiWargaAktif.nik)) 
            : window.activeChatNik;

        if (!targetNik) {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Perhatian', 'Pilih obrolan warga terlebih dahulu untuk mengirimkan berkas.', 'warning');
            }
            return;
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const sender = isWargaContext ? 'warga' : 'petugas';
        const handler = isWargaContext 
            ? ((window.sesiWargaAktif && window.sesiWargaAktif.nama_lengkap) || window.wargaNama || 'Warga') 
            : `Dinsos Sidoarjo (${((window.chatHandlersMap && window.chatHandlersMap[targetNik]) || 'Petugas').toUpperCase()})`;

        let successCount = 0;

        for (const item of files) {
            const formData = new FormData();
            formData.append('sender', sender);
            formData.append('nama', handler);
            formData.append('waktu', timeStr);
            formData.append('created_at', now.toISOString());

            if (item.file && item.file instanceof Blob) {
                formData.append('files', item.file, item.name);
            } else if (item.isCloudLink) {
                formData.append('file_url', item.webViewLink || '');
                formData.append('file_name', item.name);
                formData.append('file_type', item.type || 'document');
                formData.append('pesan', `📎 [GOOGLE_WORKSPACE] ${item.name}`);
            }

            try {
                const apiBase = (typeof BASE_API_URL !== 'undefined') ? BASE_API_URL : ((typeof API_URL !== 'undefined') ? API_URL : '');
                const res = await fetch(`${apiBase}/api/chat/${encodeURIComponent(targetNik)}`, {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) successCount++;
            } catch (err) {
                console.error('Gagal mengirim berkas Google:', err);
            }
        }

        // Segarkan percakapan
        if (isWargaContext) {
            if (typeof window.loadChatMessagesWarga === 'function') {
                window.loadChatMessagesWarga(false);
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
            <div style="background:#ffffff; border-radius:28px; width:95%; max-width:920px; height:88vh; max-height:850px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.3); border:1px solid #e2e8f0;">
                <!-- Header -->
                <div style="padding:18px 24px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#ffffff;">
                    <div>
                        <h3 id="gwModalTitle" style="font-size:1.3rem; font-weight:800; color:#0f172a; margin:0; display:flex; align-items:center; gap:10px;">
                            <i class="fab fa-google-drive text-emerald-600"></i> Google Drive
                        </h3>
                        <div id="gwModalSubtitle" style="font-size:0.82rem; color:#64748b; margin-top:3px;">
                            Pilih berkas dari Google Drive pribadi Anda
                        </div>
                    </div>
                    <button type="button" onclick="window.closeGoogleWorkspaceModal()" style="background:#f1f5f9; border:none; width:40px; height:40px; border-radius:50%; color:#64748b; font-size:1.4rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">&times;</button>
                </div>
                <!-- Body -->
                <div id="gwModalBody" style="padding:20px 24px; overflow-y:auto; flex:1;"></div>
                <!-- Footer -->
                <div id="gwModalFooter" style="padding:16px 24px; border-top:1px solid #e2e8f0; background:#f8fafc;"></div>
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

    // Inisialisasi awal saat dokumen siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGoogleClient);
    } else {
        initGoogleClient();
    }
})();
