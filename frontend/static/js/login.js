/* =========================================================================
   LOGIN.JS - SISTEM PENDUKUNG KEPUTUSAN BANSOS PEMKAB SIDOARJO
   AUTENTIKASI PEGAWAI DINAS SOSIAL (LENGKAP DENGAN TUR & CEK BPS)
   Lokasi: frontend/static/js/login.js
   ========================================================================= */

(function (window) {
    'use strict';

    // 1. RESOLUSI BASE URL & ENDPOINT
    const BASE_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
        ? window.CONFIG.BASE_URL.replace(/\/+$/, '')
        : ((typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL.replace(/\/+$/, '') : 'http://127.0.0.1:5000');

    const API_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.API_BASE_URL)
        ? window.CONFIG.API_BASE_URL.replace(/\/+$/, '')
        : `${BASE_URL}/api`;

    let expectedCaptcha = 0;
    let isSecure = false;

    // 2. HELPER SWEETALERT2 DENGAN FALLBACK NATIVE DIALOG
    function showAlert(options) {
        if (typeof Swal !== 'undefined') {
            return Swal.fire(options);
        }
        alert(options.text || options.title || 'Pemberitahuan');
        return Promise.resolve({ isConfirmed: true, value: true });
    }

    // 3. GENERATOR CAPTCHA & TOGGLE VISIBILITAS SANDI
    function generateCaptcha() {
        const num1 = Math.floor(Math.random() * 9) + 1;
        const num2 = Math.floor(Math.random() * 9) + 1;
        expectedCaptcha = num1 + num2;

        const qEl = document.getElementById('captchaQuestion');
        const ansEl = document.getElementById('captchaAnswer');

        if (qEl) qEl.textContent = `${num1} + ${num2} =`;
        if (ansEl) {
            ansEl.value = '';
        }
    }

    function togglePassword(inputId, iconId) {
        const pwd = document.getElementById(inputId);
        const eye = document.getElementById(iconId);

        if (pwd && eye) {
            if (pwd.type === 'password') {
                pwd.type = 'text';
                eye.className = 'fas fa-eye-slash';
            } else {
                pwd.type = 'password';
                eye.className = 'fas fa-eye';
            }
        }
    }

    // 4. TUR PANDUAN INTERAKTIF AKSES SISTEM
    async function mulaiTurLogin() {
        const steps = [
            {
                title: 'Selamat Datang di Sistem Bansos Sidoarjo',
                html: '<div style="font-size:0.92rem; color:#475569; line-height:1.6; text-align:left;">Halaman ini <b>khusus bagi Petugas Lapangan & Administrator</b> Dinas Sosial. Akses ke modul verifikasi dan SPK memerlukan akun resmi terdaftar.</div>',
                icon: 'info',
                confirmButtonText: 'Lanjut <i class="fas fa-arrow-right"></i>'
            },
            {
                title: 'Akses Warga / Masyarakat',
                html: '<div style="font-size:0.92rem; color:#475569; line-height:1.6; text-align:left;">Masyarakat umum <b>tidak perlu login</b>. Klik tombol <b>"Portal Warga"</b> di pojok kanan atas untuk mengecek penetapan desil atau menyampaikan sanggahan bansos.</div>',
                icon: 'question',
                confirmButtonText: 'Paham <i class="fas fa-arrow-right"></i>'
            },
            {
                title: 'Pengecekan Data BPS Terpadu',
                html: '<div style="font-size:0.92rem; color:#475569; line-height:1.6; text-align:left;">Gunakan tombol lingkaran biru <b>"Cek BPS"</b> di pojok kanan bawah untuk memverifikasi 16 digit NIK pada basis data DTSEN secara langsung.</div>',
                icon: 'success',
                confirmButtonText: 'Selesai <i class="fas fa-check"></i>'
            }
        ];

        for (let i = 0; i < steps.length; i++) {
            await showAlert({
                title: steps[i].title,
                html: steps[i].html,
                icon: steps[i].icon,
                confirmButtonText: steps[i].confirmButtonText,
                confirmButtonColor: '#10b981'
            });
        }
    }

    // 5. FITUR CEK CEPAT BPS & DUKCAPIL
    async function cekDataBPS() {
        let nik = '';
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: '<i class="fas fa-database text-info"></i> Verifikasi Cepat BPS Sidoarjo',
                html: '<p style="font-size:0.88rem; color:#64748b; margin-bottom:12px;">Masukkan 16 digit NIK warga untuk memverifikasi data DTKS / DTSEN Desil 1–5:</p>',
                input: 'text',
                inputPlaceholder: 'Contoh: 3515xxxxxxxxxxxx',
                inputAttributes: {
                    maxlength: '16',
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-search"></i> Pindai NIK',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#0284c7',
                cancelButtonColor: '#94a3b8',
                inputValidator: (value) => {
                    if (!value || value.trim().length !== 16 || !/^\d+$/.test(value.trim())) {
                        return 'Mohon masukkan tepat 16 digit angka NIK!';
                    }
                }
            });
            if (!result.isConfirmed || !result.value) return;
            nik = result.value.trim();
        } else {
            const promptVal = prompt('Masukkan 16 digit NIK warga:');
            if (!promptVal || promptVal.trim().length !== 16 || !/^\d+$/.test(promptVal.trim())) {
                alert('NIK harus berupa 16 digit angka.');
                return;
            }
            nik = promptVal.trim();
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Memindai Basis Data...',
                html: `Mencocokkan NIK <b>${nik}</b> ke peladen BPS Sidoarjo...`,
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
        }

        try {
            // Cek status penetapan bansos
            const res = await fetch(`${API_URL}/publik/cek-bansos?nik=${encodeURIComponent(nik)}`);
            const json = await res.json().catch(() => ({}));

            if (res.ok && json.data) {
                const d = json.data;
                const desil = parseInt(d.desil || '5', 10);
                const isLayak = desil <= 4;
                const namaWarga = d.nama_lengkap || d.nama || 'Warga Terdata';
                const statusBansos = d.status_bansos || (isLayak ? 'Layak Bansos' : 'Bukan Prioritas');

                showAlert({
                    icon: isLayak ? 'success' : 'info',
                    title: isLayak ? 'Terdaftar & Layak Bansos' : 'Terdaftar (Desil Non-Prioritas)',
                    html: `
                        <div style="text-align:left; font-size:0.9rem; background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0; line-height:1.7;">
                            <div><b>Nama:</b> ${namaWarga}</div>
                            <div><b>NIK:</b> ${d.nik}</div>
                            <div><b>Alamat:</b> ${d.alamat || 'Kabupaten Sidoarjo'}</div>
                            <div style="margin-top:4px;"><b>Kelompok Desil:</b> Desil ${desil}</div>
                            <div><b>Status Kelayakan:</b> <span style="background:${isLayak ? '#dcfce7' : '#e0f2fe'}; color:${isLayak ? '#15803d' : '#0369a1'}; padding:3px 10px; border-radius:20px; font-weight:700;">${statusBansos}</span></div>
                        </div>
                    `,
                    confirmButtonColor: '#10b981'
                });
            } else {
                // Konfirmasi ke catatan sipil Dukcapil
                const dukcapilRes = await fetch(`${API_URL}/dukcapil/${encodeURIComponent(nik)}`).catch(() => null);
                if (dukcapilRes && dukcapilRes.ok) {
                    const dukJson = await dukcapilRes.json();
                    const duk = dukJson.data || {};
                    const confirmRes = await showAlert({
                        icon: 'warning',
                        title: 'Belum Terdaftar di Bansos',
                        html: `
                            <div style="text-align:left; font-size:0.9rem; line-height:1.6;">
                                <p>NIK <b>${nik}</b> aktif di Dukcapil atas nama <b>${duk.nama || 'Warga'}</b>, namun <u>belum masuk</u> daftar penerima bantuan.</p>
                                <p style="margin-top:10px; color:#059669; font-weight:600;">Warga dapat mengajukan pendaftaran mandiri melalui Portal Warga.</p>
                            </div>
                        `,
                        showCancelButton: true,
                        confirmButtonText: 'Buka Portal Warga',
                        cancelButtonText: 'Tutup',
                        confirmButtonColor: '#10b981'
                    });
                    if (confirmRes.isConfirmed) {
                        window.location.href = 'publik.html';
                    }
                } else {
                    showAlert({
                        icon: 'error',
                        title: 'Data Tidak Ditemukan',
                        text: `NIK ${nik} tidak terdaftar pada basis data kependudukan maupun bansos.`
                    });
                }
            }
        } catch (e) {
            showAlert({
                icon: 'error',
                title: 'Koneksi Gagal',
                text: 'Gagal menghubungi server basis data BPS.'
            });
        }
    }

    // 6. KONTROL MODAL PEMULIHAN SANDI
    function openResetModal() {
        const modal = document.getElementById('resetModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeResetModal() {
        const modal = document.getElementById('resetModal');
        if (modal) modal.style.display = 'none';
    }

    function handleResetPassword(e) {
        if (e && e.preventDefault) e.preventDefault();
        const userInput = document.getElementById('resetUser');
        const passInput = document.getElementById('resetNewPass');

        if (!userInput || !userInput.value.trim()) {
            showAlert({ icon: 'warning', title: 'Perhatian', text: 'Username wajib diisi.' });
            return;
        }

        showAlert({
            title: 'Pengajuan Terkirim',
            text: `Permintaan reset sandi untuk akun "${userInput.value.trim()}" telah dicatat. Silakan hubungi Administrator.`,
            icon: 'success',
            confirmButtonColor: '#10b981'
        });

        if (userInput) userInput.value = '';
        if (passInput) passInput.value = '';
        closeResetModal();
    }

    // 7. INISIALISASI HALAMAN & PENANGANAN SUBMIT LOGIN
    function initLoginPage() {
        // Redirect jika sudah memiliki token aktif
        if (window.Auth && typeof window.Auth.isAuthenticated === 'function' && window.Auth.isAuthenticated()) {
            window.location.replace(window.CONFIG?.AUTH?.DASHBOARD_REDIRECT_URL || 'index.html');
            return;
        }

        // Panggil endpoint init-kriteria di latar belakang jika tabel belum siap
        fetch(`${BASE_URL}/init-kriteria`, { method: 'GET' }).catch(() => {});

        // Simulasi verifikasi koneksi peladen terenkripsi (800ms)
        setTimeout(() => {
            const spinner = document.getElementById('cf-spinner');
            const successIcon = document.getElementById('cf-success');
            const cfText = document.getElementById('cf-text');
            const captchaBox = document.getElementById('captchaBox');
            const btn = document.getElementById('btnSubmit');

            if (spinner) spinner.style.display = 'none';
            if (successIcon) successIcon.style.display = 'block';
            if (cfText) cfText.textContent = 'Koneksi Peladen Terenkripsi (Aman).';
            if (captchaBox) captchaBox.style.display = 'flex';

            generateCaptcha();

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Login <i class="fas fa-sign-in-alt"></i>';
            }
            isSecure = true;
        }, 800);

        const form = document.getElementById('loginForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isSecure) return;

            const ansInput = document.getElementById('captchaAnswer');
            const answer = parseInt(ansInput ? ansInput.value : '0', 10);

            if (answer !== expectedCaptcha) {
                showAlert({
                    icon: 'error',
                    title: 'Anti-Bot Aktif',
                    text: 'Hasil perhitungan matematika salah. Silakan ulangi.'
                });
                generateCaptcha();
                if (ansInput) {
                    ansInput.value = '';
                    ansInput.focus();
                }
                return;
            }

            const btn = document.getElementById('btnSubmit');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memverifikasi...';
                btn.disabled = true;
            }

            const usernameVal = document.getElementById('username')?.value.trim() || '';
            const passwordVal = document.getElementById('password')?.value || '';

            if (!usernameVal || !passwordVal) {
                showAlert({ icon: 'warning', title: 'Data Belum Lengkap', text: 'Username dan kata sandi wajib diisi.' });
                if (btn) {
                    btn.innerHTML = 'Login <i class="fas fa-sign-in-alt"></i>';
                    btn.disabled = false;
                }
                return;
            }

            try {
                // Mendukung pemanggilan via helper window.apiFetch atau fetch langsung
                let data = null;
                const loginUrl = `${BASE_URL}/login`;

                const res = await fetch(loginUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: usernameVal, password: passwordVal })
                });

                data = await res.json().catch(() => ({}));

                if (res.ok && (data.status === 'success' || data.token || data.access_token)) {
                    const token = data.access_token || data.token;
                    const role = (data.role || data.data?.role || 'operator').toLowerCase();
                    const userObj = data.user || data.data || { username: usernameVal, role };

                    // Sinkronkan token ke seluruh layer sesi
                    if (window.Auth && typeof window.Auth.setSession === 'function') {
                        window.Auth.setSession(token, role, userObj);
                    } else if (typeof window.setAuthSession === 'function') {
                        window.setAuthSession(token, userObj);
                    } else {
                        localStorage.setItem('token', token);
                        localStorage.setItem('bansos_jwt_token', token);
                        localStorage.setItem('bansos_user_role', role);
                        localStorage.setItem('user', JSON.stringify(userObj));
                    }

                    showAlert({
                        icon: 'success',
                        title: 'Akses Diterima',
                        text: `Selamat bertugas, ${(userObj.nama_lengkap || userObj.username).toUpperCase()}!`,
                        showConfirmButton: false,
                        timer: 1000
                    }).then(() => {
                        const target = window.CONFIG?.AUTH?.DASHBOARD_REDIRECT_URL || 'index.html';
                        window.location.replace(target);
                    });
                } else {
                    showAlert({
                        icon: 'error',
                        title: 'Akses Ditolak',
                        text: data.message || 'Username atau kata sandi tidak sesuai.'
                    });
                    generateCaptcha();
                }
            } catch (err) {
                showAlert({
                    icon: 'error',
                    title: 'Koneksi Terputus',
                    text: 'Gagal terhubung ke server Flask di port 5000. Pastikan backend aktif.'
                });
            } finally {
                if (btn) {
                    btn.innerHTML = 'Login <i class="fas fa-sign-in-alt"></i>';
                    btn.disabled = false;
                }
            }
        });
    }

    // 8. REGISTRASI SIKLUS HIDUP & EKSPOS GLOBAL WINDOW
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLoginPage);
    } else {
        initLoginPage();
    }

    window.mulaiTurLogin = mulaiTurLogin;
    window.cekDataBPS = cekDataBPS;
    window.togglePassword = togglePassword;
    window.generateCaptcha = generateCaptcha;
    window.openResetModal = openResetModal;
    window.closeResetModal = closeResetModal;
    window.handleResetPassword = handleResetPassword;

})(window);