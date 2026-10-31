/**
 * =============================================================================
 * MODUL: call-video-fx.js
 * Deskripsi: Bypass / Passthrough Mesin Video WebRTC Langsung (Pure WebRTC Stream)
 * Filter canvas dinonaktifkan sepenuhnya agar aliran video kamera & WebRTC 
 * berjalan 100% langsung (zero-latency, tanpa lag, hemat memori, dan bebas glitch).
 * =============================================================================
 */

(function (window) {
    'use strict';

    class VideoFXEngine {
        constructor() {
            this.beautyActive = false;
            this.blurActive = false;
            this.originalStream = null;
            this.processedStream = null;
            this.animFrameId = null;
            this.sourceVideo = null;
        }

        setupStream(rawStream) {
            // Langsung kembalikan rawStream kamera tanpa interferensi canvas
            return rawStream;
        }

        setBeauty(active) {
            this.beautyActive = false;
        }

        setBlur(active) {
            this.blurActive = false;
        }

        stop() {
            this.beautyActive = false;
            this.blurActive = false;
            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }
        }
    }

    window.VideoFXEngine = new VideoFXEngine();

})(window);
