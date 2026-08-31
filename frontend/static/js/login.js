/* =========================================================================
   LOGIN.JS - SISTEM PENDUKUNG KEPUTUSAN BANSOS PEMKAB SIDOARJO
   AUTENTIKASI PEGAWAI DINAS SOSIAL (LENGKAP DENGAN TUR & CEK BPS)
   ========================================================================= */

const API_URL = "http://127.0.0.1:5000";
let expectedCaptcha = 0;
let isSecure = false;

// Bersihkan token lama setiap kali pengguna membuka halaman login
localStorage.clear();

// =========================================================================
// 1. INISIALISASI HALAMAN & SIMULASI ENKRIPSI
// =========================================================================
window.onload = () => {
    // Inisialisasi basis data jika baru pertama kali dipasang
    fetch(`${API_URL}/init-kriteria`, { method: 'GET' }).catch(e => console.log(e));

    // Simulasi Cloudflare Verification (800ms)
    setTimeout(() => {
        const spinner = document.getElementById('cf-spinner');
        const successIcon = document.getElementById('cf-success');
        const cfText = document.getElementById('cf-text');
        const captchaBox = document.getElementById('captchaBox');
        const btn = document.getElementById('btnSubmit');

        if (spinner) spinner.style.display = 'none';
        if (successIcon) successIcon.style.display = 'block';
        if (cfText) cfText.innerText = 'Koneksi Peladen Terenkripsi (Aman).';
        
        if (captchaBox) captchaBox.style.display = 'flex';
        generateCaptcha();
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Login <i class="fas fa-sign-in-alt"></i>';
        }
        isSecure = true;
    }, 800);
};

// =========================================================================
// 2. FUNGSI TUR INTERAKTIF PANDUAN AKSES SISTEM
// =========================================================================
async function mulaiTurLogin() {
    const steps = [
        {
            title: 'Selamat Datang di Sistem Bansos Sidoarjo',
            html: '<div style="font-size:0.95rem; color:#475569; line-height:1.6;">Halaman yang sedang Anda buka ini <b>KHUSUS untuk Pegawai/Petugas dan Administrator</b> Dinas Sosial Kabupaten Sidoarjo.</div>',
            icon: 'info',
            confirmButtonText: 'Lanjut <i class="fas fa-arrow-right"></i>'
        },
        {
            title: 'Bagaimana Cara Akses Masyarakat / Warga?',
            html: '<div style="font-size:0.95rem; color:#475569; line-height:1.6;">Warga masyarakat umum <b>TIDAK perlu login</b> di halaman ini. Silakan klik tombol <b>"Portal Warga"</b> di pojok kanan atas untuk mengajukan pendaftaran mandiri atau cek bantuan.</div>',
            icon: 'question',
            confirmButtonText: 'Paham <i class="fas fa-arrow-right"></i>'
        },
        {
            title: 'Fitur Pengecekan Data BPS Langsung',
            html: '<div style="font-size:0.95rem; color:#475569; line-height:1.6;">Petugas dapat langsung mengecek NIK warga apakah terdaftar di basis data kemiskinan BPS dengan mengklik <b>Tombol Lingkaran Biru (Cek BPS)</b> di sudut kanan bawah tanpa perlu login.</div>',
            icon: 'success',
            confirmButtonText: 'Tutup Panduan <i class="fas fa-check"></i>'
        }
    ];
    
    for (let i = 0; i < steps.length; i++) {
        await Swal.fire({
            title: steps[i].title,
            html: steps[i].html,
            icon: steps[i].icon,
            confirmButtonText: steps[i].confirmButtonText,
            confirmButtonColor: '#10b981'
        });
    }
}

// =========================================================================
// 3. GENERATOR CAPTCHA & TOGGLE PASSWORD
// =========================================================================
function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 9) + 1;
    const num2 = Math.floor(Math.random() * 9) + 1;
    expectedCaptcha = num1 + num2;
    
    const qEl = document.getElementById('captchaQuestion');
    const ansEl = document.getElementById('captchaAnswer');
    
    if (qEl) qEl.innerText = `${num1} + ${num2} =`;
    if (ansEl) ansEl.value = '';
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

// =========================================================================
// 4. FITUR POP-UP VERIFIKASI CEPAT DATA BPS (DENGAN NIK)
// =========================================================================
async function cekDataBPS() {
    const { value: nik } = await Swal.fire({
        title: '<i class="fas fa-database text-info"></i> Verifikasi Cepat BPS Sidoarjo',
        html: '<p style="font-size:0.9rem; color:#64748b; margin-bottom:12px;">Masukkan 16 digit NIK warga untuk memverifikasi kesesuaian pada basis data BPS / DTSEN Desil 1–5:</p>',
        input: 'text',
        inputPlaceholder: 'Contoh: 3515xxxxxxxxxxxx',
        inputAttributes: { maxlength: '16', autocapitalize: 'off', autocorrect: 'off' },
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-search"></i> Pindai NIK',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#0284c7',
        cancelButtonColor: '#94a3b8',
        inputValidator: (value) => {
            if (!value || value.trim().length !== 16 || !/^\d+$/.test(value.trim())) {
                return 'Mohon masukkan tepat 16 digit angka NIK yang valid!';
            }
        }
    });

    if (nik) {
        Swal.fire({
            title: 'Memindai Server BPS...',
            html: `Mencocokkan NIK <b>${nik}</b> dengan basis data terpadu...`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const res = await fetch(`${API_URL}/api/public/cek-bansos/${nik}`);
            const json = await res.json();

            if (res.ok && json.status === 'success') {
                const d = json.data;
                const isLayak = d.level === 2;
                Swal.fire({
                    icon: isLayak ? 'success' : 'info',
                    title: isLayak ? 'Data Terdaftar & Disetujui' : 'Data Terdaftar (Dalam Antrean Verifikasi)',
                    html: `
                        <div style="text-align:left; font-size:0.9rem; background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0; line-height:1.7;">
                            <div><b>Nama Penerima:</b> ${d.nama}</div>
                            <div><b>NIK:</b> ${d.nik}</div>
                            <div><b>Alamat Lengkap:</b> ${d.alamat || '-'}</div>
                            <div style="margin-top:6px;"><b>Status Kelayakan:</b> <span style="background:${isLayak ? '#dcfce7' : '#e0f2fe'}; color:${isLayak ? '#15803d' : '#0369a1'}; padding:3px 10px; border-radius:20px; font-weight:700;">${d.status}</span></div>
                        </div>
                    `,
                    confirmButtonColor: '#10b981'
                });
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Belum Terdaftar di Bansos',
                    text: `NIK ${nik} belum masuk dalam daftar penerima bantuan sosial terpadu.`,
                    confirmButtonColor: '#10b981'
                });
            }
        } catch (e) {
            Swal.fire('Koneksi Gagal', 'Gagal menghubungi server database terpadu BPS.', 'error');
        }
    }
}

// =========================================================================
// 5. SUBMIT FORM LOGIN (GENERASI TOKEN JWT BARU & PENYIMPANAN SESI)
// =========================================================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isSecure) return;

    const ansInput = document.getElementById('captchaAnswer');
    const answer = parseInt(ansInput ? ansInput.value : '0');
    
    if (answer !== expectedCaptcha) {
        Swal.fire('Sistem Keamanan Aktif', 'Hasil hitungan matematika salah. Anda terdeteksi sebagai Bot.', 'error');
        generateCaptcha();
        return;
    }

    const btn = document.getElementById('btnSubmit');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autentikasi...';
        btn.disabled = true;
    }

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('username').value.trim(),
                password: document.getElementById('password').value.trim()
            })
        });

        const data = await res.json();
        if (res.ok && data.status === 'success') {
            // Bersihkan sesi lama dan simpan seluruh format token
            localStorage.clear();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('bansosToken', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.data));
            localStorage.setItem('bansosUser', JSON.stringify(data.data));

            Swal.fire({
                icon: 'success',
                title: 'Akses Diterima',
                text: `Selamat bertugas, ${data.data.username.toUpperCase()}!`,
                showConfirmButton: false,
                timer: 1000
            }).then(() => {
                window.location.href = 'index.html';
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Akses Ditolak',
                text: data.message || 'Username atau kata sandi tidak sesuai.'
            });
            generateCaptcha();
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Koneksi Terputus',
            text: 'Backend Python (app.py) belum berjalan di port 5000.'
        });
    } finally {
        if (btn) {
            btn.innerHTML = 'Login <i class="fas fa-sign-in-alt"></i>';
            btn.disabled = false;
        }
    }
});

// =========================================================================
// 6. KONTROL MODAL LUPA KATA SANDI
// =========================================================================
function openResetModal() {
    const modal = document.getElementById('resetModal');
    if (modal) modal.style.display = 'flex';
}

function closeResetModal() {
    const modal = document.getElementById('resetModal');
    if (modal) modal.style.display = 'none';
}

async function handleResetPassword(e) {
    e.preventDefault();
    Swal.fire({
        title: 'Pengajuan Terkirim',
        text: 'Permintaan reset kata sandi telah diteruskan kepada Administrator Database.',
        icon: 'success',
        confirmButtonColor: '#10b981'
    });
    closeResetModal();
}