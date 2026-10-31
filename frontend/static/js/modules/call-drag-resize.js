/**
 * =============================================================================
 * MODUL: call-drag-resize.js
 * Deskripsi: Interaksi Geser Mulus (Smooth Drag) & Ubah Ukuran Bebas (Resizable)
 * - Widget Minimized (Audio & Video) dapat digeser bebas di seluruh layar
 * - Layar Kecil (PiP) dapat digeser bebas di dalam area video, di-resize, dan diklik untuk Swap
 * =============================================================================
 */

(function (window) {
    'use strict';

    /**
     * Membuat kartu mini (minimized) dapat digeser bebas di viewport
     */
    function makeCardDraggable(element, options = {}) {
        if (!element) return;
        const {
            handleSelector = null,
            dragThreshold = 6,
            onDragStart = null,
            onDragEnd = null,
            onClick = null
        } = options;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;
        let hasMoved = false;

        element.addEventListener('pointerdown', (e) => {
            // Hindari tombol interaktif di dalam elemen atau jika baru saja selesai resize
            if (window.__callCardJustResized || e.target.closest('button') || e.target.closest('input') || e.target.closest('.min-resize-handle')) {
                return;
            }

            if (handleSelector && !e.target.closest(handleSelector)) {
                return;
            }

            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;

            const rect = element.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (!hasMoved && Math.hypot(dx, dy) > dragThreshold) {
                hasMoved = true;
                element.classList.add('is-being-dragged');

                // Lepaskan aturan sudut kaku CSS
                element.removeAttribute('data-min-corner');
                element.style.setProperty('position', 'fixed', 'important');
                element.style.setProperty('left', `${initialLeft}px`, 'important');
                element.style.setProperty('top', `${initialTop}px`, 'important');
                element.style.setProperty('right', 'auto', 'important');
                element.style.setProperty('bottom', 'auto', 'important');

                try { element.setPointerCapture(e.pointerId); } catch (err) {}
                if (typeof onDragStart === 'function') onDragStart();
            }

            if (hasMoved) {
                let newLeft = initialLeft + dx;
                let newTop = initialTop + dy;

                const maxLeft = window.innerWidth - element.offsetWidth - 8;
                const maxTop = window.innerHeight - element.offsetHeight - 8;
                newLeft = Math.max(8, Math.min(newLeft, maxLeft));
                newTop = Math.max(8, Math.min(newTop, maxTop));

                element.style.setProperty('left', `${newLeft}px`, 'important');
                element.style.setProperty('top', `${newTop}px`, 'important');
            }
        });

        const onPointerUp = (e) => {
            if (!isDragging) return;
            isDragging = false;
            try { element.releasePointerCapture(e.pointerId); } catch (err) {}

            element.classList.remove('is-being-dragged');

            if (hasMoved) {
                if (typeof onDragEnd === 'function') onDragEnd();
            } else {
                if (typeof onClick === 'function') onClick(e);
            }
            hasMoved = false;
        };

        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    }

    /**
     * Membuat container PiP dapat digeser bebas HANYA di dalam area video (tidak pernah melompat/hilang)
     */
    function makePipDraggable(pipElement, parentArea) {
        if (!pipElement || !parentArea) return;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;
        let hasMoved = false;
        let justDragged = false;

        pipElement.addEventListener('pointerdown', (e) => {
            // Hindari tombol aksi di dalam PiP
            if (e.target.closest('.pip-btn') || e.target.closest('.pip-resize-handle') || e.target.closest('button')) {
                return;
            }

            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;

            const pipRect = pipElement.getBoundingClientRect();
            const parentRect = parentArea.getBoundingClientRect();

            initialLeft = pipRect.left - parentRect.left;
            initialTop = pipRect.top - parentRect.top;
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (!hasMoved && Math.hypot(dx, dy) > 5) {
                hasMoved = true;
                justDragged = true;
                pipElement.classList.add('is-being-dragged');
                // Lepaskan aturan sudut kaku CSS agar inline positioning berlaku bebas
                pipElement.removeAttribute('data-pip-pos');
                try { pipElement.setPointerCapture(e.pointerId); } catch (err) {}
            }

            if (hasMoved) {
                const parentRect = parentArea.getBoundingClientRect();
                let newLeft = initialLeft + dx;
                let newTop = initialTop + dy;

                const maxLeft = parentRect.width - pipElement.offsetWidth - 8;
                const maxTop = parentRect.height - pipElement.offsetHeight - 8;
                newLeft = Math.max(8, Math.min(newLeft, maxLeft));
                newTop = Math.max(8, Math.min(newTop, maxTop));

                pipElement.style.setProperty('position', 'absolute', 'important');
                pipElement.style.setProperty('left', `${newLeft}px`, 'important');
                pipElement.style.setProperty('top', `${newTop}px`, 'important');
                pipElement.style.setProperty('right', 'auto', 'important');
                pipElement.style.setProperty('bottom', 'auto', 'important');
            }
        });

        const onPointerUp = (e) => {
            if (!isDragging) return;
            isDragging = false;
            try { pipElement.releasePointerCapture(e.pointerId); } catch (err) {}
            pipElement.classList.remove('is-being-dragged');

            if (hasMoved) {
                justDragged = true;
                setTimeout(() => { justDragged = false; }, 250);
            }
            hasMoved = false;
        };

        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);

        // Penanganan klik murni untuk tukar layar (Swap Views) tanpa double-firing
        pipElement.addEventListener('click', (e) => {
            if (justDragged) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }
            if (e.target.closest('.pip-btn') || e.target.closest('.pip-resize-handle')) {
                return;
            }
            const isWarga = Boolean(pipElement.id === 'wargaVideoPipContainer');
            if (isWarga && typeof window.swapVideoViewsWarga === 'function') {
                window.swapVideoViewsWarga(e);
            } else if (!isWarga && typeof window.swapVideoViews === 'function') {
                window.swapVideoViews(e);
            }
        });
    }

    /**
     * Membuat elemen dapat di-resize ukurannya menggunakan resize handle
     */
    function makeElementResizable(element, handle, options = {}) {
        if (!element || !handle) return;
        const { minWidth = 100, minHeight = 44, maxWidth = 800, maxHeight = 600 } = options;

        let isResizing = false;
        let startX = 0;
        let startY = 0;
        let startW = 0;
        let startH = 0;

        handle.addEventListener('pointerdown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            startW = rect.width;
            startH = rect.height;

            // Jika elemen memiliki aturan sudut kaku data-min-corner atau data-pip-pos,
            // lepaskan dan ubah ke posisi fixed/absolute saat ini agar resize bebas di segala dimensi
            if (element.hasAttribute('data-min-corner')) {
                element.removeAttribute('data-min-corner');
                element.style.setProperty('position', 'fixed', 'important');
                element.style.setProperty('left', `${rect.left}px`, 'important');
                element.style.setProperty('top', `${rect.top}px`, 'important');
                element.style.setProperty('right', 'auto', 'important');
                element.style.setProperty('bottom', 'auto', 'important');
            }

            element.classList.add('is-being-resized');

            try { handle.setPointerCapture(e.pointerId); } catch (err) {}
            e.stopPropagation();
            e.preventDefault();
        });

        const onResizeMove = (e) => {
            if (!isResizing) return;
            const dw = e.clientX - startX;
            const dh = e.clientY - startY;

            let newW = Math.max(minWidth, Math.min(maxWidth, startW + dw));
            let newH = Math.max(minHeight, Math.min(maxHeight, startH + dh));

            element.style.setProperty('width', `${newW}px`, 'important');
            element.style.setProperty('height', `${newH}px`, 'important');
        };

        const stopResize = (e) => {
            if (!isResizing) return;
            isResizing = false;
            try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
            element.classList.remove('is-being-resized');
            window.__callCardJustResized = true;
            setTimeout(() => {
                window.__callCardJustResized = false;
            }, 350);

            if (e && typeof e.stopPropagation === 'function') {
                e.stopPropagation();
            }
        };

        window.addEventListener('pointermove', onResizeMove);
        window.addEventListener('pointerup', stopResize, true);
        window.addEventListener('pointercancel', stopResize, true);

        // Blokir semua event klik residu dari handle agar tidak membubbles ke card atau bar
        handle.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
        }, true);

        // Blokir klik tak disengaja pada kartu saat pointer baru dilepas dari resize
        element.addEventListener('click', (e) => {
            if (window.__callCardJustResized) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);
    }

    // Inisialisasi Otomatis saat DOM Siap
    function initCallDragAndResize() {
        // 1. Aparatur Card Minimized (Audio & Video)
        const cardAdmin = document.getElementById('activeCallCard');
        if (cardAdmin) {
            makeCardDraggable(cardAdmin, {
                handleSelector: '.call-minimized-bar, .call-minimized-video-overlay',
                dragThreshold: 6
            });
            const handlesAdmin = cardAdmin.querySelectorAll('.min-resize-handle');
            handlesAdmin.forEach(handle => {
                makeElementResizable(cardAdmin, handle, { minWidth: 140, minHeight: 46, maxWidth: 800, maxHeight: 600 });
            });
        }

        // 2. Warga Card Minimized (Audio & Video)
        const cardWarga = document.getElementById('wargaActiveCallCard');
        if (cardWarga) {
            makeCardDraggable(cardWarga, {
                handleSelector: '.call-minimized-bar, .call-minimized-video-overlay',
                dragThreshold: 6
            });
            const handlesWarga = cardWarga.querySelectorAll('.min-resize-handle');
            handlesWarga.forEach(handle => {
                makeElementResizable(cardWarga, handle, { minWidth: 140, minHeight: 46, maxWidth: 800, maxHeight: 600 });
            });
        }

        // 3. PiP Container Aparatur (Geser Aman & Resize Bebas Dimensi)
        const pipAdmin = document.getElementById('videoPipContainer');
        const areaAdmin = document.getElementById('videoCallArea');
        if (pipAdmin && areaAdmin) {
            makePipDraggable(pipAdmin, areaAdmin);
            let resizeHandle = pipAdmin.querySelector('.pip-resize-handle');
            if (!resizeHandle) {
                resizeHandle = document.createElement('div');
                resizeHandle.className = 'pip-resize-handle';
                resizeHandle.title = 'Tarik untuk mengubah ukuran';
                pipAdmin.appendChild(resizeHandle);
            }
            makeElementResizable(pipAdmin, resizeHandle, { minWidth: 70, minHeight: 50, maxWidth: 640, maxHeight: 520 });
        }

        // 4. PiP Container Warga (Geser Aman & Resize Bebas Dimensi)
        const pipWarga = document.getElementById('wargaVideoPipContainer');
        const areaWarga = document.getElementById('wargaVideoCallArea');
        if (pipWarga && areaWarga) {
            makePipDraggable(pipWarga, areaWarga);
            let resizeHandleW = pipWarga.querySelector('.pip-resize-handle');
            if (!resizeHandleW) {
                resizeHandleW = document.createElement('div');
                resizeHandleW.className = 'pip-resize-handle';
                resizeHandleW.title = 'Tarik untuk mengubah ukuran';
                pipWarga.appendChild(resizeHandleW);
            }
            makeElementResizable(pipWarga, resizeHandleW, { minWidth: 70, minHeight: 50, maxWidth: 640, maxHeight: 520 });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCallDragAndResize);
    } else {
        initCallDragAndResize();
    }

    window.CallDragResize = {
        init: initCallDragAndResize,
        makeCardDraggable: makeCardDraggable,
        makePipDraggable: makePipDraggable,
        makeResizable: makeElementResizable
    };

})(window);
