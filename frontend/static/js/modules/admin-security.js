/**
 * MODUL PUSAT KEAMANAN SIBER & DETEKSI SERANGAN (SIDOARJO CYBER SHIELD WAF & IDS)
 * Pemerintah Kabupaten Sidoarjo - Dinas Sosial
 * Khusus: SUPER ADMINISTRATOR & DEVELOPER
 *
 * Menangani & Memitigasi 6 Kategori Model Serangan Siber:
 * 1. Kategori Berbasis Malware (Virus, Worm, Trojan, Ransomware, Spyware & Keyloggers, Adware, Rootkit, Fileless Malware)
 * 2. Kategori Rekayasa Sosial (Phishing, Spear Phishing, Whaling, Smishing & Vishing, Deepfake/AI Voice Scam, Baiting)
 * 3. Kategori Serangan Jaringan & Lalu Lintas Data (DoS & DDoS, AitM/MitM, Spoofing, Eavesdropping/Sniffing, Session Hijacking)
 * 4. Kategori Eksploitasi Aplikasi & Web (SQL Injection, XSS, Clickjacking, Zero-Day Exploits)
 * 5. Kategori Pembongkaran Kredensial & Sandi (Brute Force, Credential Stuffing, Password Spraying)
 * 6. Kategori Infrastruktur & Ancaman Khusus (Supply Chain, Insider Threat, Cryptojacking, Watering Hole, IoT Attacks)
 */

(function () {
    let securityPollingInterval = null;

    // Helper Autentikasi Header Super Admin
    function getSecurityHeaders() {
        const token = window.getCleanToken ? window.getCleanToken() : (localStorage.getItem('token') || '');
        const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    // Periksa Hak Akses Super Admin
    function isSuperAdminUser() {
        const role = (
            localStorage.getItem('role') || 
            localStorage.getItem('user_role') || 
            ''
        ).toLowerCase().replace(/[\s-]/g, '_');
        return role === 'super_admin' || role === 'superadmin' || role === 'developer';
    }

    // Buka Modal Pusat Keamanan Siber
    window.bukaModalKeamananSiber = async function () {
        // 1. Verifikasi Ketat: Hanya Super Admin / Developer yang dapat membuka
        if (!isSuperAdminUser()) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Akses Ditolak!',
                    html: `
                        <div style="text-align:left; font-size:0.88rem; line-height:1.5;">
                            Fitur <b>Cyber Shield WAF & IDS</b> serta alat keamanan developer hanya dapat diakses oleh akun berkategori <b>Super Admin</b>.<br><br>
                            Kategori petugas bansos terbagi 3:<br>
                            1. <b>Super Admin</b>: Akses Penuh Sistem & Keamanan Siber.<br>
                            2. <b>Admin</b>: Administrator Bansos Operasional.<br>
                            3. <b>Petugas</b>: Petugas Verifikasi Lapangan.<br><br>
                            <span style="color:#dc2626; font-weight:700;">Peran akun Anda saat ini tidak memiliki otorisasi keamanan tinggi ini.</span>
                        </div>
                    `,
                    confirmButtonColor: '#dc2626'
                });
            } else {
                alert('Akses Ditolak: Hanya Super Admin / Developer yang dapat mengakses Cyber Shield.');
            }
            return;
        }

        let modal = document.getElementById('modalKeamananSiber');
        if (!modal) {
            createSecurityModalElement();
            modal = document.getElementById('modalKeamananSiber');
        }
        modal.style.display = 'flex';
        await window.muatStatistikKeamanan();
        await window.muatDaftarSerangan();

        // Mulai pembaruan otomatis setiap 5 detik saat modal terbuka
        if (!securityPollingInterval) {
            securityPollingInterval = setInterval(() => {
                const el = document.getElementById('modalKeamananSiber');
                if (el && el.style.display !== 'none') {
                    window.muatStatistikKeamanan(true);
                    window.muatDaftarSerangan(true);
                } else {
                    clearInterval(securityPollingInterval);
                    securityPollingInterval = null;
                }
            }, 5000);
        }
    };

    window.tutupModalKeamananSiber = function () {
        const modal = document.getElementById('modalKeamananSiber');
        if (modal) modal.style.display = 'none';
        if (securityPollingInterval) {
            clearInterval(securityPollingInterval);
            securityPollingInterval = null;
        }
    };

    // Muat Statistik Keamanan Real-Time
    window.muatStatistikKeamanan = async function (silent = false) {
        try {
            const res = await fetch('/api/security/stats', { headers: getSecurityHeaders() });
            if (res.status === 401 || res.status === 403) {
                if (!silent && typeof Swal !== 'undefined') {
                    Swal.fire('Otorisasi Diperlukan', 'Sesi Super Admin Anda kedaluwarsa atau peran tidak berwenang.', 'warning');
                }
                return;
            }
            if (!res.ok) throw new Error('Gagal menghubungi Cyber Shield Guard');
            const data = await res.json();

            // Perbarui Badge Status Navbar
            const navBadge = document.getElementById('navWafBadge');
            if (navBadge) {
                if (data.threat_status.total_blocked > 0) {
                    navBadge.style.display = 'inline-block';
                    navBadge.innerText = data.threat_status.total_blocked;
                } else {
                    navBadge.style.display = 'none';
                }
            }

            // Perbarui Kartu Metrik di Modal
            const elTotalBlocked = document.getElementById('secTotalBlocked');
            if (elTotalBlocked) elTotalBlocked.innerText = data.threat_status.total_blocked;

            const elTotalInspected = document.getElementById('secTotalInspected');
            if (elTotalInspected) elTotalInspected.innerText = data.threat_status.total_inspected;

            const elQuarantinedIps = document.getElementById('secQuarantinedIps');
            if (elQuarantinedIps) elQuarantinedIps.innerText = data.threat_status.active_quarantined_ips;

            const elStatusPill = document.getElementById('secStatusPill');
            if (elStatusPill) {
                elStatusPill.style.background = data.threat_status.status_color + '22';
                elStatusPill.style.borderColor = data.threat_status.status_color;
                elStatusPill.style.color = data.threat_status.status_color;
                elStatusPill.innerHTML = `<span class="pulse-dot" style="background:${data.threat_status.status_color};"></span> ${data.threat_status.status_label}`;
            }

            // Metrik 6 Kategori
            const cats = data.categories_breakdown || {};
            const catElMap = {
                'secCatCount_MALWARE': cats.MALWARE_THREAT || 0,
                'secCatCount_SOCIAL': cats.SOCIAL_ENGINEERING || 0,
                'secCatCount_NETWORK': cats.NETWORK_TRAFFIC || 0,
                'secCatCount_WEB': cats.WEB_EXPLOITATION || 0,
                'secCatCount_CREDENTIAL': cats.CREDENTIAL_ATTACK || 0,
                'secCatCount_INFRA': cats.INFRASTRUCTURE_THREAT || 0
            };
            Object.keys(catElMap).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = catElMap[id];
            });

        } catch (e) {
            if (!silent) console.warn('[Security] Kendala memuat statistik WAF:', e);
        }
    };

    // Muat Riwayat Log Serangan
    window.muatDaftarSerangan = async function (silent = false) {
        const tbody = document.getElementById('secAttackLogTbody');
        if (!tbody) return;

        try {
            const res = await fetch('/api/security/attacks?limit=60', { headers: getSecurityHeaders() });
            if (!res.ok) throw new Error('Gagal mengambil audit log serangan');
            const data = await res.json();
            const incidents = data.incidents || [];

            if (incidents.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align:center; padding:35px 20px; color:#64748b;">
                            <i class="fas fa-shield-alt" style="font-size:2.2rem; color:#10b981; margin-bottom:8px; display:block;"></i>
                            <strong style="color:#0f172a; font-size:0.95rem;">Sistem Bersih & Aman</strong>
                            <div style="font-size:0.8rem; margin-top:4px;">Belum ada riwayat serangan siber yang terdeteksi pada sesi pemantauan ini.</div>
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = incidents.map(inc => {
                let badgeLevelColor = '#3b82f6';
                let badgeLevelBg = '#eff6ff';
                if (inc.threat_level === 'CRITICAL') {
                    badgeLevelColor = '#dc2626';
                    badgeLevelBg = '#fee2e2';
                } else if (inc.threat_level === 'HIGH') {
                    badgeLevelColor = '#ea580c';
                    badgeLevelBg = '#ffedd5';
                } else if (inc.threat_level === 'MEDIUM') {
                    badgeLevelColor = '#d97706';
                    badgeLevelBg = '#fef3c7';
                }

                const timeStr = formatIncidentTime(inc.timestamp);
                const safePayload = escapeHtml(inc.payload_sample || '-');
                const catName = getCategoryLabel(inc.attack_category);

                return `
                    <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding:10px 12px; font-size:0.76rem; font-family:monospace; color:#475569; white-space:nowrap;">
                            ${timeStr}
                        </td>
                        <td style="padding:10px 12px; font-size:0.8rem; font-weight:700; color:#0f172a; white-space:nowrap;">
                            <span style="font-family:monospace; background:#f1f5f9; padding:2px 6px; border-radius:6px; border:1px solid #e2e8f0;">${escapeHtml(inc.ip)}</span>
                        </td>
                        <td style="padding:10px 12px; font-size:0.78rem; font-weight:700; color:#0f172a; white-space:nowrap;">
                            <span style="font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; background:#f1f5f9; color:#334155; margin-right:4px;">
                                ${escapeHtml(catName)}
                            </span>
                            <i class="${getAttackIcon(inc.attack_type)}" style="margin-right:4px;"></i>
                            ${escapeHtml(formatAttackName(inc.attack_type))}
                        </td>
                        <td style="padding:10px 12px; text-align:center; white-space:nowrap;">
                            <span style="background:${badgeLevelBg}; color:${badgeLevelColor}; font-weight:800; font-size:0.7rem; padding:3px 8px; border-radius:8px; border:1px solid ${badgeLevelColor}44;">
                                ${escapeHtml(inc.threat_level)}
                            </span>
                        </td>
                        <td style="padding:10px 12px; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:monospace; font-size:0.76rem; color:#be123c; background:#fff1f211;">
                            ${safePayload}
                        </td>
                        <td style="padding:10px 12px; text-align:center; white-space:nowrap;">
                            <button type="button" class="btn btn-sm" onclick="window.lihatDetailInsiden('${inc.id}')" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; border-radius:8px; padding:4px 9px; font-size:0.75rem; font-weight:700; cursor:pointer;">
                                <i class="fas fa-eye"></i> Forensik
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (e) {
            if (!silent) console.warn('[Security] Kendala memuat daftar insiden:', e);
        }
    };

    // Detail Insiden Forensik
    window.lihatDetailInsiden = async function (incidentId) {
        try {
            const res = await fetch('/api/security/attacks?limit=200', { headers: getSecurityHeaders() });
            const data = await res.json();
            const inc = (data.incidents || []).find(i => i.id === incidentId);
            if (!inc) return Swal.fire('Info', 'Rincian insiden tidak ditemukan.', 'info');

            Swal.fire({
                title: `<span style="font-size:1.1rem; color:#0f172a;"><i class="fas fa-microscope text-primary"></i> Forensik Serangan: ${inc.attack_type}</span>`,
                html: `
                    <div style="text-align:left; font-size:0.83rem; line-height:1.6; color:#334155;">
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:12px;">
                            <div><b>ID Insiden:</b> <code style="color:#0f172a;">${escapeHtml(inc.id)}</code></div>
                            <div><b>Waktu:</b> ${formatIncidentTime(inc.timestamp)}</div>
                            <div><b>Alamat IP Penyerang:</b> <code style="color:#dc2626; font-weight:700;">${escapeHtml(inc.ip)}</code></div>
                            <div><b>Kategori Ancaman:</b> <span style="font-weight:700; color:#0284c7;">${escapeHtml(inc.attack_category)}</span></div>
                            <div><b>Tingkat Ancaman:</b> <span style="color:#dc2626; font-weight:800;">${escapeHtml(inc.threat_level)}</span></div>
                            <div><b>Jalur Target (Path):</b> <code>${escapeHtml(inc.path)}</code></div>
                        </div>

                        <div style="margin-bottom:10px;">
                            <label style="font-weight:800; color:#0f172a; display:block; margin-bottom:4px;">Aturan Deteksi WAF yang Cocok:</label>
                            <div style="background:#f1f5f9; padding:8px 12px; border-radius:8px; font-family:monospace; font-size:0.75rem; border:1px solid #cbd5e1; word-break:break-all;">
                                ${escapeHtml(inc.matched_rule)}
                            </div>
                        </div>

                        <div style="margin-bottom:10px;">
                            <label style="font-weight:800; color:#0f172a; display:block; margin-bottom:4px;">Sampel Muatan Serangan (Payload):</label>
                            <pre style="background:#0f172a; color:#f43f5e; padding:10px 14px; border-radius:10px; font-size:0.76rem; overflow-x:auto; margin:0; border:1px solid #334155; white-space:pre-wrap;">${escapeHtml(inc.payload_sample)}</pre>
                        </div>

                        <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:10px 12px; color:#065f46;">
                            <b>Tindakan Pertahanan Otomatis:</b> ${escapeHtml(inc.action_taken)}
                        </div>
                    </div>
                `,
                width: '640px',
                confirmButtonColor: '#0f172a',
                confirmButtonText: 'Tutup Analisis Forensik'
            });
        } catch (e) {
            Swal.fire('Kendala', e.message, 'error');
        }
    };

    // Eksekusi Uji Simulasi Serangan Siber (Developer Test)
    window.ujiSimulasiSerangan = async function (category, type, customPayload) {
        let payload = customPayload;
        if (!payload) {
            if (category === 'MALWARE_THREAT') {
                payload = '<?php eval(base64_decode("ZWNobyAnV2Vic2hlbGwgVGVzdCc7")); ?>';
            } else if (category === 'SOCIAL_ENGINEERING') {
                payload = 'http://fake-login-bank.com/claim-bansos-tunai?id=victim';
            } else if (category === 'NETWORK_TRAFFIC') {
                payload = 'FLOOD_DOS_SYN_RATE_BURST: 250 requests/sec, Host: spoofed.gov';
            } else if (category === 'CREDENTIAL_ATTACK') {
                payload = 'BRUTE_FORCE: username=admin, attempt=5, pass=Password123';
            } else if (category === 'INFRASTRUCTURE_THREAT') {
                payload = 'GET /firebase-applet-config.json HTTP/1.1\r\nHost: target\r\n';
            } else {
                payload = "1' UNION SELECT 1, table_name, column_name FROM information_schema.tables --";
            }
        }

        try {
            Swal.fire({
                title: 'Menjalankan Simulasi Uji Serangan...',
                text: `Kategori: ${category} (${type || 'Default'})`,
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const res = await fetch('/api/security/simulate-attack', {
                method: 'POST',
                headers: getSecurityHeaders(),
                body: JSON.stringify({
                    category: category,
                    type: type || category,
                    payload: payload
                })
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Gagal menjalankan simulasi');

            Swal.fire({
                icon: 'success',
                title: 'Serangan Berhasil Dideteksi & Ditangkis!',
                html: `
                    <div style="text-align:left; font-size:0.85rem; line-height:1.5;">
                        <p style="margin-bottom:8px;">Cyber Shield WAF berhasil mengenali pola serangan siber dan mengaktifkan isolasi pertahanan seketika.</p>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:10px;">
                            <div><b>Kategori:</b> ${escapeHtml(category)}</div>
                            <div><b>Tipe:</b> ${escapeHtml(type || category)}</div>
                            <div><b>Status Pertahanan:</b> <span style="color:#059669; font-weight:800;">DIBLOKIR (BLOCKED)</span></div>
                        </div>
                    </div>
                `,
                confirmButtonColor: '#059669'
            });

            await window.muatStatistikKeamanan();
            await window.muatDaftarSerangan();

        } catch (e) {
            Swal.fire('Gagal Uji', e.message, 'error');
        }
    };

    // Karantina / Blokir IP Manual
    window.blokirIpManual = async function () {
        const { value: formValues } = await Swal.fire({
            title: 'Karantina / Blokir IP Manual',
            html: `
                <div style="text-align:left; font-size:0.85rem;">
                    <label style="display:block; font-weight:700; margin-bottom:4px;">Alamat IP Target:</label>
                    <input id="swalIpInput" class="swal2-input" placeholder="Contoh: 185.220.101.5" style="margin:0 0 12px 0; width:100%;">
                    
                    <label style="display:block; font-weight:700; margin-bottom:4px;">Alasan Pemblokiran:</label>
                    <input id="swalReasonInput" class="swal2-input" placeholder="Aktivitas mencurigakan pemindaian / brute force" style="margin:0 0 12px 0; width:100%;">
                    
                    <label style="display:block; font-weight:700; margin-bottom:4px;">Durasi Blokir (Menit):</label>
                    <input id="swalDurationInput" type="number" value="60" class="swal2-input" style="margin:0; width:100%;">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Blokir IP',
            confirmButtonColor: '#dc2626',
            cancelButtonText: 'Batal',
            preConfirm: () => {
                const ip = document.getElementById('swalIpInput').value.trim();
                const reason = document.getElementById('swalReasonInput').value.trim();
                const duration = document.getElementById('swalDurationInput').value.trim();
                if (!ip) {
                    Swal.showValidationMessage('Alamat IP wajib diisi');
                    return false;
                }
                return { ip, reason: reason || 'Karantina manual oleh Super Admin', duration_minutes: Number(duration) || 60 };
            }
        });

        if (!formValues) return;

        try {
            const res = await fetch('/api/security/block-ip', {
                method: 'POST',
                headers: getSecurityHeaders(),
                body: JSON.stringify(formValues)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal memblokir IP');

            Swal.fire('Berhasil', data.message, 'success');
            await window.muatStatistikKeamanan();
        } catch (e) {
            Swal.fire('Gagal', e.message, 'error');
        }
    };

    // Bersihkan Log Audit Keamanan
    window.bersihkanLogKeamanan = async function () {
        const { isConfirmed } = await Swal.fire({
            title: 'Bersihkan Riwayat Log Serangan?',
            text: 'Tindakan ini akan mengosongkan riwayat log audit dan mereset statistik serangan sesi ini.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Bersihkan',
            cancelButtonText: 'Batal'
        });

        if (!isConfirmed) return;

        try {
            const res = await fetch('/api/security/clear-attacks', {
                method: 'POST',
                headers: getSecurityHeaders()
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal membersihkan log');

            Swal.fire('Selesai', data.message, 'success');
            await window.muatStatistikKeamanan();
            await window.muatDaftarSerangan();
        } catch (e) {
            Swal.fire('Kendala', e.message, 'error');
        }
    };

    // Ekspor Laporan Forensik Keamanan (JSON Data Aman)
    window.unduhLaporanKeamanan = async function () {
        try {
            const [statsRes, attacksRes] = await Promise.all([
                fetch('/api/security/stats', { headers: getSecurityHeaders() }),
                fetch('/api/security/attacks?limit=200', { headers: getSecurityHeaders() })
            ]);

            const stats = await statsRes.json();
            const attacks = await attacksRes.json();

            const exportObj = {
                title: 'LAPORAN AUDIT KEAMANAN SIBER & WAF DINSOS KABUPATEN SIDOARJO',
                export_time: new Date().toISOString(),
                authorized_role: 'SUPER_ADMIN',
                engine_metrics: stats,
                forensic_incidents: attacks.incidents || []
            };

            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2));
            const dlAnchor = document.createElement('a');
            dlAnchor.setAttribute('href', dataStr);
            dlAnchor.setAttribute('download', `Audit_Keamanan_Siber_Sidoarjo_${Date.now()}.json`);
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();

        } catch (e) {
            Swal.fire('Gagal Ekspor', e.message, 'error');
        }
    };

    // Helper teks nama serangan & ikon
    function formatAttackName(type) {
        const map = {
            SQL_INJECTION: 'SQL Injection',
            XSS: 'Cross-Site Scripting (XSS)',
            COMMAND_INJECTION: 'Command Injection / RCE',
            PATH_TRAVERSAL: 'Path Traversal / LFI',
            RECON_SCANNER: 'Scanner Recon Bot',
            BRUTE_FORCE: 'Brute Force Login',
            MALICIOUS_UPLOAD: 'Webshell / Malicious File',
            MALWARE_THREAT: 'Malware / Webshell Signature',
            SOCIAL_ENGINEERING: 'Phishing / Social Engineering',
            NETWORK_TRAFFIC: 'DDoS / Network Traffic Flood',
            CREDENTIAL_ATTACK: 'Credential Stuffing / Brute Force',
            INFRASTRUCTURE_THREAT: 'Protected Secret / Infrastructure Threat'
        };
        return map[type] || type || 'Cyber Attack';
    }

    function getCategoryLabel(cat) {
        const map = {
            MALWARE_THREAT: '1. Malware',
            SOCIAL_ENGINEERING: '2. Social Eng',
            NETWORK_TRAFFIC: '3. Network/DDoS',
            WEB_EXPLOITATION: '4. Web App Exploit',
            CREDENTIAL_ATTACK: '5. Credential Attack',
            INFRASTRUCTURE_THREAT: '6. Infrastructure'
        };
        return map[cat] || cat || 'Cyber Threat';
    }

    function getAttackIcon(type) {
        const map = {
            SQL_INJECTION: 'fas fa-database text-rose-500',
            XSS: 'fas fa-code text-amber-500',
            COMMAND_INJECTION: 'fas fa-terminal text-red-600',
            PATH_TRAVERSAL: 'fas fa-folder-open text-orange-500',
            RECON_SCANNER: 'fas fa-robot text-purple-500',
            BRUTE_FORCE: 'fas fa-key text-red-500',
            MALICIOUS_UPLOAD: 'fas fa-file-code text-rose-600',
            MALWARE_THREAT: 'fas fa-virus text-red-600',
            SOCIAL_ENGINEERING: 'fas fa-user-secret text-amber-500',
            NETWORK_TRAFFIC: 'fas fa-network-wired text-blue-500',
            CREDENTIAL_ATTACK: 'fas fa-lock-open text-orange-600',
            INFRASTRUCTURE_THREAT: 'fas fa-server text-purple-600'
        };
        return map[type] || 'fas fa-shield-virus';
    }

    function formatIncidentTime(isoString) {
        if (!isoString) return '-';
        const d = new Date(isoString);
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }) + ')';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Pembuatan Elemen Modal Pusat Keamanan Siber
    function createSecurityModalElement() {
        const div = document.createElement('div');
        div.id = 'modalKeamananSiber';
        div.style.cssText = 'display:none; position:fixed; inset:0; z-index:999999; background:rgba(15,23,42,0.88); backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:16px; box-sizing:border-box; overflow-y:auto;';
        div.innerHTML = `
            <div style="background:#ffffff; border-radius:28px; width:100%; max-width:1050px; max-height:calc(100vh - 32px); max-height:calc(100dvh - 32px); display:flex; flex-direction:column; overflow:hidden; margin:auto; box-shadow:0 30px 80px rgba(0,0,0,0.45); border:1.5px solid #cbd5e1; box-sizing:border-box;">
                
                <!-- Header Modal Keamanan -->
                <div style="padding:16px 24px; background:linear-gradient(135deg, #090d16, #1e293b); color:#ffffff; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; flex-shrink:0; flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg, #059669, #10b981); display:flex; align-items:center; justify-content:center; font-size:1.35rem; color:white; box-shadow:0 4px 14px rgba(16,185,129,0.4); flex-shrink:0;">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div>
                            <div style="font-size:1.15rem; font-weight:800; letter-spacing:0.2px; display:flex; align-items:center; gap:8px;">
                                Pusat Keamanan & Deteksi Siber (Cyber Shield)
                                <span style="background:rgba(220,38,38,0.2); color:#fca5a5; font-size:0.68rem; font-weight:800; padding:2px 10px; border-radius:9999px; border:1px solid rgba(239,68,68,0.4);">SUPER ADMIN ONLY</span>
                            </div>
                            <div style="font-size:0.78rem; color:#94a3b8; margin-top:2px;">
                                Pertahanan Sistem Berlapis Pemkab Sidoarjo: Database, Developer & Pengguna Terlindungi Penuh
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px;">
                        <span id="secStatusPill" style="display:inline-flex; align-items:center; gap:6px; background:#10b98122; border:1px solid #10b981; color:#10b981; padding:5px 14px; border-radius:9999px; font-size:0.75rem; font-weight:800;">
                            <span class="pulse-dot" style="background:#10b981;"></span> SISTEM TERLINDUNGI
                        </span>
                        <button type="button" onclick="window.tutupModalKeamananSiber()" style="background:rgba(255,255,255,0.1); border:none; width:36px; height:36px; border-radius:50%; color:#cbd5e1; font-size:1.3rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">&times;</button>
                    </div>
                </div>

                <!-- Body Modal (Scrollable) -->
                <div style="padding:20px 24px; overflow-y:auto; flex:1; background:#f8fafc;">
                    
                    <!-- 1. KARTU METRIK GLOBAL -->
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:14px; margin-bottom:20px;">
                        <div style="background:#ffffff; border-radius:18px; padding:16px; border:1.5px solid #e2e8f0; display:flex; align-items:center; gap:14px;">
                            <div style="width:44px; height:44px; border-radius:12px; background:#fee2e2; color:#dc2626; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                                <i class="fas fa-ban"></i>
                            </div>
                            <div>
                                <div style="font-size:1.4rem; font-weight:800; color:#dc2626; line-height:1;" id="secTotalBlocked">0</div>
                                <div style="font-size:0.76rem; color:#64748b; font-weight:700; margin-top:3px;">Total Serangan Ditangkis</div>
                            </div>
                        </div>

                        <div style="background:#ffffff; border-radius:18px; padding:16px; border:1.5px solid #e2e8f0; display:flex; align-items:center; gap:14px;">
                            <div style="width:44px; height:44px; border-radius:12px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                                <i class="fas fa-search-plus"></i>
                            </div>
                            <div>
                                <div style="font-size:1.4rem; font-weight:800; color:#2563eb; line-height:1;" id="secTotalInspected">0</div>
                                <div style="font-size:0.76rem; color:#64748b; font-weight:700; margin-top:3px;">Permintaan Diinspeksi WAF</div>
                            </div>
                        </div>

                        <div style="background:#ffffff; border-radius:18px; padding:16px; border:1.5px solid #e2e8f0; display:flex; align-items:center; gap:14px;">
                            <div style="width:44px; height:44px; border-radius:12px; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                                <i class="fas fa-user-lock"></i>
                            </div>
                            <div>
                                <div style="font-size:1.4rem; font-weight:800; color:#d97706; line-height:1;" id="secQuarantinedIps">0</div>
                                <div style="font-size:0.76rem; color:#64748b; font-weight:700; margin-top:3px;">IP Dikarantina Aktif</div>
                            </div>
                        </div>

                        <div style="background:#ffffff; border-radius:18px; padding:16px; border:1.5px solid #e2e8f0; display:flex; align-items:center; gap:14px;">
                            <div style="width:44px; height:44px; border-radius:12px; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                                <i class="fas fa-key"></i>
                            </div>
                            <div>
                                <div style="font-size:0.95rem; font-weight:800; color:#059669; line-height:1.2;">Rahasia Terisolasi</div>
                                <div style="font-size:0.74rem; color:#64748b; font-weight:700; margin-top:3px;">Kunci & Kredensial Tersembunyi</div>
                            </div>
                        </div>
                    </div>

                    <!-- 2. MATRIKS RESMI 6 KATEGORI MODEL PENYERANGAN SIBER -->
                    <div style="background:#ffffff; border-radius:20px; padding:20px; border:1.5px solid #e2e8f0; margin-bottom:20px;">
                        <div style="margin-bottom:14px;">
                            <h4 style="margin:0; font-size:1.05rem; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-layer-group text-primary"></i> 6 Kategori Model Penyerangan Siber & Status Pertahanan
                            </h4>
                            <small style="color:#64748b;">Seluruh vektor penyerangan berikut dimonitor, disanitasi, dan diblokir secara otomatis oleh sistem.</small>
                        </div>

                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:12px;">
                            
                            <!-- Kategori 1: Malware -->
                            <div style="background:#fff1f2; border:1.5px solid #fecdd3; border-radius:16px; padding:14px;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                                    <div style="font-weight:800; font-size:0.86rem; color:#be123c;">
                                        1. Kategori Berbasis Malware
                                    </div>
                                    <span id="secCatCount_MALWARE" style="background:#e11d48; color:white; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:10px;">0</span>
                                </div>
                                <div style="font-size:0.73rem; color:#475569; line-height:1.4; margin-bottom:8px;">
                                    <b>Sub-serangan:</b> Virus, Worm, Trojan Horse, Ransomware, Spyware & Keyloggers, Adware, Rootkit, Fileless Malware.
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem;">
                                    <span style="color:#059669; font-weight:800;"><i class="fas fa-check-circle"></i> Anti-Webshell & Sandbox</span>
                                    <button type="button" onclick="window.ujiSimulasiSerangan('MALWARE_THREAT', 'WEBSHELL_VIRUS')" style="background:#be123c; color:white; border:none; padding:4px 8px; border-radius:8px; font-size:0.68rem; font-weight:700; cursor:pointer;">Uji</button>
                                </div>
                            </div>

                            <!-- Kategori 2: Social Engineering -->
                            <div style="background:#fffbeb; border:1.5px solid #fef3c7; border-radius:16px; padding:14px;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                                    <div style="font-weight:800; font-size:0.86rem; color:#b45309;">
                                        2. Kategori Rekayasa Sosial
                                    </div>
                                    <span id="secCatCount_SOCIAL" style="background:#d97706; color:white; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:10px;">0</span>
                                </div>
                                <div style="font-size:0.73rem; color:#475569; line-height:1.4; margin-bottom:8px;">
                                    <b>Sub-serangan:</b> Phishing Massal, Spear Phishing, Whaling, Smishing & Vishing, Deepfake / AI Voice Scam, Baiting.
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem;">
                                    <span style="color:#059669; font-weight:800;"><i class="fas fa-check-circle"></i> TTE BSrE & Anti-Harvesting</span>
                                    <button type="button" onclick="window.ujiSimulasiSerangan('SOCIAL_ENGINEERING', 'PHISHING_DECOY')" style="background:#b45309; color:white; border:none; padding:4px 8px; border-radius:8px; font-size:0.68rem; font-weight:700; cursor:pointer;">Uji</button>
                                </div>
                            </div>

                            <!-- Kategori 3: Jaringan & Traffic -->
                            <div style="background:#eff6ff; border:1.5px solid #dbeafe; border-radius:16px; padding:14px;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                                    <div style="font-weight:800; font-size:0.86rem; color:#1d4ed8;">
                                        3. Serangan Jaringan & Lalu Lintas
                                    </div>
                                    <span id="secCatCount_NETWORK" style="background:#2563eb; color:white; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:10px;">0</span>
                                </div>
                                <div style="font-size:0.73rem; color:#475569; line-height:1.4; margin-bottom:8px;">
                                    <b>Sub-serangan:</b> DoS & DDoS, AitM/MitM (Wi-Fi), Spoofing (IP/DNS), Eavesdropping/Sniffing, Session Hijacking.
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem;">
                                    <span style="color:#059669; font-weight:800;"><i class="fas fa-check-circle"></i> Rate Limit & HMAC JWT</span>
                                    <button type="button" onclick="window.ujiSimulasiSerangan('NETWORK_TRAFFIC', 'DDOS_FLOOD')" style="background:#1d4ed8; color:white; border:none; padding:4px 8px; border-radius:8px; font-size:0.68rem; font-weight:700; cursor:pointer;">Uji</button>
                                </div>
                            </div>

                            <!-- Kategori 4: Eksploitasi Web -->
                            <div style="background:#faf5ff; border:1.5px solid #f3e8ff; border-radius:16px; padding:14px;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                                    <div style="font-weight:800; font-size:0.86rem; color:#7e22ce;">
                                        4. Eksploitasi Aplikasi & Web
                                    </div>
                                    <span id="secCatCount_WEB" style="background:#9333ea; color:white; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:10px;">0</span>
                                </div>
                                <div style="font-size:0.73rem; color:#475569; line-height:1.4; margin-bottom:8px;">
                                    <b>Sub-serangan:</b> SQL Injection (SQLi), Cross-Site Scripting (XSS), Clickjacking (Frame Hijack), Zero-Day Exploits.
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem;">
                                    <span style="color:#059669; font-weight:800;"><i class="fas fa-check-circle"></i> WAF Deep Filter & Frame SAMEORIGIN</span>
                                    <button type="button" onclick="window.ujiSimulasiSerangan('WEB_EXPLOITATION', 'SQL_INJECTION')" style="background:#7e22ce; color:white; border:none; padding:4px 8px; border-radius:8px; font-size:0.68rem; font-weight:700; cursor:pointer;">Uji</button>
                                </div>
                            </div>

                            <!-- Kategori 5: Pembongkaran Kredensial -->
                            <div style="background:#f0fdf4; border:1.5px solid #dcfce7; border-radius:16px; padding:14px;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                                    <div style="font-weight:800; font-size:0.86rem; color:#15803d;">
                                        5. Pembongkaran Kredensial & Sandi
                                    </div>
                                    <span id="secCatCount_CREDENTIAL" style="background:#16a34a; color:white; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:10px;">0</span>
                                </div>
                                <div style="font-size:0.73rem; color:#475569; line-height:1.4; margin-bottom:8px;">
                                    <b>Sub-serangan:</b> Brute Force Attack, Credential Stuffing, Password Spraying (Password123 ke ribuan akun).
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem;">
                                    <span style="color:#059669; font-weight:800;"><i class="fas fa-check-circle"></i> Lockout Progresif & Anti-Leak</span>
                                    <button type="button" onclick="window.ujiSimulasiSerangan('CREDENTIAL_ATTACK', 'BRUTE_FORCE')" style="background:#15803d; color:white; border:none; padding:4px 8px; border-radius:8px; font-size:0.68rem; font-weight:700; cursor:pointer;">Uji</button>
                                </div>
                            </div>

                            <!-- Kategori 6: Infrastruktur & Ancaman Khusus -->
                            <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:16px; padding:14px;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                                    <div style="font-weight:800; font-size:0.86rem; color:#334155;">
                                        6. Infrastruktur & Ancaman Khusus
                                    </div>
                                    <span id="secCatCount_INFRA" style="background:#475569; color:white; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:10px;">0</span>
                                </div>
                                <div style="font-size:0.73rem; color:#475569; line-height:1.4; margin-bottom:8px;">
                                    <b>Sub-serangan:</b> Supply Chain Attack, Insider Threat (Kebocoran Orang Dalam), Cryptojacking, Watering Hole, IoT Attacks.
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem;">
                                    <span style="color:#059669; font-weight:800;"><i class="fas fa-check-circle"></i> Isolasi Berkas Rahasia & Masking NIK</span>
                                    <button type="button" onclick="window.ujiSimulasiSerangan('INFRASTRUCTURE_THREAT', 'SECRET_CONFIG_PROBE')" style="background:#334155; color:white; border:none; padding:4px 8px; border-radius:8px; font-size:0.68rem; font-weight:700; cursor:pointer;">Uji</button>
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- 3. TABEL AUDIT FORENSIK REAL-TIME -->
                    <div style="background:#ffffff; border-radius:20px; padding:18px 20px; border:1.5px solid #e2e8f0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                            <div>
                                <h4 style="margin:0; font-size:1rem; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                                    <i class="fas fa-shield-virus text-rose-500"></i> Audit Log Forensik Serangan Siber
                                </h4>
                                <small style="color:#64748b;">Inspeksi mendalam muatan data berbahaya yang berhasil dipotong oleh filter WAF.</small>
                            </div>
                            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                                <button type="button" onclick="window.blokirIpManual()" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:9999px; padding:6px 14px; font-size:0.78rem; font-weight:700; cursor:pointer;">
                                    <i class="fas fa-plus"></i> Karantina IP
                                </button>
                                <button type="button" onclick="window.bersihkanLogKeamanan()" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:9999px; padding:6px 14px; font-size:0.78rem; font-weight:700; cursor:pointer;">
                                    <i class="fas fa-trash-alt"></i> Reset Log
                                </button>
                                <button type="button" onclick="window.unduhLaporanKeamanan()" style="background:#0284c7; color:white; border:none; border-radius:9999px; padding:6px 16px; font-size:0.78rem; font-weight:800; cursor:pointer;">
                                    <i class="fas fa-download"></i> Ekspor Forensik JSON
                                </button>
                            </div>
                        </div>

                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; text-align:left;">
                                <thead>
                                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; font-size:0.76rem; color:#64748b; text-transform:uppercase;">
                                        <th style="padding:10px 12px;">Waktu</th>
                                        <th style="padding:10px 12px;">IP Penyerang</th>
                                        <th style="padding:10px 12px;">Kategori & Tipe Serangan</th>
                                        <th style="padding:10px 12px; text-align:center;">Tingkat Ancaman</th>
                                        <th style="padding:10px 12px;">Sampel Muatan (Payload)</th>
                                        <th style="padding:10px 12px; text-align:center;">Forensik</th>
                                    </tr>
                                </thead>
                                <tbody id="secAttackLogTbody">
                                    <tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">Memuat data...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                <!-- Footer Modal -->
                <div style="padding:12px 24px; background:#f1f5f9; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="font-size:0.75rem; color:#64748b;">
                        <i class="fas fa-lock"></i> Standar Perlindungan Data Pribadi (UU PDP No. 27/2022) & Keamanan Siber Pemkab Sidoarjo
                    </div>
                    <button type="button" onclick="window.tutupModalKeamananSiber()" style="background:#0f172a; color:#ffffff; border:none; border-radius:9999px; padding:8px 20px; font-size:0.82rem; font-weight:800; cursor:pointer;">
                        Tutup Pusat Keamanan
                    </button>
                </div>

            </div>
        `;
        document.body.appendChild(div);
    }

})();
