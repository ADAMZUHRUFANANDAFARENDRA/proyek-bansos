/**
 * MODERN NOTIFICATIONS CORE ENGINE
 * Sistem Notifikasi Pop-Up Panel & Floating Toast Bebas Glitch, Bebas Tabrakan, & Ultra-Modern
 * Dirancang khusus agar tidak bertabrakan saat proses kalkulasi algoritma SPK maupun pemrosesan data arsip.
 */

// Helper Global: Penutupan Notifikasi Toast Cepat & Halus
window.dismissModernToast = function (targetEl, ev) {
    if (ev) {
        try {
            ev.preventDefault();
            ev.stopPropagation();
        } catch (e) {}
    }

    const toastCard = targetEl 
        ? (targetEl.closest ? (targetEl.closest('.modern-floating-toast-card') || targetEl.closest('.swal2-popup')) : null) 
        : document.querySelector('.modern-floating-toast-card, .swal2-popup.swal2-toast');

    if (toastCard) {
        toastCard.classList.add('toast-leaving');
        toastCard.style.opacity = '0';
        toastCard.style.transform = 'translateY(-20px) scale(0.92)';
        setTimeout(() => {
            try { toastCard.remove(); } catch (e) {}
            const container = document.getElementById('modernFloatingToastContainer');
            if (container && container.children.length === 0) {
                try { container.remove(); } catch (e) {}
            }
        }, 220);
    }

    try {
        if (typeof Swal !== 'undefined' && typeof Swal.close === 'function') {
            const swalToast = document.querySelector('.swal2-popup.swal2-toast');
            if (swalToast) {
                Swal.close();
            }
        }
    } catch (e) {}
};

(function () {
    // 1. Audio Sintesis Mikro: Feedback Harmonis Keberhasilan (Non-intrusive)
    function playSuccessChime() {
        if (window._isImportProcessing || window._isProcessingData || document.querySelector('.swal-modern-loading-card') || document.querySelector('.swal2-loading')) {
            return;
        }
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const now = ctx.currentTime;
            
            // Nada 1: C5 (523.25 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now);
            gain1.gain.setValueAtTime(0.04, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.18);

            // Nada 2: E5 (659.25 Hz)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.08);
            gain2.gain.setValueAtTime(0.05, now + 0.08);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.08);
            osc2.stop(now + 0.32);
        } catch (e) {}
    }

    // Helper Stempel Waktu Realtime WIB
    function getFormattedTimestamp() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss} WIB`;
    }

    // =========================================================================
    // 2. MESIN TOAST MELAYANG BEBAS TABRAKAN (DEDICATED FLOATING TOAST ENGINE)
    // Berjalan independen tanpa mengganggu popup modal tengah SweetAlert2!
    // =========================================================================
    function getOrCreateFloatingToastContainer() {
        let container = document.getElementById('modernFloatingToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'modernFloatingToastContainer';
            document.body.appendChild(container);
        }
        return container;
    }

    function createFloatingToast(titleOrConfig, maybeText, maybeOptions = {}) {
        playSuccessChime();

        let title = 'Operasi Berhasil!';
        let message = 'Tindakan yang Anda lakukan telah sukses diproses sistem.';
        let duration = 4000;
        let tagLabel = 'SINKRONISASI BANSOS';
        let tagIcon = 'fa-database';

        if (typeof titleOrConfig === 'object' && titleOrConfig !== null) {
            title = titleOrConfig.title || title;
            message = titleOrConfig.text || titleOrConfig.message || (titleOrConfig.html ? '' : message);
            duration = titleOrConfig.timer ? Math.max(Number(titleOrConfig.timer), 2500) : duration;
        } else if (typeof titleOrConfig === 'string') {
            title = titleOrConfig;
            if (typeof maybeText === 'string') message = maybeText;
            if (maybeOptions && maybeOptions.timer) duration = Math.max(Number(maybeOptions.timer), 2500);
        }

        const lowerTitle = (title || '').toLowerCase();
        if (lowerTitle.includes('kependudukan') || lowerTitle.includes('warga')) {
            tagLabel = 'DATA KEPENDUDUKAN';
            tagIcon = 'fa-users';
        } else if (lowerTitle.includes('perhitungan') || lowerTitle.includes('saw') || lowerTitle.includes('spk')) {
            tagLabel = 'SPK ALGORITMA';
            tagIcon = 'fa-calculator';
        } else if (lowerTitle.includes('salin') || lowerTitle.includes('copy') || lowerTitle.includes('klip')) {
            tagLabel = 'PAPAN KLIP';
            tagIcon = 'fa-copy';
        } else if (lowerTitle.includes('hapus')) {
            tagLabel = 'PENGHAPUSAN ARSIP';
            tagIcon = 'fa-trash-alt';
        }

        const timestampStr = getFormattedTimestamp();
        const container = getOrCreateFloatingToastContainer();

        // Batasi tumpukan maksimum 3 toast; yang terlama dihapus halus
        while (container.children.length >= 3) {
            const oldest = container.firstElementChild;
            if (oldest) oldest.remove();
            else break;
        }

        const card = document.createElement('div');
        card.className = 'modern-floating-toast-card';
        card.innerHTML = `
            <div class="modern-toast-inner">
                <div class="modern-toast-emblem">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <div class="modern-toast-content">
                    <div class="modern-toast-tag">
                        <i class="fas ${tagIcon}"></i> <span>${tagLabel}</span>
                    </div>
                    <div class="modern-toast-title">${title}</div>
                    ${message ? `<div class="modern-toast-desc">${message}</div>` : ''}
                    <div class="modern-toast-meta">
                        <i class="far fa-clock"></i> <span>${timestampStr}</span>
                    </div>
                </div>
                <button type="button" class="modern-toast-btn-close" aria-label="Tutup Notifikasi" title="Tutup Notifikasi">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="modern-floating-toast-progress" style="animation-duration: ${duration}ms;"></div>
        `;

        container.appendChild(card);

        // Bind multi-event pada tombol silang
        const closeBtn = card.querySelector('.modern-toast-btn-close');
        if (closeBtn) {
            ['click', 'mousedown', 'pointerdown', 'touchstart'].forEach((evtType) => {
                closeBtn.addEventListener(evtType, function (e) {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    window.dismissModernToast(card, e);
                }, true);
            });
        }

        // Timer otomatis dengan jeda saat di-hover
        let dismissTimer = null;
        const startTimer = () => {
            dismissTimer = setTimeout(() => {
                window.dismissModernToast(card);
            }, duration);
        };

        const stopTimer = () => {
            if (dismissTimer) clearTimeout(dismissTimer);
        };

        card.addEventListener('mouseenter', stopTimer);
        card.addEventListener('mouseleave', startTimer);
        startTimer();

        return Promise.resolve({ isConfirmed: false, isDismissed: true, value: true });
    }

    // =========================================================================
    // 3. PANEL POP-UP KEBERHASILAN UTAMA (MODERN POP-UP PANEL)
    // Menampilkan modal tengah modern, membulat, berstempel waktu & bebas tabrakan
    // =========================================================================
    let _lastSuccessModalTime = 0;
    let _lastSuccessModalTitle = '';

    function showModernSuccessPanel(configOrTitle, maybeText, maybeOptions) {
        let title = 'Operasi Berhasil!';
        let message = 'Tindakan yang Anda lakukan telah sukses diproses sistem.';
        let headerTag = 'Aksi Berhasil Diselesaikan';
        let auditInfo = 'Tersimpan & Terverifikasi';
        let confirmText = 'Oke, Mengerti';
        let timer = null;
        let onConfirm = null;
        let showConfirmButton = true;
        let htmlExtra = '';

        if (typeof configOrTitle === 'object' && configOrTitle !== null) {
            const c = configOrTitle;
            title = c.title || title;
            message = c.message || c.text || (c.html ? '' : message);
            htmlExtra = c.html || '';
            headerTag = c.headerTag || c.tag || headerTag;
            auditInfo = c.auditInfo || auditInfo;
            confirmText = c.confirmButtonText || c.confirmText || confirmText;
            timer = c.timer !== undefined ? c.timer : null;
            onConfirm = c.onConfirm || null;
            if (c.showConfirmButton !== undefined) showConfirmButton = c.showConfirmButton;
        } else if (typeof configOrTitle === 'string') {
            title = configOrTitle;
            if (typeof maybeText === 'string') {
                message = maybeText;
            }
            if (typeof maybeOptions === 'object' && maybeOptions !== null) {
                if (maybeOptions.headerTag) headerTag = maybeOptions.headerTag;
                if (maybeOptions.auditInfo) auditInfo = maybeOptions.auditInfo;
                if (maybeOptions.confirmButtonText) confirmText = maybeOptions.confirmButtonText;
                if (maybeOptions.timer !== undefined) timer = maybeOptions.timer;
                if (maybeOptions.onConfirm) onConfirm = maybeOptions.onConfirm;
                if (maybeOptions.showConfirmButton !== undefined) showConfirmButton = maybeOptions.showConfirmButton;
                if (maybeOptions.html) htmlExtra = maybeOptions.html;
            }
        }

        // Anti-collision debounce: cegah spam pemanggilan duplikat dalam 350ms
        const now = Date.now();
        if (now - _lastSuccessModalTime < 350 && _lastSuccessModalTitle === title) {
            return Promise.resolve({ isConfirmed: true, value: true });
        }
        _lastSuccessModalTime = now;
        _lastSuccessModalTitle = title;

        playSuccessChime();

        if (typeof Swal === 'undefined') {
            alert(`[BERHASIL] ${title}\n${message}`);
            if (typeof onConfirm === 'function') onConfirm();
            return Promise.resolve({ isConfirmed: true, value: true });
        }

        // Bersihkan seluruh status loading sebelumnya tanpa sisa
        try {
            if (typeof Swal.hideLoading === 'function') {
                Swal.hideLoading();
            }
        } catch (e) {}
        document.body.classList.remove('swal2-loading');

        // Bersihkan kelas popup & container sebelumnya jika ada
        const existingPopup = typeof Swal.getPopup === 'function' ? Swal.getPopup() : document.querySelector('.swal2-popup');
        if (existingPopup) {
            existingPopup.classList.remove(
                'swal2-loading',
                'swal-modern-loading-card',
                'swal2-toast',
                'swal-toast-modern-success',
                'swal-modern-toast-card'
            );
            const nativeLoader = existingPopup.querySelector('.swal2-loader');
            if (nativeLoader) nativeLoader.style.setProperty('display', 'none', 'important');
            const customLoader = existingPopup.querySelector('.modern-loading-animation');
            if (customLoader) {
                try { customLoader.remove(); } catch (_) {}
            }
        }

        const existingContainer = typeof Swal.getContainer === 'function' ? Swal.getContainer() : document.querySelector('.swal2-container');
        if (existingContainer) {
            existingContainer.classList.remove('swal2-loading', 'swal2-top-end', 'swal-toast-container-top-end');
            existingContainer.classList.add('swal2-center', 'swal-no-dark-backdrop');
            existingContainer.style.setProperty('background', 'transparent', 'important');
            existingContainer.style.setProperty('background-color', 'transparent', 'important');
        }

        const timestampStr = getFormattedTimestamp();

        // Konten HTML Khusus Panel Pop-Up Modern (Bersih, Rapi & Tidak Menumpuk Elemen Berlebihan)
        const contentHtml = `
            ${headerTag && !htmlExtra ? `
            <div class="modern-success-header-pill">
                <i class="fas fa-sparkles"></i> <span>${headerTag}</span>
            </div>` : ''}
            <div class="modern-success-emblem-wrapper">
                <div class="modern-success-emblem">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            </div>
            <div class="modern-success-title">${title}</div>
            <div class="modern-success-body">
                ${message ? `<div>${message}</div>` : ''}
                ${htmlExtra ? `<div style="margin-top:8px;">${htmlExtra}</div>` : ''}
            </div>
            ${!htmlExtra && auditInfo ? `
            <div class="modern-success-audit-badge">
                <span>Status: <b>${auditInfo}</b></span>
                <span class="sep">•</span>
                <i class="far fa-clock"></i>
                <span>${timestampStr}</span>
            </div>` : ''}
        `;

        const bindInteractiveElements = (popup) => {
            if (!popup) return;

            popup.classList.remove('swal2-loading', 'swal-modern-loading-card', 'swal2-toast');
            document.body.classList.remove('swal2-loading');

            const container = popup.closest('.swal2-container');
            if (container) {
                container.classList.remove('swal2-loading', 'swal2-top-end', 'swal-toast-container-top-end');
                container.classList.add('swal2-center', 'swal-no-dark-backdrop');
                container.style.setProperty('background', 'transparent', 'important');
                container.style.setProperty('background-color', 'transparent', 'important');
            }

            // 1. Tombol silang (X) terpasang responsif dan menutup modal seketika
            const closeBtns = popup.querySelectorAll('.swal2-close, .swal-close-modern, [aria-label="Close this dialog"]');
            closeBtns.forEach((closeBtn) => {
                closeBtn.removeAttribute('disabled');
                closeBtn.setAttribute('title', 'Tutup Notifikasi');
                closeBtn.setAttribute('aria-label', 'Tutup Notifikasi');
                closeBtn.style.setProperty('display', 'flex', 'important');
                closeBtn.style.setProperty('visibility', 'visible', 'important');
                closeBtn.style.setProperty('opacity', '1', 'important');
                closeBtn.style.setProperty('cursor', 'pointer', 'important');
                closeBtn.style.setProperty('pointer-events', 'auto', 'important');
                closeBtn.style.setProperty('z-index', '999999', 'important');

                closeBtn.onclick = () => {
                    try {
                        if (typeof Swal !== 'undefined' && typeof Swal.close === 'function') {
                            Swal.close();
                        }
                    } catch (_) {}
                    setTimeout(() => {
                        const c = document.querySelector('.swal2-container');
                        if (c && (!Swal.isVisible || !Swal.isVisible())) {
                            c.style.setProperty('display', 'none', 'important');
                        }
                    }, 120);
                };
            });

            // 2. Tombol konfirmasi responsif dan mengeksekusi onConfirm lalu menutup
            const confirmBtns = popup.querySelectorAll('.swal2-confirm, .swal-btn-modern-success, .swal-btn-pill-confirm, .swal-btn-pill-oke');
            confirmBtns.forEach((confirmBtn) => {
                confirmBtn.removeAttribute('disabled');
                confirmBtn.style.setProperty('display', 'inline-flex', 'important');
                confirmBtn.style.setProperty('visibility', 'visible', 'important');
                confirmBtn.style.setProperty('opacity', '1', 'important');
                confirmBtn.style.setProperty('cursor', 'pointer', 'important');
                confirmBtn.style.setProperty('pointer-events', 'auto', 'important');
                confirmBtn.style.setProperty('z-index', '999999', 'important');

                confirmBtn.onclick = () => {
                    if (typeof onConfirm === 'function') {
                        try { onConfirm(); } catch (_) {}
                    }
                    try {
                        if (typeof Swal !== 'undefined' && typeof Swal.close === 'function') {
                            Swal.close();
                        }
                    } catch (_) {}
                    setTimeout(() => {
                        const c = document.querySelector('.swal2-container');
                        if (c && (!Swal.isVisible || !Swal.isVisible())) {
                            c.style.setProperty('display', 'none', 'important');
                        }
                    }, 100);
                };
            });
        };

        // Bersihkan dan hilangkan ikon centang dari tombol konfirmasi agar tidak terjadi penumpukan elemen
        let finalConfirmText = (confirmText || 'Oke, Mengerti').trim();
        finalConfirmText = finalConfirmText.replace(/<i[^>]*fa-check[^>]*><\/i>\s*/gi, '').trim();
        if (!finalConfirmText) finalConfirmText = 'Oke, Mengerti';

        const swalOpts = {
            _isRaw: true,
            html: contentHtml,
            showConfirmButton: showConfirmButton,
            confirmButtonText: finalConfirmText,
            buttonsStyling: false,
            customClass: {
                container: 'swal-no-dark-backdrop swal2-center',
                popup: 'swal-modern-success-popup swal-modern-rounded',
                confirmButton: 'swal-btn-modern-success swal-btn-pill-confirm swal-btn-pill-oke',
                closeButton: 'swal-close-modern'
            },
            showCloseButton: true,
            closeButtonHtml: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
            allowOutsideClick: true,
            allowEscapeKey: true,
            timer: timer,
            timerProgressBar: Boolean(timer),
            backdrop: 'transparent',
            didOpen: (popup) => {
                bindInteractiveElements(popup);
                setTimeout(() => bindInteractiveElements(popup), 30);
                setTimeout(() => bindInteractiveElements(popup), 120);

                const btn = popup.querySelector('.swal2-confirm');
                if (btn) btn.focus();
            }
        };

        const executeRawFire = (typeof rawFire === 'function') ? rawFire : Swal.fire.bind(Swal);
        return executeRawFire(swalOpts).then((res) => {
            if (res.isConfirmed && typeof onConfirm === 'function') {
                onConfirm(res);
            }
            return res;
        });
    }

    // =========================================================================
    // 4. INTERCEPTOR GLOBAL SWEETALERT2:
    // Menghilangkan tabrakan (anti-collision) dan menyelaraskan seluruh notifikasi
    // =========================================================================
    function initSweetAlertSuccessInterceptor() {
        if (typeof Swal === 'undefined') return;

        if (Swal._modernSuccessIntercepted) return;
        Swal._modernSuccessIntercepted = true;

        const rawFire = Swal.fire.bind(Swal);

        Swal.fire = function (...args) {
            let firstArg = args[0];

            // A. KASUS TOAST (toast: true):
            if (typeof firstArg === 'object' && firstArg !== null && firstArg.toast) {
                return createFloatingToast(firstArg);
            }

            // B. KASUS SUKSES MODAL (icon === 'success' dan bukan toast):
            let isSuccessModal = false;
            if (typeof firstArg === 'object' && firstArg !== null) {
                if (firstArg.icon === 'success' && !firstArg.toast) {
                    isSuccessModal = true;
                }
            } else if (typeof firstArg === 'string') {
                if (args[1] === 'success' || args[2] === 'success') {
                    isSuccessModal = true;
                }
            }

            if (isSuccessModal && typeof firstArg === 'object' && firstArg !== null && !firstArg._isRaw) {
                return showModernSuccessPanel(firstArg);
            } else if (isSuccessModal && typeof firstArg === 'string') {
                const titleStr = firstArg;
                const bodyStr = typeof args[1] === 'string' && args[1] !== 'success' ? args[1] : '';
                return showModernSuccessPanel(titleStr, bodyStr);
            }

            // C. ALERT NON-TOAST LAINNYA (error, warning, info, loading):
            if (typeof firstArg === 'object' && firstArg !== null && !firstArg.toast) {
                if (!firstArg.backdrop || firstArg.backdrop === true) {
                    firstArg.backdrop = 'transparent';
                }
                const existingClass = firstArg.customClass || {};
                firstArg.customClass = Object.assign({}, existingClass, {
                    container: ((existingClass.container ? existingClass.container + ' ' : '') + 'swal-no-dark-backdrop').trim()
                });
                
                const origOpen = firstArg.didOpen;
                firstArg.didOpen = (popup) => {
                    const bindButtons = () => {
                        if (!popup) return;
                        
                        const isLoading = popup.classList.contains('swal-modern-loading-card') || popup.classList.contains('swal2-loading');
                        if (!isLoading) {
                            document.body.classList.remove('swal2-loading');
                        }

                        const closeBtns = popup.querySelectorAll('.swal2-close, .swal-close-modern');
                        closeBtns.forEach((closeBtn) => {
                            closeBtn.removeAttribute('disabled');
                            closeBtn.style.setProperty('cursor', 'pointer', 'important');
                            closeBtn.style.setProperty('pointer-events', 'auto', 'important');
                            closeBtn.style.setProperty('z-index', '999999', 'important');
                            closeBtn.style.setProperty('display', 'flex', 'important');
                            closeBtn.onclick = () => {
                                try {
                                    if (typeof Swal !== 'undefined' && typeof Swal.close === 'function') {
                                        Swal.close();
                                    }
                                } catch (_) {}
                            };
                        });

                        const confirmBtns = popup.querySelectorAll('.swal2-confirm, .swal-btn-pill-oke, .swal-btn-pill-confirm, .swal-btn-pill-primary');
                        confirmBtns.forEach((confirmBtn) => {
                            confirmBtn.removeAttribute('disabled');
                            confirmBtn.style.setProperty('cursor', 'pointer', 'important');
                            confirmBtn.style.setProperty('pointer-events', 'auto', 'important');
                            confirmBtn.style.setProperty('z-index', '99999999', 'important');
                        });
                    };

                    bindButtons();
                    setTimeout(bindButtons, 40);

                    if (typeof origOpen === 'function') {
                        try { origOpen(popup); } catch (e) {}
                    }
                };
            }

            return rawFire(...args);
        };
    }

    // Inisialisasi saat script dimuat & saat DOM ready
    if (typeof Swal !== 'undefined') {
        initSweetAlertSuccessInterceptor();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof Swal !== 'undefined') {
                initSweetAlertSuccessInterceptor();
            }
        });
    }

    // Helper dedicated untuk floating toast panel modern
    function showModernToast(title, text, options = {}) {
        return createFloatingToast(title, text, options);
    }

    // Expose Global API
    window.showModernSuccessPanel = showModernSuccessPanel;
    window.showSuccessPopup = showModernSuccessPanel;
    window.showModernToast = showModernToast;
    window.playSuccessChime = playSuccessChime;
})();
