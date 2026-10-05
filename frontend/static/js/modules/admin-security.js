/**
 * MODUL PUSAT KEAMANAN SIBER & DETEKSI SERANGAN (CYBER SHIELD WAF & IDS)
 * Pemerintah Kabupaten Sidoarjo - Dinas Sosial
 * Fitur Utama:
 * 1. Pemantauan Serangan Siber Real-Time (SQLi, XSS, RCE, Path Traversal, Brute Force, Scanner Bot).
 * 2. Visual Forensik Muatan Serangan (Payload Viewer & Matched Rule).
 * 3. Manajemen Karantina & Blokir IP Otomatis & Manual.
 * 4. Uji Simulasi Serangan Siber untuk Developer (Live Attack Detection Testing).
 * 5. Ekspor Laporan Audit Forensik Keamanan.
 */

(function () {
    let securityPollingInterval = null;

    // Buka Modal Pusat Keamanan Siber
    window.bukaModalKeamananSiber = async function () {
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
            const res = await fetch('/api/security/stats');
            if (!res.ok) throw new Error('Gagal menghubungi WAF Guard');
            const data = await res.json();

            // Perbarui Badge Status Navbar jika ada
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

            // Breakdown Serangan
            const bk = data.attack_breakdown || {};
            const elSqli = document.getElementById('secCountSqli');
            if (elSqli) elSqli.innerText = bk.SQL_INJECTION || 0;

            const elXss = document.getElementById('secCountXss');
            if (elXss) elXss.innerText = bk.XSS || 0;

            const elRce = document.getElementById('secCountRce');
            if (elRce) elRce.innerText = bk.COMMAND_INJECTION || 0;

            const elTraversal = document.getElementById('secCountTraversal');
            if (elTraversal) elTraversal.innerText = bk.PATH_TRAVERSAL || 0;

            const elRecon = document.getElementById('secCountRecon');
            if (elRecon) elRecon.innerText = bk.RECON_SCANNER || 0;

            const elBrute = document.getElementById('secCountBrute');
            if (elBrute) elBrute.innerText = bk.BRUTE_FORCE || 0;

        } catch (e) {
            if (!silent) console.warn('[Security] Kendala memuat statistik WAF:', e);
        }
    };

    // Muat Riwayat Log Serangan
    window.muatDaftarSerangan = async function (silent = false) {
        const tbody = document.getElementById('secAttackLogTbody');
        if (!tbody) return;

        try {
            const res = await fetch('/api/security/attacks?limit=50');
            if (!res.ok) throw new Error('Gagal mengambil audit log serangan');
            const data = await res.json();
            const incidents = data.incidents || [];

            if (incidents.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align:center; padding:40px 20px; color:#64748b;">
                            <i class="fas fa-shield-check" style="font-size:2.4rem; color:#10b981; margin-bottom:8px; display:block;"></i>
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

                return `
                    <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding:10px 12px; font-size:0.78rem; font-family:monospace; color:#475569; white-space:nowrap;">
                            ${timeStr}
                        </td>
                        <td style="padding:10px 12px; font-size:0.82rem; font-weight:700; color:#0f172a; white-space:nowrap;">
                            <span style="font-family:monospace; background:#f1f5f9; padding:2px 6px; border-radius:6px; border:1px solid #e2e8f0;">${escapeHtml(inc.ip)}</span>
                        </td>
                        <td style="padding:10px 12px; font-size:0.8rem; font-weight:800; color:#0f172a; white-space:nowrap;">
                            <span style="background:#f1f5f9; color:#0f172a; padding:3px 8px; border-radius:8px; border:1px solid #cbd5e1; display:inline-flex; align-items:center; gap:5px;">
                                <i class="${getAttackIcon(inc.attack_type)}"></i> ${formatAttackName(inc.attack_type)}
                            </span>
                        </td>
                        <td style="padding:10px 12px; text-align:center; white-space:nowrap;">
                            <span style="background:${badgeLevelBg}; color:${badgeLevelColor}; border:1px solid ${badgeLevelColor}44; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:8px;">
                                ${inc.threat_level}
                            </span>
                        </td>
                        <td style="padding:10px 12px; font-size:0.78rem; font-family:monospace; color:#dc2626; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${safePayload}">
                            ${safePayload}
                        </td>
                        <td style="padding:10px 12px; text-align:center; white-space:nowrap;">
                            <div style="display:inline-flex; gap:6px;">
                                <button type="button" onclick="window.lihatDetailInsiden('${inc.id}')" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd; border-radius:8px; padding:4px 8px; font-size:0.75rem; font-weight:700; cursor:pointer;" title="Lihat Forensik Lengkap">
                                    <i class="fas fa-search-plus"></i> Detail
                                </button>
                                <button type="button" onclick="window.blokirIpManual('${escapeHtml(inc.ip)}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; border-radius:8px; padding:4px 8px; font-size:0.75rem; font-weight:700; cursor:pointer;" title="Karantina / Blokir IP Ini">
                                    <i class="fas fa-ban"></i> Blokir
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            if (!silent) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#ef4444;">Gagal memuat log serangan: ${e.message}</td></tr>`;
        }
    };

    // Uji Simulasi Serangan Siber (Fitur Khusus Developer)
    window.ujiSimulasiSerangan = async function (attackType) {
        try {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Menjalankan Simulasi...',
                    text: `Menguji respons pertahanan terhadap serangan ${formatAttackName(attackType)}...`,
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });
            }

            const res = await fetch('/api/security/simulate-attack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: attackType })
            });

            const data = await res.json();
            if (data.status === 'success') {
                await window.muatStatistikKeamanan();
                await window.muatDaftarSerangan();

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: '🛡️ Serangan Berhasil Dideteksi & Dinetralkan!',
                        html: `
                            <div style="text-align:left; font-size:0.86rem; color:#334155; line-height:1.6;">
                                <div style="background:#fef2f2; border:1.5px solid #fecaca; border-radius:12px; padding:12px; margin-bottom:12px;">
                                    <strong style="color:#b91c1c; display:block; margin-bottom:4px;"><i class="fas fa-shield-virus"></i> Tipe: ${formatAttackName(attackType)}</strong>
                                    <div style="font-family:monospace; font-size:0.8rem; color:#7f1d1d; word-break:break-all;">
                                        Payload: <code>${escapeHtml(data.incident.payload_sample)}</code>
                                    </div>
                                </div>
                                <p style="margin:0 0 6px 0;"><b>Tingkat Ancaman:</b> <span style="color:#dc2626; font-weight:800;">${data.incident.threat_level}</span></p>
                                <p style="margin:0 0 6px 0;"><b>Tindakan WAF:</b> <span style="color:#059669; font-weight:800;">${data.incident.action_taken}</span></p>
                                <small style="color:#64748b;">Insiden telah dicatat di log audit keamanan dan dikirimkan ke panel notifikasi admin.</small>
                            </div>
                        `
                    });
                }
            }
        } catch (e) {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Kendala Pengujian', e.message, 'error');
            }
        }
    };

    // Lihat Detail Forensik Insiden
    window.lihatDetailInsiden = async function (incidentId) {
        try {
            const res = await fetch('/api/security/attacks?limit=200');
            const data = await res.json();
            const incident = (data.incidents || []).find(i => i.id === incidentId);

            if (!incident) {
                return Swal.fire('Informasi', 'Data insiden tidak ditemukan atau telah dibersihkan.', 'info');
            }

            Swal.fire({
                title: `🛡️ Forensik Insiden #${incident.id}`,
                width: '650px',
                html: `
                    <div style="text-align:left; font-size:0.86rem; color:#1e293b; line-height:1.6;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; background:#f8fafc; padding:14px; border-radius:14px; border:1px solid #e2e8f0;">
                            <div><strong>Waktu:</strong> ${new Date(incident.timestamp).toLocaleString('id-ID')}</div>
                            <div><strong>IP Penyerang:</strong> <span style="font-family:monospace; font-weight:700;">${escapeHtml(incident.ip)}</span></div>
                            <div><strong>Tipe Serangan:</strong> <span style="font-weight:800; color:#dc2626;">${incident.attack_type}</span></div>
                            <div><strong>Level Bahaya:</strong> <span style="font-weight:800;">${incident.threat_level}</span></div>
                            <div><strong>Metode HTTP:</strong> <code>${incident.method}</code></div>
                            <div><strong>Target Path:</strong> <code>${escapeHtml(incident.path)}</code></div>
                        </div>

                        <div style="margin-bottom:12px;">
                            <label style="font-weight:800; color:#0f172a; display:block; margin-bottom:4px;">Cuplikan Payload Berbahaya:</label>
                            <pre style="background:#0f172a; color:#f87171; padding:12px; border-radius:12px; font-size:0.8rem; overflow-x:auto; white-space:pre-wrap; word-break:break-all; max-height:160px;">${escapeHtml(incident.payload_sample)}</pre>
                        </div>

                        <div style="margin-bottom:12px;">
                            <label style="font-weight:800; color:#0f172a; display:block; margin-bottom:4px;">Aturan WAF yang Cocok:</label>
                            <code style="background:#f1f5f9; color:#475569; padding:6px 10px; border-radius:8px; display:block; word-break:break-all;">${escapeHtml(incident.matched_rule)}</code>
                        </div>

                        <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:12px; padding:10px 14px; color:#065f46;">
                            <strong><i class="fas fa-check-circle"></i> Tindakan Pengamanan:</strong> ${escapeHtml(incident.action_taken)}
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-ban"></i> Blokir IP Penyerang',
                confirmButtonColor: '#dc2626',
                cancelButtonText: 'Tutup'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.blokirIpManual(incident.ip);
                }
            });
        } catch (e) {
            Swal.fire('Kendala', e.message, 'error');
        }
    };

    // Blokir IP Manual
    window.blokirIpManual = function (prefilledIp = '') {
        Swal.fire({
            title: 'Karantina / Blokir Alamat IP',
            html: `
                <div style="text-align:left; font-size:0.86rem; color:#475569;">
                    <div style="margin-bottom:10px;">
                        <label style="font-weight:700; display:block; margin-bottom:4px;">Alamat IP Klien:</label>
                        <input type="text" id="swalBlockIpInput" value="${escapeHtml(prefilledIp)}" placeholder="Contoh: 192.168.1.50" style="width:100%; padding:9px 12px; border-radius:10px; border:1.5px solid #cbd5e1; outline:none; font-family:monospace;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="font-weight:700; display:block; margin-bottom:4px;">Alasan Pemblokiran:</label>
                        <input type="text" id="swalBlockReasonInput" value="Aktivitas berbahaya mencurigakan (Cyber Shield)" style="width:100%; padding:9px 12px; border-radius:10px; border:1.5px solid #cbd5e1; outline:none;">
                    </div>
                    <div>
                        <label style="font-weight:700; display:block; margin-bottom:4px;">Durasi Blokir (Menit):</label>
                        <select id="swalBlockDurationInput" style="width:100%; padding:9px 12px; border-radius:10px; border:1.5px solid #cbd5e1; outline:none;">
                            <option value="15">15 Menit</option>
                            <option value="30" selected>30 Menit</option>
                            <option value="60">1 Jam</option>
                            <option value="360">6 Jam</option>
                            <option value="1440">24 Jam (1 Hari)</option>
                        </select>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Blokir Sekarang',
            confirmButtonColor: '#dc2626',
            cancelButtonText: 'Batal',
            preConfirm: () => {
                const ip = document.getElementById('swalBlockIpInput')?.value?.trim();
                const reason = document.getElementById('swalBlockReasonInput')?.value?.trim();
                const duration = Number(document.getElementById('swalBlockDurationInput')?.value) || 30;
                if (!ip) {
                    Swal.showValidationMessage('Alamat IP wajib diisi!');
                    return false;
                }
                return { ip, reason, duration };
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                try {
                    const res = await fetch('/api/security/block-ip', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ip: result.value.ip,
                            reason: result.value.reason,
                            duration_minutes: result.value.duration
                        })
                    });
                    const resJson = await res.json();
                    if (resJson.status === 'success') {
                        Swal.fire('Berhasil', resJson.message, 'success');
                        window.muatStatistikKeamanan();
                    } else {
                        Swal.fire('Gagal', resJson.message || 'Terjadi kesalahan', 'error');
                    }
                } catch (e) {
                    Swal.fire('Error', e.message, 'error');
                }
            }
        });
    };

    // Bersihkan Log Serangan
    window.bersihkanLogKeamanan = function () {
        Swal.fire({
            title: 'Bersihkan Log Insiden Keamanan?',
            text: 'Seluruh riwayat serangan siber yang tersimpan di memori akan dibersihkan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Bersihkan',
            confirmButtonColor: '#dc2626',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await fetch('/api/security/clear-logs', { method: 'POST' });
                await window.muatDaftarSerangan();
                Swal.fire('Bersih', 'Riwayat insiden keamanan telah berhasil dikosongkan.', 'success');
            }
        });
    };

    // Unduh Laporan Audit Forensik Keamanan (JSON)
    window.unduhLaporanKeamanan = async function () {
        try {
            const res = await fetch('/api/security/attacks?limit=500');
            const data = await res.json();
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_keamanan_sidoarjo_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            Swal.fire('Gagal Mengunduh', e.message, 'error');
        }
    };

    function formatAttackName(type) {
        const map = {
            SQL_INJECTION: 'SQL Injection',
            XSS: 'Cross-Site Scripting (XSS)',
            COMMAND_INJECTION: 'Command Injection / RCE',
            PATH_TRAVERSAL: 'Path Traversal / LFI',
            RECON_SCANNER: 'Scanner Recon Bot',
            BRUTE_FORCE: 'Brute Force Login',
            MALICIOUS_UPLOAD: 'Webshell / Malicious File'
        };
        return map[type] || type || 'Cyber Attack';
    }

    function getAttackIcon(type) {
        const map = {
            SQL_INJECTION: 'fas fa-database text-rose-500',
            XSS: 'fas fa-code text-amber-500',
            COMMAND_INJECTION: 'fas fa-terminal text-red-600',
            PATH_TRAVERSAL: 'fas fa-folder-open text-orange-500',
            RECON_SCANNER: 'fas fa-robot text-purple-500',
            BRUTE_FORCE: 'fas fa-key text-red-500',
            MALICIOUS_UPLOAD: 'fas fa-file-excel text-rose-600'
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
        div.style.cssText = 'display:none; position:fixed; inset:0; z-index:999999; background:rgba(15,23,42,0.85); backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:16px; box-sizing:border-box; overflow-y:auto;';
        div.innerHTML = `
            <div style="background:#ffffff; border-radius:28px; width:100%; max-width:960px; max-height:calc(100vh - 32px); max-height:calc(100dvh - 32px); display:flex; flex-direction:column; overflow:hidden; margin:auto; box-shadow:0 30px 80px rgba(0,0,0,0.4); border:1.5px solid #cbd5e1; box-sizing:border-box;">
                
                <!-- Header Modal Keamanan -->
                <div style="padding:16px 24px; background:linear-gradient(135deg, #0f172a, #1e293b); color:#ffffff; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; flex-shrink:0; flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg, #059669, #10b981); display:flex; align-items:center; justify-content:center; font-size:1.3rem; color:white; box-shadow:0 4px 14px rgba(16,185,129,0.4); flex-shrink:0;">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div>
                            <div style="font-size:1.15rem; font-weight:800; letter-spacing:0.2px; display:flex; align-items:center; gap:8px;">
                                Pusat Keamanan & Deteksi Serangan Siber
                                <span style="background:rgba(16,185,129,0.2); color:#34d399; font-size:0.68rem; font-weight:800; padding:2px 10px; border-radius:9999px; border:1px solid rgba(52,211,153,0.3);">WAF SHIELD</span>
                            </div>
                            <div style="font-size:0.78rem; color:#94a3b8; margin-top:2px;">
                                Pertahanan Sistem Berlapis Pemkab Sidoarjo: Database, Developer & Pengguna
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
                    
                    <!-- 1. KARTU STATISTIK KEAMANAN -->
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:14px; margin-bottom:20px;">
                        <div style="background:#ffffff; border-radius:18px; padding:16px; border:1.5px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; align-items:center; gap:14px;">
                            <div style="width:44px; height:44px; border-radius:12px; background:#fee2e2; color:#dc2626; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                                <i class="fas fa-ban"></i>
                            </div>
                            <div>
                                <div style="font-size:1.4rem; font-weight:800; color:#dc2626; line-height:1;" id="secTotalBlocked">0</div>
                                <div style="font-size:0.76rem; color:#64748b; font-weight:700; margin-top:3px;">Serangan Diblokir</div>
                            </div>
                        </div>

                        <div style="background:#ffffff; border-radius:18px; padding:16px; border:1.5px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; align-items:center; gap:14px;">
                            <div style="width:44px; height:44px; border-radius:12px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                                <i class="fas fa-radar"></i>
                            </div>
                            <div>
                                <div style="font-size:1.4rem; font-weight:800; color:#2563eb; line-height:1;" id="secTotalInspected">0</div>
                                <div style="font-size:0.76rem; color:#64748b; font-weight:700; margin-top:3px;">Permintaan Diperiksa</div>
                            </div>
                        </div>

                        <div style="background:#ffffff; border-radius:18px; padding:16px; border:1.5px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; align-items:center; gap:14px;">
                            <div style="width:44px; height:44px; border-radius:12px; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                                <i class="fas fa-user-lock"></i>
                            </div>
                            <div>
                                <div style="font-size:1.4rem; font-weight:800; color:#d97706; line-height:1;" id="secQuarantinedIps">0</div>
                                <div style="font-size:0.76rem; color:#64748b; font-weight:700; margin-top:3px;">IP Dikarantina</div>
                            </div>
                        </div>

                        <div style="background:#ffffff; border-radius:18px; padding:16px; border:1.5px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; align-items:center; gap:14px;">
                            <div style="width:44px; height:44px; border-radius:12px; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                                <i class="fas fa-key"></i>
                            </div>
                            <div>
                                <div style="font-size:0.95rem; font-weight:800; color:#059669; line-height:1.2;">Kriptografi Kuat</div>
                                <div style="font-size:0.74rem; color:#64748b; font-weight:700; margin-top:3px;">HMAC-SHA256 & Secrets Hidden</div>
                            </div>
                        </div>
                    </div>

                    <!-- 2. BREAKDOWN SERANGAN & UJI SIMULASI DEVELOPER -->
                    <div style="background:#ffffff; border-radius:20px; padding:18px 20px; border:1.5px solid #e2e8f0; margin-bottom:20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
                            <div>
                                <h4 style="margin:0; font-size:1rem; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                                    <i class="fas fa-vial text-primary"></i> Uji Simulasi Serangan Siber (Fitur Developer)
                                </h4>
                                <small style="color:#64748b;">Tekan tombol di bawah untuk menguji respons deteksi instan WAF & pertahanan aplikasi.</small>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button type="button" onclick="window.blokirIpManual()" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:9999px; padding:7px 14px; font-size:0.78rem; font-weight:700; cursor:pointer;">
                                    <i class="fas fa-plus"></i> Karantina IP
                                </button>
                                <button type="button" onclick="window.unduhLaporanKeamanan()" style="background:#0284c7; color:white; border:none; border-radius:9999px; padding:7px 16px; font-size:0.78rem; font-weight:800; cursor:pointer;">
                                    <i class="fas fa-download"></i> Ekspor JSON
                                </button>
                            </div>
                        </div>

                        <!-- Tombol Simulasi Cepat -->
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">
                            <button type="button" onclick="window.ujiSimulasiSerangan('SQL_INJECTION')" style="background:#fff1f2; border:1.5px solid #fecdd3; border-radius:14px; padding:10px; text-align:left; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='#ffe4e6'" onmouseout="this.style.background='#fff1f2'">
                                <div style="font-size:0.75rem; font-weight:800; color:#be123c; display:flex; justify-content:space-between; align-items:center;">
                                    <span>SQL Injection</span>
                                    <span id="secCountSqli" style="background:#e11d48; color:white; padding:1px 6px; border-radius:8px; font-size:0.7rem;">0</span>
                                </div>
                                <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Uji Injeksi Database</div>
                            </button>

                            <button type="button" onclick="window.ujiSimulasiSerangan('XSS')" style="background:#fefce8; border:1.5px solid #fef08a; border-radius:14px; padding:10px; text-align:left; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='#fef9c3'" onmouseout="this.style.background='#fefce8'">
                                <div style="font-size:0.75rem; font-weight:800; color:#a16207; display:flex; justify-content:space-between; align-items:center;">
                                    <span>XSS Scripts</span>
                                    <span id="secCountXss" style="background:#ca8a04; color:white; padding:1px 6px; border-radius:8px; font-size:0.7rem;">0</span>
                                </div>
                                <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Uji Injeksi Script</div>
                            </button>

                            <button type="button" onclick="window.ujiSimulasiSerangan('COMMAND_INJECTION')" style="background:#fdf2f8; border:1.5px solid #fbcfe8; border-radius:14px; padding:10px; text-align:left; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='#fce7f3'" onmouseout="this.style.background='#fdf2f8'">
                                <div style="font-size:0.75rem; font-weight:800; color:#9d174d; display:flex; justify-content:space-between; align-items:center;">
                                    <span>Command RCE</span>
                                    <span id="secCountRce" style="background:#db2777; color:white; padding:1px 6px; border-radius:8px; font-size:0.7rem;">0</span>
                                </div>
                                <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Uji Perintah Shell OS</div>
                            </button>

                            <button type="button" onclick="window.ujiSimulasiSerangan('PATH_TRAVERSAL')" style="background:#fff7ed; border:1.5px solid #ffedd5; border-radius:14px; padding:10px; text-align:left; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='#fed7aa'" onmouseout="this.style.background='#fff7ed'">
                                <div style="font-size:0.75rem; font-weight:800; color:#c2410c; display:flex; justify-content:space-between; align-items:center;">
                                    <span>Path Traversal</span>
                                    <span id="secCountTraversal" style="background:#ea580c; color:white; padding:1px 6px; border-radius:8px; font-size:0.7rem;">0</span>
                                </div>
                                <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Uji Direktori File</div>
                            </button>

                            <button type="button" onclick="window.ujiSimulasiSerangan('RECON_SCANNER')" style="background:#f5f3ff; border:1.5px solid #ddd6fe; border-radius:14px; padding:10px; text-align:left; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='#ede9fe'" onmouseout="this.style.background='#f5f3ff'">
                                <div style="font-size:0.75rem; font-weight:800; color:#6d28d9; display:flex; justify-content:space-between; align-items:center;">
                                    <span>Recon Bots</span>
                                    <span id="secCountRecon" style="background:#7c3aed; color:white; padding:1px 6px; border-radius:8px; font-size:0.7rem;">0</span>
                                </div>
                                <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Uji Scanner Probe</div>
                            </button>

                            <button type="button" onclick="window.ujiSimulasiSerangan('BRUTE_FORCE')" style="background:#f1f5f9; border:1.5px solid #cbd5e1; border-radius:14px; padding:10px; text-align:left; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                                <div style="font-size:0.75rem; font-weight:800; color:#334155; display:flex; justify-content:space-between; align-items:center;">
                                    <span>Brute Force</span>
                                    <span id="secCountBrute" style="background:#475569; color:white; padding:1px 6px; border-radius:8px; font-size:0.7rem;">0</span>
                                </div>
                                <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Uji Rate Limiting</div>
                            </button>
                        </div>
                    </div>

                    <!-- 3. TABEL LOG INSIDEN SERANGAN LIVE -->
                    <div style="background:#ffffff; border-radius:20px; padding:18px 20px; border:1.5px solid #e2e8f0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                            <h4 style="margin:0; font-size:1rem; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-list-alt text-emerald-600"></i> Audit Log Forensik Serangan Siber (Terbaru)
                            </h4>
                            <div style="display:flex; gap:8px;">
                                <button type="button" onclick="window.muatDaftarSerangan()" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:9999px; padding:5px 12px; font-size:0.75rem; font-weight:700; cursor:pointer;">
                                    <i class="fas fa-sync-alt"></i> Segarkan
                                </button>
                                <button type="button" onclick="window.bersihkanLogKeamanan()" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; border-radius:9999px; padding:5px 12px; font-size:0.75rem; font-weight:700; cursor:pointer;">
                                    <i class="fas fa-trash-alt"></i> Bersihkan Log
                                </button>
                            </div>
                        </div>

                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; text-align:left;">
                                <thead>
                                    <tr style="border-bottom:2px solid #e2e8f0; background:#f8fafc;">
                                        <th style="padding:10px 12px; font-size:0.75rem; font-weight:800; color:#475569; text-transform:uppercase;">Waktu</th>
                                        <th style="padding:10px 12px; font-size:0.75rem; font-weight:800; color:#475569; text-transform:uppercase;">IP Asal</th>
                                        <th style="padding:10px 12px; font-size:0.75rem; font-weight:800; color:#475569; text-transform:uppercase;">Jenis Serangan</th>
                                        <th style="padding:10px 12px; font-size:0.75rem; font-weight:800; color:#475569; text-transform:uppercase; text-align:center;">Tingkat Ancaman</th>
                                        <th style="padding:10px 12px; font-size:0.75rem; font-weight:800; color:#475569; text-transform:uppercase;">Cuplikan Payload</th>
                                        <th style="padding:10px 12px; font-size:0.75rem; font-weight:800; color:#475569; text-transform:uppercase; text-align:center;">Tindakan</th>
                                    </tr>
                                </thead>
                                <tbody id="secAttackLogTbody">
                                    <tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Memuat data deteksi...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Footer Modal -->
                <div style="padding:14px 24px; background:#f8fafc; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                    <div style="font-size:0.78rem; color:#64748b;">
                        <i class="fas fa-lock text-emerald-600"></i> Standar Perlindungan Data ISO/IEC 27001 & BSSN Sidoarjo.
                    </div>
                    <button type="button" onclick="window.tutupModalKeamananSiber()" style="background:#e2e8f0; color:#475569; border:none; border-radius:9999px; padding:8px 22px; font-size:0.85rem; font-weight:700; cursor:pointer;">Tutup</button>
                </div>
            </div>
        `;
        document.body.appendChild(div);
    }
})();
