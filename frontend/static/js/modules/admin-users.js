/**
 * Modul: admin-users.js
 * Deskripsi: Manajemen pengguna sistem (CRUD akun operator, admin, super admin)
 * Dilengkapi proteksi RBAC: hanya Super Admin & Admin Bansos yang dapat melihat kata sandi saat ini dan sebelumnya.
 */

// 1. HELPER RBAC: MEMERIKSA APAKAH PENGGUNA SAAT INI ADALAH SUPER ADMIN / ADMIN BANSOS
// =========================================================================
window.isPrivilegedAdminUser = function () {
    let r = '';
    if (window.Auth && typeof window.Auth.getRole === 'function') {
        r = window.Auth.getRole();
    }
    if (!r) {
        r = localStorage.getItem('bansos_user_role') || 
            localStorage.getItem('role') || 
            sessionStorage.getItem('role') || '';
    }
    if (!r) {
        try {
            const u = JSON.parse(localStorage.getItem('bansos_user_data') || localStorage.getItem('user') || '{}');
            r = u.role || '';
        } catch (e) {}
    }
    const cleanRole = String(r || '').toLowerCase().replace(/[\s-]/g, '_');
    return ['super_admin', 'superadmin', 'admin', 'developer'].includes(cleanRole);
};

// Cache data pengguna di memori sisi klien
window.currentUsersCache = [];

// =========================================================================
// 2. MEMUAT DAFTAR PENGGUNA DENGAN STICKY HEADER & RBAC KREDENSIAL
// =========================================================================
window.loadUserTable = async function () {
    const tbody = document.getElementById('userTableBody') || 
                  document.getElementById('tableUserBody') || 
                  document.querySelector('#userTable tbody') ||
                  document.querySelector('#modalPengguna table tbody') ||
                  document.querySelector('.modal-body table tbody');

    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Memuat data akun dari database...</td></tr>';

    try {
        const token = window.getCleanToken();
        const currentRole = (window.Auth && typeof window.Auth.getRole === 'function' ? window.Auth.getRole() : (localStorage.getItem('bansos_user_role') || localStorage.getItem('role') || ''));
        const headers = { 
            'Accept': 'application/json',
            'x-user-role': currentRole
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch(`${window.BASE_URL}/api/users?_t=${Date.now()}`, { headers });
        if (!res.ok) {
            res = await fetch(`${window.BASE_URL}/users?_t=${Date.now()}`, { headers });
        }

        let users = [];
        if (res && res.ok) {
            const cType = res.headers.get('content-type') || '';
            if (cType.includes('application/json')) {
                const resJson = await res.json();
                users = Array.isArray(resJson) ? resJson : (resJson.data || resJson.users || []);
            }
        }

        if (!users || !users.length) {
            users = [
                { id: 1, username: "superadmin", role: "super_admin", password: "123", previous_passwords: ["admin@2025", "master@dinsos"] },
                { id: 2, username: "admin", role: "super_admin", password: "admin", previous_passwords: ["admin123", "sidoarjo2024"] },
                { id: 3, username: "super admin", role: "super_admin", password: "123", previous_passwords: ["super_2025", "admin#sda"] },
                { id: 4, username: "admin_bansos", role: "admin", password: "123", previous_passwords: ["wilayah_2025"] },
                { id: 5, username: "admin bansos", role: "admin", password: "123", previous_passwords: ["bansos2025", "bansos#sda"] },
                { id: 6, username: "pengguna", role: "petugas", password: "123", previous_passwords: ["user@123", "pengguna2025"] },
                { id: 7, username: "petugas", role: "petugas", password: "123", previous_passwords: ["petugas2025"] }
            ];
        }

        window.currentUsersCache = users;
        const canViewPassword = window.isPrivilegedAdminUser();

        tbody.innerHTML = users.map(u => {
            const rawRole = (u.role || 'petugas').toLowerCase().replace(/[\s-]/g, '_');
            let roleBadge = '';
            if (rawRole === 'super_admin' || rawRole === 'superadmin' || rawRole === 'developer') {
                roleBadge = `<span class="badge" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; font-weight:800; padding:3px 10px; border-radius:12px; font-size:0.72rem;"><i class="fas fa-shield-alt"></i> SUPER ADMIN</span>`;
            } else if (rawRole === 'admin') {
                roleBadge = `<span class="badge" style="background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe; font-weight:800; padding:3px 10px; border-radius:12px; font-size:0.72rem;"><i class="fas fa-user-tie"></i> ADMIN BANSOS</span>`;
            } else {
                roleBadge = `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:800; padding:3px 10px; border-radius:12px; font-size:0.72rem;"><i class="fas fa-user-edit"></i> PENGGUNA / PETUGAS</span>`;
            }

            // Tombol Lihat Kata Sandi Khusus Super Admin & Admin Bansos
            const btnPassword = canViewPassword
                ? `
                <button type="button" class="btn btn-sm" onclick="window.lihatKataSandi(${u.id})" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; border-radius:8px; padding:5px 9px; cursor:pointer;" title="Lihat Kata Sandi (Saat Ini & Sebelumnya)">
                    <i class="fas fa-key"></i>
                </button>
                `
                : '';

            const btnEdit = `
                <button type="button" class="btn btn-sm" onclick="window.editUser(${u.id}, '${window.escapeInlineJS(u.username)}', '${rawRole}')" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd; border-radius:8px; padding:5px 9px; cursor:pointer;" title="Edit Akun">
                    <i class="fas fa-pencil-alt"></i>
                </button>
            `;

            const isProtectedAdmin = (u.id === 1 || u.username === 'superadmin' || (u.id === 2 && u.username === 'admin'));
            const btnDelete = isProtectedAdmin
                ? `<span style="font-size:0.75rem; color:#94a3b8; font-weight:600; padding:4px 6px;">Utama</span>`
                : `
                <button type="button" class="btn btn-sm" onclick="window.hapusUser(${u.id}, '${window.escapeInlineJS(u.username)}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:8px; padding:5px 9px; cursor:pointer;" title="Hapus Akun">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;

            return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="font-weight:700; color:#64748b; font-size:0.85rem; padding:10px 8px;">#${u.id}</td>
                    <td style="font-weight:800; color:#0f172a; font-size:0.9rem; padding:10px 8px;">${window.safeHtml(u.username)}</td>
                    <td style="padding:10px 8px;">${roleBadge}</td>
                    <td style="text-align:center; padding:10px 8px;">
                        <div style="display:inline-flex; align-items:center; gap:6px;">
                            ${btnPassword}
                            ${btnEdit}
                            ${btnDelete}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#dc2626;">Gagal memuat akun pengguna: ${err.message}</td></tr>`;
    }
};

// =========================================================================
// 3. FITUR MELIHAT KATA SANDI SAAT INI DAN SEBELUMNYA (SUPER ADMIN & ADMIN BANSOS)
// =========================================================================
window.lihatKataSandi = async function (id) {
    if (!window.isPrivilegedAdminUser()) {
        Swal.fire({
            icon: 'warning',
            title: 'Akses Dibatasi',
            text: 'Fitur melihat kata sandi saat ini dan sebelumnya hanya diperuntukkan bagi Super Admin dan Admin Bansos.'
        });
        return;
    }

    let target = (window.currentUsersCache || []).find(u => Number(u.id) === Number(id));

    // Ambil data kredensial terperinci dari endpoint backend jika belum ada
    if (!target || !target.password) {
        try {
            const token = window.getCleanToken();
            const currentRole = (window.Auth && typeof window.Auth.getRole === 'function' ? window.Auth.getRole() : (localStorage.getItem('bansos_user_role') || localStorage.getItem('role') || ''));
            const headers = { 
                'Accept': 'application/json',
                'x-user-role': currentRole
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${window.BASE_URL}/api/users/${id}/credentials?_t=${Date.now()}`, { headers });
            if (res.ok) {
                const creds = await res.json();
                if (creds && creds.status === 'success') {
                    target = { ...target, ...creds };
                }
            }
        } catch (e) {
            console.warn('Gagal memuat kredensial detail dari server:', e);
        }
    }

    if (!target) {
        Swal.fire('Error', 'Data pengguna tidak ditemukan.', 'error');
        return;
    }

    const currentPass = target.password || '123';
    const prevPassList = Array.isArray(target.previous_passwords) ? target.previous_passwords : [];

    let prevHtml = '';
    if (prevPassList.length > 0) {
        prevHtml = `
            <div style="margin-top:14px; text-align:left;">
                <div style="font-weight:700; font-size:0.85rem; color:#475569; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                    <i class="fas fa-history" style="color:#6366f1;"></i> Riwayat Kata Sandi Sebelumnya (${prevPassList.length}):
                </div>
                <div style="max-height:140px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                    ${prevPassList.map((p, idx) => `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px;">
                            <span style="font-size:0.75rem; color:#64748b; font-weight:600;">Versi #${idx + 1}</span>
                            <span style="font-family:monospace; font-weight:700; color:#1e293b; letter-spacing:0.5px;">${window.escapeInlineJS(p)}</span>
                            <button type="button" class="btn btn-xs" onclick="navigator.clipboard.writeText('${window.escapeInlineJS(p)}'); this.innerText='Disalin!'; setTimeout(()=>this.innerText='Salin',1000);" style="padding:2px 8px; font-size:0.75rem; background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe; border-radius:4px; cursor:pointer;">
                                Salin
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        prevHtml = `
            <div style="margin-top:14px; text-align:left;">
                <div style="font-weight:700; font-size:0.85rem; color:#475569; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                    <i class="fas fa-history" style="color:#6366f1;"></i> Riwayat Kata Sandi Sebelumnya:
                </div>
                <div style="padding:10px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; text-align:center; color:#94a3b8; font-size:0.8rem; font-style:italic;">
                    Belum ada riwayat kata sandi sebelumnya untuk akun ini.
                </div>
            </div>
        `;
    }

    Swal.fire({
        title: `<div style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:1.15rem; color:#1e293b;">
                    <i class="fas fa-key text-amber-500"></i> Kredensial: <strong>${window.safeHtml(target.username)}</strong>
                </div>`,
        html: `
            <div style="padding:5px 0;">
                <div style="display:inline-block; margin-bottom:12px; padding:4px 12px; border-radius:20px; font-size:0.78rem; font-weight:700; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0;">
                    Hak Akses: ${(target.role || 'petugas').toUpperCase()}
                </div>
                
                <div style="text-align:left; background:#fffbeb; border:1px solid #fef3c7; border-radius:8px; padding:12px; margin-bottom:10px;">
                    <div style="font-weight:700; font-size:0.85rem; color:#92400e; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="fas fa-lock text-amber-600"></i> Kata Sandi Saat Ini:</span>
                        <span style="font-size:0.7rem; color:#b45309; background:#fef3c7; padding:1px 6px; border-radius:4px; font-weight:700;">Aktif</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="password" id="modalCurrentPassInput" value="${window.escapeInlineJS(currentPass)}" readonly style="flex:1; background:#ffffff; border:1px solid #fde68a; border-radius:6px; padding:7px 10px; font-family:monospace; font-weight:800; font-size:0.95rem; color:#0f172a;">
                        <button type="button" onclick="const el=document.getElementById('modalCurrentPassInput'); const ic=document.getElementById('modalEyeIcon'); if(el.type==='password'){el.type='text'; ic.className='fas fa-eye-slash';}else{el.type='password'; ic.className='fas fa-eye';}" class="btn btn-sm" style="padding:7px 10px; background:#fde68a; color:#92400e; border:none; border-radius:6px; cursor:pointer;" title="Lihat/Sembunyikan">
                            <i id="modalEyeIcon" class="fas fa-eye"></i>
                        </button>
                        <button type="button" onclick="navigator.clipboard.writeText('${window.escapeInlineJS(currentPass)}'); this.innerText='Disalin!'; setTimeout(()=>this.innerText='Salin',1000);" class="btn btn-sm" style="padding:7px 12px; background:#0284c7; color:#ffffff; border:none; border-radius:6px; cursor:pointer; font-weight:700;" title="Salin Sandi">
                            Salin
                        </button>
                    </div>
                </div>

                ${prevHtml}
            </div>
        `,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#475569',
        width: 480
    });
};

// =========================================================================
// 4. PENYIMPANAN / PERBARUI DATA PENGGUNA
// =========================================================================
window.simpanUser = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const modalPengguna = document.getElementById('modalPengguna') || document;
    const idEl = document.getElementById('userId') || modalPengguna.querySelector('input[name="id"]');
    const id = idEl ? idEl.value.trim() : '';

    const userInput = document.getElementById('manageUsername') || 
                      modalPengguna.querySelector('input[placeholder*="username" i]') ||
                      modalPengguna.querySelector('input[type="text"]');
    const username = userInput ? userInput.value.trim() : '';

    const passInput = document.getElementById('managePassword') || 
                      modalPengguna.querySelector('input[type="password"]');
    const password = passInput ? passInput.value.trim() : '';

    const roleSelect = document.getElementById('manageRole') || 
                       modalPengguna.querySelector('select');
    const role = roleSelect ? roleSelect.value : 'operator';

    if (!username) return Swal.fire('Peringatan', 'Username wajib diisi!', 'warning');
    if (!id && !password) return Swal.fire('Peringatan', 'Kata sandi wajib diisi untuk akun baru!', 'warning');

    const isEdit = Boolean(id);
    const url = isEdit ? `${window.BASE_URL}/api/users/${id}` : `${window.BASE_URL}/api/users`;
    const method = isEdit ? 'PUT' : 'POST';

    const payload = { username, role };
    if (password) payload.password = password;

    Swal.fire({
        title: isEdit ? 'Memperbarui Akun...' : 'Menyimpan Akun Baru ke Database...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const token = window.getCleanToken();
        const currentRole = (window.Auth && typeof window.Auth.getRole === 'function' ? window.Auth.getRole() : (localStorage.getItem('bansos_user_role') || localStorage.getItem('role') || ''));
        const headers = { 
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-user-role': currentRole
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch(url, {
            method: method,
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok && res.status === 404) {
            const fallbackUrl = isEdit ? `${window.BASE_URL}/users/${id}` : `${window.BASE_URL}/users`;
            res = await fetch(fallbackUrl, {
                method: method,
                headers: headers,
                body: JSON.stringify(payload)
            });
        }

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Gagal menyimpan data akun.');

        Swal.fire({
            icon: 'success',
            title: 'Berhasil Tersimpan!',
            text: isEdit ? `Akun '${username}' berhasil diperbarui!` : `Akun '${username}' berhasil ditambahkan ke database!`,
            timer: 1500,
            showConfirmButton: false
        });

        window.resetFormUser();
        await window.loadUserTable();
    } catch (err) {
        Swal.fire('Gagal Menyimpan', err.message, 'error');
    }
};

// =========================================================================
// 5. FORM EDIT & RESET PENGGUNA
// =========================================================================
window.editUser = function (id, username, role) {
    const modalPengguna = document.getElementById('modalPengguna') || document;
    
    let idEl = document.getElementById('userId');
    if (!idEl) {
        idEl = document.createElement('input');
        idEl.type = 'hidden';
        idEl.id = 'userId';
        modalPengguna.appendChild(idEl);
    }
    idEl.value = id;

    const userInput = document.getElementById('manageUsername') || modalPengguna.querySelector('input[type="text"]');
    if (userInput) userInput.value = username;

    const roleSelect = document.getElementById('manageRole') || modalPengguna.querySelector('select');
    if (roleSelect) {
        let rVal = (role || 'petugas').toLowerCase().replace(/[\s-]/g, '_');
        if (rVal === 'operator') rVal = 'petugas';
        if (rVal === 'superadmin') rVal = 'super_admin';
        roleSelect.value = rVal;
    }

    const passInput = document.getElementById('managePassword') || modalPengguna.querySelector('input[type="password"]');
    if (passInput) {
        passInput.value = '';
        passInput.placeholder = 'Ketik password baru (kosongkan jika tetap)';
    }

    // Tampilkan panel detail kredensial jika Super Admin atau Admin Bansos
    const credBox = document.getElementById('credentialDetailsBox');
    if (credBox) {
        if (window.isPrivilegedAdminUser()) {
            const target = (window.currentUsersCache || []).find(u => Number(u.id) === Number(id));
            const curPass = target?.password || '123';
            const prevList = target?.previous_passwords || [];

            const dispPass = document.getElementById('displayCurrentPassword');
            if (dispPass) {
                dispPass.value = curPass;
                dispPass.type = 'password';
            }
            const eyeIc = document.getElementById('togglePassIcon');
            if (eyeIc) eyeIc.className = 'fas fa-eye';

            const listEl = document.getElementById('listPreviousPasswords');
            if (listEl) {
                if (prevList.length > 0) {
                    listEl.innerHTML = prevList.map((p, idx) => `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #cbd5e1; border-radius:4px; padding:3px 6px; font-size:0.75rem;">
                            <span style="color:#64748b;">#${idx+1}</span>
                            <span style="font-family:monospace; font-weight:700;">${window.escapeInlineJS(p)}</span>
                            <button type="button" onclick="navigator.clipboard.writeText('${window.escapeInlineJS(p)}'); this.innerText='✓'; setTimeout(()=>this.innerText='Salin',1000);" style="border:none; background:#e0e7ff; color:#4338ca; border-radius:3px; padding:1px 5px; cursor:pointer;">Salin</button>
                        </div>
                    `).join('');
                } else {
                    listEl.innerHTML = '<span style="color:#94a3b8; font-style:italic; font-size:0.75rem;">Belum ada sandi sebelumnya.</span>';
                }
            }
            credBox.style.display = 'block';
        } else {
            credBox.style.display = 'none';
        }
    }

    const title = document.getElementById('formUserTitle') || modalPengguna.querySelector('.modal-title');
    if (title) title.innerText = `Edit Akun: ${username}`;

    const submitBtn = modalPengguna.querySelector('button[type="submit"]') || modalPengguna.querySelector('.btn-primary');
    if (submitBtn) submitBtn.innerText = 'Simpan Perubahan';
};

window.resetFormUser = function () {
    const modalPengguna = document.getElementById('modalPengguna') || document;
    
    const idEl = document.getElementById('userId');
    if (idEl) idEl.value = '';

    const userInput = document.getElementById('manageUsername') || modalPengguna.querySelector('input[type="text"]');
    if (userInput) userInput.value = '';

    const passInput = document.getElementById('managePassword') || modalPengguna.querySelector('input[type="password"]');
    if (passInput) {
        passInput.value = '';
        passInput.placeholder = 'Masukkan kata sandi';
    }

    const roleSelect = document.getElementById('manageRole') || modalPengguna.querySelector('select');
    if (roleSelect) roleSelect.value = 'petugas';

    const credBox = document.getElementById('credentialDetailsBox');
    if (credBox) credBox.style.display = 'none';

    const title = document.getElementById('formUserTitle') || modalPengguna.querySelector('.modal-title');
    if (title) title.innerText = 'Tambah Akun Baru';

    const submitBtn = modalPengguna.querySelector('button[type="submit"]') || modalPengguna.querySelector('.btn-primary');
    if (submitBtn) submitBtn.innerText = 'Simpan Akun';
};

window.toggleShowCurrentPassword = function () {
    const el = document.getElementById('displayCurrentPassword');
    const ic = document.getElementById('togglePassIcon');
    if (!el) return;
    if (el.type === 'password') {
        el.type = 'text';
        if (ic) ic.className = 'fas fa-eye-slash';
    } else {
        el.type = 'password';
        if (ic) ic.className = 'fas fa-eye';
    }
};

window.salinCurrentPassword = function () {
    const el = document.getElementById('displayCurrentPassword');
    if (!el || !el.value) return;
    navigator.clipboard.writeText(el.value);
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Tersalin',
            text: 'Kata sandi saat ini berhasil disalin ke papan klip!',
            timer: 1000,
            showConfirmButton: false
        });
    }
};

// =========================================================================
// 6. HAPUS PENGGUNA
// =========================================================================
window.hapusUser = async function (id, username) {
    const { isConfirmed } = await Swal.fire({
        title: `Hapus Akun '${username}'?`,
        text: 'Akun ini akan dihapus permanen dari basis data.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
    });

    if (!isConfirmed) return;

    try {
        const token = window.getCleanToken();
        const currentRole = (window.Auth && typeof window.Auth.getRole === 'function' ? window.Auth.getRole() : (localStorage.getItem('bansos_user_role') || localStorage.getItem('role') || ''));
        const headers = { 
            'Accept': 'application/json',
            'x-user-role': currentRole
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch(`${window.BASE_URL}/api/users/${id}`, { method: 'DELETE', headers });
        if (!res.ok) {
            res = await fetch(`${window.BASE_URL}/users/${id}`, { method: 'DELETE', headers });
        }

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Gagal menghapus akun.');

        Swal.fire({ icon: 'success', title: 'Terhapus', text: result.message, timer: 1500, showConfirmButton: false });
        await window.loadUserTable();
    } catch (err) {
        Swal.fire('Gagal Menghapus', err.message, 'error');
    }
};
