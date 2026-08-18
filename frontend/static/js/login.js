const API_URL = "http://127.0.0.1:5000";
let expectedCaptcha = 0;
let isSecure = false;

localStorage.clear(); // Hapus token lama saat masuk ke halaman login

window.onload = () => {
    fetch(`${API_URL}/init-kriteria`, { method: 'GET' }).catch(e => console.log(e));
    setTimeout(() => {
        document.getElementById('cf-spinner').style.display = 'none';
        document.getElementById('cf-success').style.display = 'block';
        document.getElementById('cf-text').innerText = 'Koneksi terenkripsi (Aman).';
        
        document.getElementById('captchaBox').style.display = 'flex';
        generateCaptcha();
        
        const btn = document.getElementById('btnSubmit');
        btn.disabled = false;
        btn.innerHTML = 'Masuk Dashboard <i class="fas fa-sign-in-alt"></i>';
        isSecure = true;
    }, 1500);
};

// FUNGSI TUR INTERAKTIF LOGIN
async function mulaiTurLogin() {
    const steps = [
        {
            title: 'Selamat Datang di Sistem Bansos',
            html: '<span style="font-size:1.05rem; color:#475569;">Halaman yang sedang Anda buka ini <b>KHUSUS untuk Pegawai/Admin</b> Dinas Sosial.</span>',
            icon: 'info',
            confirmButtonText: 'Lanjut <i class="fas fa-arrow-right"></i>'
        },
        {
            title: 'Saya Warga, Bagaimana Cara Login?',
            html: '<span style="font-size:1.05rem; color:#475569;">Warga <b>TIDAK</b> login di sini. Silakan klik tombol putih <b>"Portal Warga"</b> di pojok kanan atas. Di sana, Anda cukup memasukkan 16 Digit NIK Anda sebagai kunci masuk ke Dashboard Anda.</span>',
            icon: 'question',
            confirmButtonText: 'Paham <i class="fas fa-arrow-right"></i>'
        },
        {
            title: 'Fitur Cek BPS Cepat',
            html: '<span style="font-size:1.05rem; color:#475569;">Untuk petugas lapangan, Anda bisa langsung mengecek NIK warga apakah terdaftar di BPS Pusat dengan mengklik <b>Tombol Lingkaran Biru</b> di sudut kanan bawah tanpa perlu login.</span>',
            icon: 'success',
            confirmButtonText: 'Tutup Panduan <i class="fas fa-check"></i>'
        }
    ];
    
    for(let i=0; i<steps.length; i++) {
        await Swal.fire({
            title: steps[i].title,
            html: steps[i].html,
            icon: steps[i].icon,
            confirmButtonText: steps[i].confirmButtonText,
            confirmButtonColor: 'var(--primary)'
        });
    }
}

function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    expectedCaptcha = num1 + num2;
    document.getElementById('captchaQuestion').innerText = `${num1} + ${num2} =`;
    document.getElementById('captchaAnswer').value = '';
}

function togglePassword(inputId, iconId) {
    const pwd = document.getElementById(inputId);
    const eye = document.getElementById(iconId);
    if (pwd.type === 'password') { pwd.type = 'text'; eye.className = 'fas fa-eye-slash'; } 
    else { pwd.type = 'password'; eye.className = 'fas fa-eye'; }
}

// FUNGSI POP-UP CEK DATA BPS
function cekDataBPS() {
    Swal.fire({
        title: '<i class="fas fa-database text-info"></i> Verifikasi Cepat BPS',
        html: '<span style="font-size:0.95rem; color:#64748b;">Silakan masukkan 16 Digit NIK yang ingin Anda sinkronkan dengan database pusat.</span>',
        input: 'number',
        inputAttributes: { maxlength: 16 },
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-search"></i> Pindai NIK',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#94a3b8'
    }).then((result) => {
        if(result.isConfirmed) {
            const nik = result.value;
            if(!nik || nik.length !== 16) return Swal.fire('Tidak Valid', 'Harap masukkan tepat 16 digit NIK.', 'warning');
            
            Swal.fire({title: 'Memindai Server BPS...', didOpen: () => Swal.showLoading()});
            
            setTimeout(() => {
                if(nik.startsWith('351501') || nik.startsWith('351502')) {
                    Swal.fire('Data Ditemukan!', 'NIK tercatat dalam basis data warga prasejahtera BPS Pusat.', 'success');
                } else {
                    Swal.fire('Belum Tercatat', 'NIK ini belum terdaftar di data BPS.', 'info');
                }
            }, 1500);
        }
    });
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!isSecure) return;

    const answer = parseInt(document.getElementById('captchaAnswer').value);
    if(answer !== expectedCaptcha) {
        Swal.fire('Sistem Keamanan Aktif', 'Jawaban hitungan matematika salah. Anda terdeteksi sebagai Bot.', 'error');
        generateCaptcha(); return;
    }

    const btn = document.getElementById('btnSubmit');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autentikasi...'; btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: document.getElementById('username').value.trim(), password: document.getElementById('password').value.trim() })
        });
        
        const data = await res.json();
        if(res.ok && data.status === 'success') {
            localStorage.setItem('bansosToken', data.access_token);
            localStorage.setItem('bansosUser', JSON.stringify(data.data));
            window.location.href = 'index.html';
        } else {
            Swal.fire({icon: 'error', title: 'Akses Ditolak', text: data.message});
            generateCaptcha();
        }
    } catch(err) { Swal.fire({icon: 'error', title: 'Koneksi Terputus', text: 'Backend Python (app.py) belum berjalan.'}); } 
    finally { btn.innerHTML = 'Masuk Dashboard <i class="fas fa-sign-in-alt"></i>'; btn.disabled = false; }
});

// KONTROL TAMPILAN MODAL LUPA SANDI
function openResetModal() { document.getElementById('resetModal').style.display = 'flex'; }
function closeResetModal() { document.getElementById('resetModal').style.display = 'none'; }

async function resetPassword(e) {
    e.preventDefault();
    const payload = { username: document.getElementById('resetUser').value, recovery_code: document.getElementById('resetCode').value, new_password: document.getElementById('resetNewPass').value };
    Swal.fire({title: 'Memeriksa Otorisasi...', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch(`${API_URL}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if(res.ok) { Swal.fire('Berhasil!', data.message, 'success'); closeResetModal(); e.target.reset(); } 
        else { Swal.fire('Ditolak', data.message, 'error'); }
    } catch(e) { Swal.fire('Error', 'Gagal menyambung ke peladen.', 'error'); }
}