def setup_security_headers(app):
    """Menerapkan konfigurasi header keamanan HTTP pada setiap response yang keluar."""
    @app.after_request
    def add_security_headers(response):
        # Mencegah website dimasukkan ke dalam iframe liar (Anti-Clickjacking / Phishing Framing)
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        
        # Mencegah peramban menebak MIME type berkas (Anti-MIME Sniffing)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        # Mengaktifkan filter XSS bawaan peramban
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Mengontrol pengiriman referensi URL ke peladen luar
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Membatasi izin akses hardware yang tidak relevan
        response.headers['Permissions-Policy'] = 'geolocation=(self), microphone=(self), camera=(self)'

        # Content-Security-Policy (CSP) yang mengizinkan CDN resmi, Leaflet Map, Google Fonts, & WebRTC
        csp_policy = (
            "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'; "
            "img-src 'self' http: https: data: blob: *.openstreetmap.org *.wikimedia.org; "
            "media-src 'self' http: https: data: blob:; "
            "connect-src 'self' http: https: ws: wss: *.openstreetmap.org *.peerjs.com; "
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com;"
        )
        response.headers['Content-Security-Policy'] = csp_policy

        return response