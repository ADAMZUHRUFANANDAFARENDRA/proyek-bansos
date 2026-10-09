/**
 * Modul: publik-diagnostic.js
 * Deskripsi: Gerbang Otorisasi & Pusat Diagnostik Eror Khusus Super Admin & Developer di Portal Warga
 * Memungkinkan Super Admin & Developer menindaklanjuti kendala teknis warga,
 * memverifikasi apakah benar terjadi eror, serta menganalisis akar penyebabnya (Root Cause Analysis).
 */

(function (window) {
    'use strict';

    // 1. STATE DIAGNOSTIK & LOG EROR
    const diagnosticState = {
        isAuthorized: false,
        currentUser: null,
        currentRole: null,
        systemHealth: {
            api: { status: 'checking', ping: 0, error: null },
            database: { status: 'checking', error: null },
            websocket: { status: 'checking', error: null },
            dukcapil: { status: 'checking', error: null },
            webrtc: { status: 'checking', error: null }
        },
        errorLogs: [],
        maxLogs: 50
    };

    // 2. INTERCEPTOR EROR GLOBAL (MENANGKAP SETIAP EROR SECARA REAL-TIME)
    function catatErorDiagnostik(source, message, details = {}) {
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
        const logEntry = {
            id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            timestamp,
            source: source || 'Sistem Portal',
            message: String(message || 'Unknown error occurred'),
            details,
            possibleCause: tentukanKemungkinanPenyebab(source, message, details)
        };

        diagnosticState.errorLogs.unshift(logEntry);
        if (diagnosticState.errorLogs.length > diagnosticState.maxLogs) {
            diagnosticState.errorLogs.pop();
        }

        updateErrorCounterUI();
        renderErrorLogsUI();
    }

    // Heuristik Analisis Akar Masalah (Root Cause Analysis Engine)
    function tentukanKemungkinanPenyebab(source, message, details) {
        const msg = String(message).toLowerCase();
        const det = JSON.stringify(details).toLowerCase();

        if (msg.includes('networkerror') || msg.includes('failed to fetch') || det.includes('failed to fetch')) {
            return 'Koneksi terputus ke peladen backend API atau port server (3000) sedang tidak merespons.';
        }
        if (msg.includes('403') || msg.includes('access_denied') || msg.includes('cyber_shield') || det.includes('waf')) {
            return 'Akses diblokir oleh Cyber Shield WAF atau otentikasi peran tidak mencukupi.';
        }
        if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('token')) {
            return 'Sesi token kedaluwarsa atau belum login sebagai akun yang sah.';
        }
        if (msg.includes('nik') && (msg.includes('16') || msg.includes('digit') || msg.includes('format'))) {
            return 'Validasi format NIK gagal (harus tepat 16 digit numerik wilayah Indonesia).';
        }
        if (msg.includes('webrtc') || msg.includes('peer') || msg.includes('getusermedia') || msg.includes('permission denied')) {
            return 'Izin perangkat (Kamera/Mikrofon) ditolak oleh peramban warga atau peramban tidak mendukung WebRTC.';
        }
        if (msg.includes('websocket') || msg.includes('closed') || msg.includes('connection refused')) {
            return 'Saluran sinyal WebSocket /ws/realtime belum terhubung atau port jaringan terblokir firewall.';
        }
        if (msg.includes('geocoding') || msg.includes('nominatim') || msg.includes('gps')) {
            return 'Layanan OpenStreetMap Nominatim mengalami pembatasan laju kueri (rate-limit) atau GPS dinonaktifkan di perangkat.';
        }
        return 'Terjadi galat eksekusi kode internal JavaScript atau format data payload tidak sesuai skema.';
    }

    // Pasang Global Exception & Rejection Listeners
    window.addEventListener('error', function (e) {
        catatErorDiagnostik('JavaScript Runtime Error', e.message, {
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno
        });
    });

    window.addEventListener('unhandledrejection', function (e) {
        catatErorDiagnostik('Unhandled Promise Rejection', e.reason?.message || String(e.reason), {
            stack: e.reason?.stack
        });
    });

    // Monkey-patch fetch untuk mengintersepsi network response yang gagal (4xx / 5xx)
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || 'unknown-url');
        try {
            const response = await originalFetch.apply(this, args);
            if (!response.ok && !url.includes('/api/ping') && !url.includes('/api/health')) {
                let errText = '';
                try {
                    const cloned = response.clone();
                    errText = await cloned.text();
                } catch (_) {}

                catatErorDiagnostik('HTTP Network Error', `Permintaan HTTP Gagal [${response.status}] pada ${url}`, {
                    url,
                    status: response.status,
                    statusText: response.statusText,
                    body: errText.slice(0, 300)
                });
            }
            return response;
        } catch (err) {
            catatErorDiagnostik('Network Fetch Failure', `Gagal menghubungkan permintaan ke ${url}: ${err.message}`, {
                url,
                error: err.message
            });
            throw err;
        }
    };

    // 3. PEMERIKSAAN OTORISASI PERAN SUPER ADMIN & DEVELOPER
    function periksaIzinAkses() {
        const role = (
            localStorage.getItem('role') ||
            localStorage.getItem('user_role') ||
            localStorage.getItem('bansos_user_role') ||
            ''
        ).toLowerCase().trim();

        let rawUser = null;
        try {
            rawUser = JSON.parse(localStorage.getItem('user') || '{}');
        } catch (_) {}

        const userRole = (rawUser?.role || role).toLowerCase().trim();
        const username = localStorage.getItem('username') || rawUser?.username || '';

        const isSuperAdminOrDev = (
            userRole === 'super_admin' ||
            userRole === 'superadmin' ||
            userRole === 'developer' ||
            userRole === 'dev' ||
            username.toLowerCase() === 'developer' ||
            username.toLowerCase() === 'superadmin'
        );

        diagnosticState.isAuthorized = isSuperAdminOrDev;
        diagnosticState.currentRole = userRole || (isSuperAdminOrDev ? 'developer' : 'tamu');
        diagnosticState.currentUser = username || (isSuperAdminOrDev ? 'Super Admin / Developer' : 'Pengguna Umum');

        const gateEl = document.getElementById('superAdminPortalGate');
        const panelEl = document.getElementById('panelDiagnostikDev');

        if (isSuperAdminOrDev) {
            // Pengguna sah: Buka portal & tampilkan panel diagnostik
            if (gateEl) gateEl.style.display = 'none';
            if (panelEl) panelEl.style.display = 'flex';
            
            const userLabel = document.getElementById('devAuthUser');
            if (userLabel) {
                userLabel.innerHTML = `<span class="text-emerald-400 font-bold">${diagnosticState.currentUser}</span> <span style="font-size:0.75rem; background:#334155; padding:2px 8px; border-radius:8px; margin-left:4px; text-transform:uppercase;">${diagnosticState.currentRole}</span>`;
            }

            // Jalankan cek diagnostik otomatis pertama kali
            jalankanDiagnostikSistem();
        } else {
            // Pengguna bukan Super Admin / Developer: Kunci akses portal secara mutlak
            if (gateEl) gateEl.style.display = 'flex';
            if (panelEl) panelEl.style.display = 'none';
        }
    }

    // 4. LOGIN CEPAT DARI GERBANG OTORISASI PORTAL
    async function loginDariGateDiagnostik(event) {
        if (event && event.preventDefault) event.preventDefault();

        const uInput = document.getElementById('gateUsername');
        const pInput = document.getElementById('gatePassword');
        const btnLogin = document.getElementById('btnGateLogin');
        const msgEl = document.getElementById('gateLoginMsg');

        const username = uInput?.value.trim() || '';
        const password = pInput?.value.trim() || '';

        if (!username || !password) {
            if (msgEl) {
                msgEl.style.display = 'block';
                msgEl.innerHTML = '<span class="text-red-400"><i class="fas fa-exclamation-circle"></i> Harap masukkan nama pengguna dan kata sandi.</span>';
            }
            return;
        }

        if (btnLogin) {
            btnLogin.disabled = true;
            btnLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memverifikasi Otoritas...';
        }
        if (msgEl) msgEl.style.display = 'none';

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok || data.status !== 'success') {
                throw new Error(data.message || 'Kredensial tidak valid.');
            }

            const role = (data.user?.role || '').toLowerCase();
            const isAllowed = (role === 'super_admin' || role === 'superadmin' || role === 'developer');

            if (!isAllowed) {
                if (msgEl) {
                    msgEl.style.display = 'block';
                    msgEl.innerHTML = `<span class="text-amber-400"><i class="fas fa-ban"></i> Akun Anda memiliki peran <b>${data.user?.role || 'Staff'}</b>. Portal Warga hanya dapat diakses oleh <b>Super Admin</b> atau <b>Developer</b>.</span>`;
                }
                if (btnLogin) {
                    btnLogin.disabled = false;
                    btnLogin.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk Mode Diagnostik';
                }
                return;
            }

            // Simpan sesi sah
            localStorage.setItem('token', data.token);
            localStorage.setItem('access_token', data.token);
            localStorage.setItem('role', role);
            localStorage.setItem('user_role', role);
            localStorage.setItem('bansos_user_role', role);
            localStorage.setItem('username', data.user.username);
            localStorage.setItem('user', JSON.stringify(data.user));

            if (msgEl) {
                msgEl.style.display = 'block';
                msgEl.innerHTML = '<span class="text-emerald-400"><i class="fas fa-check-circle"></i> Otorisasi berhasil. Membuka Portal Warga...</span>';
            }

            setTimeout(() => {
                periksaIzinAkses();
                if (window.Swal) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Akses Diagnostik Diberikan',
                        text: `Selamat datang, ${data.user.nama_lengkap || data.user.username}. Anda berada di Mode Pengujian & Investigasi Eror Portal Warga.`,
                        timer: 2500,
                        showConfirmButton: false
                    });
                }
            }, 500);

        } catch (err) {
            if (msgEl) {
                msgEl.style.display = 'block';
                msgEl.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle"></i> ${err.message}</span>`;
            }
        } finally {
            if (btnLogin) {
                btnLogin.disabled = false;
                btnLogin.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk Mode Diagnostik';
            }
        }
    }

    // 5. PENGECEKAN KESEHATAN SISTEM MENYELURUH (SYSTEM HEALTH DIAGNOSTIC)
    async function jalankanDiagnostikSistem() {
        const statusPillApi = document.getElementById('devApiStatusPill');
        const statusPillWs = document.getElementById('devWsStatusPill');

        if (statusPillApi) statusPillApi.innerHTML = '<i class="fas fa-spinner fa-spin text-amber-400"></i> Memeriksa API...';
        if (statusPillWs) statusPillWs.innerHTML = '<i class="fas fa-spinner fa-spin text-amber-400"></i> Memeriksa WS...';

        // 1. Cek Backend API Server
        const tStart = performance.now();
        try {
            const apiRes = await fetch('/api/health');
            const tEnd = performance.now();
            const latency = Math.round(tEnd - tStart);

            if (apiRes.ok) {
                diagnosticState.systemHealth.api = { status: 'healthy', ping: latency, error: null };
                if (statusPillApi) statusPillApi.innerHTML = `<span class="text-emerald-400"><i class="fas fa-check-circle"></i> API: OK (${latency}ms)</span>`;
            } else {
                throw new Error(`HTTP ${apiRes.status}`);
            }
        } catch (err) {
            diagnosticState.systemHealth.api = { status: 'error', ping: 0, error: err.message };
            if (statusPillApi) statusPillApi.innerHTML = `<span class="text-red-400"><i class="fas fa-exclamation-triangle"></i> API: Eror</span>`;
            catatErorDiagnostik('Health Check API', `Pemeriksaan kesehatan API peladen gagal: ${err.message}`);
        }

        // 2. Cek Basis Data & Model SPK
        try {
            const dbRes = await fetch('/api/spk/kriteria');
            if (dbRes.ok) {
                diagnosticState.systemHealth.database = { status: 'healthy', error: null };
            } else {
                throw new Error(`HTTP ${dbRes.status}`);
            }
        } catch (err) {
            diagnosticState.systemHealth.database = { status: 'error', error: err.message };
            catatErorDiagnostik('Health Check Database', `Integritas query basis data gagal: ${err.message}`);
        }

        // 3. Cek WebSocket Realtime Hub
        const wsAvailable = (window.RealtimeHub && window.RealtimeHub.isConnected && window.RealtimeHub.isConnected()) ||
                            (window.RealtimeClient && window.RealtimeClient.isConnected);
        
        if (wsAvailable) {
            diagnosticState.systemHealth.websocket = { status: 'connected', error: null };
            if (statusPillWs) statusPillWs.innerHTML = `<span class="text-emerald-400"><i class="fas fa-link"></i> WS: Terhubung</span>`;
        } else {
            // Coba ping sse / stream
            try {
                const sseRes = await fetch('/api/realtime/recent').catch(() => null);
                if (sseRes && sseRes.ok) {
                    diagnosticState.systemHealth.websocket = { status: 'standby', error: null };
                    if (statusPillWs) statusPillWs.innerHTML = `<span class="text-emerald-300"><i class="fas fa-stream"></i> Realtime: Standby</span>`;
                } else {
                    diagnosticState.systemHealth.websocket = { status: 'disconnected', error: 'WebSocket belum tersambung' };
                    if (statusPillWs) statusPillWs.innerHTML = `<span class="text-amber-400"><i class="fas fa-unlink"></i> WS: Menghubungkan</span>`;
                }
            } catch (_) {
                if (statusPillWs) statusPillWs.innerHTML = `<span class="text-amber-400"><i class="fas fa-unlink"></i> WS: Terputus</span>`;
            }
        }

        // 4. Cek Dukcapil Gateway
        try {
            const dukRes = await fetch('/api/dukcapil/status').catch(() => null);
            if (dukRes && dukRes.ok) {
                diagnosticState.systemHealth.dukcapil = { status: 'ready', error: null };
            } else {
                diagnosticState.systemHealth.dukcapil = { status: 'simulated', error: null };
            }
        } catch (_) {}

        // Render hasil ke tabel diagnostik modal jika modal sedang terbuka
        renderModalHealthTable();
    }

    // 6. UI MODAL DIAGNOSTIK & INVESTIGASI
    function bukaModalDiagnostik() {
        const modal = document.getElementById('modalDiagnostikEror');
        if (modal) {
            modal.style.display = 'flex';
            jalankanDiagnostikSistem();
            renderErrorLogsUI();
        }
    }

    function tutupModalDiagnostik() {
        const modal = document.getElementById('modalDiagnostikEror');
        if (modal) modal.style.display = 'none';
    }

    function updateErrorCounterUI() {
        const counterPill = document.getElementById('devErrorCounter');
        if (!counterPill) return;

        const count = diagnosticState.errorLogs.length;
        if (count === 0) {
            counterPill.className = 'badge-counter-clean';
            counterPill.innerHTML = '<i class="fas fa-shield-alt text-emerald-400"></i> 0 Eror Terdeteksi';
        } else {
            counterPill.className = 'badge-counter-alert';
            counterPill.innerHTML = `<i class="fas fa-exclamation-circle text-red-400"></i> ${count} Eror Tercatat`;
        }
    }

    function renderModalHealthTable() {
        const container = document.getElementById('devHealthTableBody');
        if (!container) return;

        const h = diagnosticState.systemHealth;
        const items = [
            {
                name: 'Server Backend API & WAF Shield',
                desc: 'Menguji respons /api/health dan inspeksi Cyber Shield',
                status: h.api.status === 'healthy' ? 'NORMAL' : 'EROR',
                class: h.api.status === 'healthy' ? 'status-ok' : 'status-err',
                detail: h.api.status === 'healthy' ? `Latency: ${h.api.ping}ms` : (h.api.error || 'Gagal merespons')
            },
            {
                name: 'Basis Data SPK & Storage Warga',
                desc: 'Integritas pembacaan master data & kriteria bansos',
                status: h.database.status === 'healthy' ? 'NORMAL' : 'EROR',
                class: h.database.status === 'healthy' ? 'status-ok' : 'status-err',
                detail: h.database.status === 'healthy' ? 'Siap Baca/Tulis' : (h.database.error || 'Koneksi gagal')
            },
            {
                name: 'Kanal Realtime WebSocket & SSE',
                desc: 'Sinkronisasi notifikasi aduan dan sinyal WebRTC',
                status: (h.websocket.status === 'connected' || h.websocket.status === 'standby') ? 'AKTIF' : 'TERPUTUS',
                class: (h.websocket.status === 'connected' || h.websocket.status === 'standby') ? 'status-ok' : 'status-warn',
                detail: (h.websocket.status === 'connected' || h.websocket.status === 'standby') ? 'Kanal Terbuka' : 'Tidak terhubung'
            },
            {
                name: 'Sub-sistem Audio / Video WebRTC',
                desc: 'Kesiapan perangkat panggilan mediasi jarak jauh',
                status: navigator.mediaDevices ? 'DIDUKUNG' : 'TIDAK DIDUKUNG',
                class: navigator.mediaDevices ? 'status-ok' : 'status-err',
                detail: navigator.mediaDevices ? 'Browser WebRTC Ready' : 'Peramban usang / tidak aman'
            }
        ];

        container.innerHTML = items.map(it => `
            <tr style="border-bottom:1px solid #1e293b;">
                <td style="padding:10px 14px; font-weight:600; color:#f8fafc;">
                    ${it.name}<br>
                    <span style="font-size:0.75rem; color:#94a3b8; font-weight:400;">${it.desc}</span>
                </td>
                <td style="padding:10px 14px;">
                    <span class="${it.class}">${it.status}</span>
                </td>
                <td style="padding:10px 14px; font-size:0.82rem; color:#cbd5e1; font-family:'JetBrains Mono', monospace;">
                    ${it.detail}
                </td>
            </tr>
        `).join('');
    }

    function renderErrorLogsUI() {
        const listEl = document.getElementById('devErrorLogsList');
        if (!listEl) return;

        if (diagnosticState.errorLogs.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center; padding:35px 20px; color:#64748b;">
                    <i class="fas fa-check-circle" style="font-size:2.4rem; color:#10b981; margin-bottom:10px;"></i>
                    <div style="font-weight:700; color:#e2e8f0; font-size:1rem;">Tidak Ada Eror Terdeteksi</div>
                    <div style="font-size:0.82rem; max-width:400px; margin:6px auto 0;">Seluruh modul Portal Warga beroperasi secara normal tanpa anomali JavaScript atau kegagalan jaringan HTTP.</div>
                </div>
            `;
            return;
        }

        listEl.innerHTML = diagnosticState.errorLogs.map(log => `
            <div class="error-log-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span class="error-tag-source"><i class="fas fa-bug"></i> ${log.source}</span>
                    <span style="font-size:0.75rem; color:#94a3b8; font-family:'JetBrains Mono', monospace;">${log.timestamp}</span>
                </div>
                <div style="font-size:0.86rem; color:#fca5a5; font-weight:700; margin-bottom:6px; word-break:break-word;">
                    ${log.message}
                </div>
                <div class="error-cause-box">
                    <i class="fas fa-lightbulb text-amber-400"></i> <b>Analisis Penyebab:</b> ${log.possibleCause}
                </div>
                ${Object.keys(log.details || {}).length > 0 ? `
                    <div style="margin-top:6px; background:#080d1a; padding:8px 10px; border-radius:8px; font-family:'JetBrains Mono', monospace; font-size:0.75rem; color:#94a3b8; overflow-x:auto;">
                        <pre style="margin:0; white-space:pre-wrap;">${JSON.stringify(log.details, null, 2)}</pre>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    function salinLogEror() {
        const text = JSON.stringify(diagnosticState.errorLogs, null, 2);
        navigator.clipboard.writeText(text).then(() => {
            if (window.Swal) {
                Swal.fire({
                    icon: 'success',
                    title: 'Log Eror Disalin',
                    text: 'Seluruh riwayat eror diagnostik telah disalin ke papan klip untuk analisis tim developer.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                alert('Log eror telah disalin ke clipboard.');
            }
        });
    }

    function bersihkanLogEror() {
        diagnosticState.errorLogs = [];
        updateErrorCounterUI();
        renderErrorLogsUI();
    }

    // 7. SIMULASI KASUS & UJI COBA CEPAT (TEST BENCH)
    async function ujiCobaLacakNikDev() {
        const nikInput = document.getElementById('devTestNikInput');
        const resBox = document.getElementById('devTestResultBox');
        const nik = (nikInput?.value || '').trim();

        if (!nik) {
            alert('Masukkan NIK yang ingin diuji.');
            return;
        }

        if (resBox) resBox.innerHTML = '<span class="text-amber-400"><i class="fas fa-spinner fa-spin"></i> Menjalankan simulasi lacak NIK ke server...</span>';

        const t0 = performance.now();
        try {
            const res = await fetch(`/api/publik/cek-bansos?nik=${encodeURIComponent(nik)}`);
            const t1 = performance.now();
            const latency = Math.round(t1 - t0);
            const json = await res.json();

            if (res.ok && json.status === 'success') {
                if (resBox) {
                    resBox.innerHTML = `
                        <div style="color:#10b981; font-weight:700;"><i class="fas fa-check-circle"></i> Berhasil Ditemukan (${latency}ms)</div>
                        <div style="color:#cbd5e1; margin-top:4px;">NIK terdaftar atas nama: <b>${json.data?.nama || 'Warga'}</b></div>
                        <div style="color:#94a3b8; font-size:0.78rem;">Desil: ${json.data?.desil || '-'} | Status: ${json.data?.status_salur || '-'}</div>
                    `;
                }
            } else {
                if (resBox) {
                    resBox.innerHTML = `
                        <div style="color:#f59e0b; font-weight:700;"><i class="fas fa-info-circle"></i> Hasil Server [${res.status}] (${latency}ms)</div>
                        <div style="color:#cbd5e1; margin-top:4px;">${json.message || 'NIK tidak ditemukan di pangkalan data.'}</div>
                    `;
                }
            }
        } catch (err) {
            if (resBox) {
                resBox.innerHTML = `
                    <div style="color:#ef4444; font-weight:700;"><i class="fas fa-times-circle"></i> Terjadi Eror Permintaan</div>
                    <div style="color:#fca5a5; margin-top:4px;">${err.message}</div>
                `;
            }
        }
    }

    function keluarModeDiagnostik() {
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('role');
        localStorage.removeItem('user_role');
        localStorage.removeItem('bansos_user_role');
        localStorage.removeItem('username');
        localStorage.removeItem('user');
        window.location.reload();
    }

    // 8. EKSPOS GLOBAL KE WINDOW
    window.PublikDiagnostic = {
        checkAccess: periksaIzinAkses,
        loginFromGate: loginDariGateDiagnostik,
        runDiagnostic: jalankanDiagnostikSistem,
        openModal: bukaModalDiagnostik,
        closeModal: tutupModalDiagnostik,
        copyLogs: salinLogEror,
        clearLogs: bersihkanLogEror,
        testNik: ujiCobaLacakNikDev,
        logout: keluarModeDiagnostik,
        logError: catatErorDiagnostik
    };

    // Jalankan pengecekan otorisasi saat DOM siap
    document.addEventListener('DOMContentLoaded', () => {
        periksaIzinAkses();
    });

})(window);
