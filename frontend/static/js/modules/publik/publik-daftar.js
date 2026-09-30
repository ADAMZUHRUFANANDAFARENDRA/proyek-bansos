/**
 * Modul: publik-daftar.js
 * Deskripsi: Formulir pendaftaran mandiri bansos dan pemetaan titik koordinat Leaflet
 */

// 12. PENDAFTARAN MANDIRI & GEOTAGGING MAP LEAFLET
// =========================================================================
function initGeotaggingMap() {
    const box = document.getElementById('mapPublik') || document.getElementById('formCoordMapPublik');
    if (!box || typeof L === 'undefined') return;

    const defaultCoord = [-7.4478, 112.7183];
    if (mapGeotaggingInstance) {
        setTimeout(() => mapGeotaggingInstance.invalidateSize(), 200);
        return;
    }

    mapGeotaggingInstance = L.map(box, {
        center: defaultCoord,
        zoom: 13,
        attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(mapGeotaggingInstance);

    markerGeotaggingInstance = L.marker(defaultCoord, { draggable: true }).addTo(mapGeotaggingInstance);

    markerGeotaggingInstance.on('dragend', function (e) {
        const pos = e.target.getLatLng();
        window.updateAlamatPublikFromCoords(pos.lat, pos.lng);
    });

    mapGeotaggingInstance.on('click', function (e) {
        markerGeotaggingInstance.setLatLng(e.latlng);
        window.updateAlamatPublikFromCoords(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => mapGeotaggingInstance.invalidateSize(), 300);
}

window.updateAlamatPublikFromCoords = async function (lat, lng) {
    const latEl = document.getElementById('latPublik');
    const lngEl = document.getElementById('lngPublik');
    const alamatEl = document.getElementById('regAlamat');

    if (latEl) latEl.value = Number(lat).toFixed(6);
    if (lngEl) lngEl.value = Number(lng).toFixed(6);

    if (!alamatEl) return;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
                alamatEl.value = data.display_name;
            }
        }
    } catch (e) {}
};

window.ambilLokasiGPSPublik = function () {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (mapGeotaggingInstance && markerGeotaggingInstance) {
                mapGeotaggingInstance.setView([lat, lng], 16);
                markerGeotaggingInstance.setLatLng([lat, lng]);
            }
            window.updateAlamatPublikFromCoords(lat, lng);
        }, () => {
            showPortalAlert({ icon: 'warning', title: 'GPS Gagal', text: 'Izinkan akses geolokasi pada peramban gawai Anda.' });
        });
    }
};

window.cariAlamatPublik = async function (query) {
    if (!query || query.trim().length < 4) return;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Sidoarjo, Jawa Timur')}&limit=1`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                if (mapGeotaggingInstance && markerGeotaggingInstance) {
                    mapGeotaggingInstance.setView([lat, lng], 16);
                    markerGeotaggingInstance.setLatLng([lat, lng]);
                }
                const latEl = document.getElementById('latPublik');
                const lngEl = document.getElementById('lngPublik');
                if (latEl) latEl.value = lat.toFixed(6);
                if (lngEl) lngEl.value = lng.toFixed(6);
            }
        }
    } catch (e) {}
};

window.acakCaptchaPendaftaran = function () {
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 8) + 1;
    captchaAnswerPendaftaran = a + b;
    const el = document.getElementById('wargaCaptchaQ');
    if (el) el.innerText = `${a} + ${b} = ?`;
    const ansInp = document.getElementById('wargaCaptchaA');
    if (ansInp) ansInp.value = '';
};

window.daftarMandiri = window.kirimPendaftaranMandiri = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const ansInp = document.getElementById('wargaCaptchaA');
    if (ansInp && parseInt(ansInp.value.trim(), 10) !== captchaAnswerPendaftaran) {
        window.acakCaptchaPendaftaran();
        return showPortalAlert({ icon: 'warning', title: 'Verifikasi Gagal', text: 'Jawaban hitungan anti-bot salah! Silakan coba lagi.' });
    }

    const payload = {
        nik: document.getElementById('regNik')?.value.trim(),
        nama: document.getElementById('regNama')?.value.trim(),
        tempat_lahir: document.getElementById('regTempatLahir')?.value.trim() || 'Sidoarjo',
        tanggal_lahir: document.getElementById('regTglLahir')?.value || null,
        alamat: document.getElementById('regAlamat')?.value.trim(),
        lat: document.getElementById('latPublik')?.value.trim() || '-7.4478',
        lng: document.getElementById('lngPublik')?.value.trim() || '112.7183',
        no_hp: document.getElementById('regNoHp')?.value.trim() || '',
        email: document.getElementById('regEmail')?.value.trim() || '',
        c1: parseFloat(document.getElementById('regC1')?.value || 1200000),
        c2: parseInt(document.getElementById('regC2')?.value || 3000000),
        c3: parseInt(document.getElementById('regC3')?.value || 45),
        c4: parseInt(document.getElementById('regC4')?.value || 1),
        c5: parseInt(document.getElementById('regC5')?.value || 3),
        c6: parseInt(document.getElementById('regC6')?.value || 1),
        c7: parseInt(document.getElementById('regC7')?.value || 2),
        c8: parseInt(document.getElementById('regC8')?.value || 1),
        c9: parseInt(document.getElementById('regC9')?.value || 1),
        c10: parseInt(document.getElementById('regC10')?.value || 1),
        catatan: document.getElementById('regCatatan')?.value.trim() || 'Pendaftaran Mandiri Portal Warga'
    };

    if (!payload.nik || !payload.nama || payload.nik.length !== 16) {
        return showPortalAlert({ icon: 'warning', title: 'Data Belum Lengkap', text: 'NIK (16 digit) dan Nama Lengkap wajib diisi.' });
    }

    showPortalAlert({ title: 'Menyimpan Berkas...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        let res = await fetch(`${API_URL}/warga`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            res = await fetch(`${API_URL}/api/warga`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const json = await res.json().catch(() => ({}));
        Swal?.close();

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Berhasil Terdaftar!',
                text: 'Berkas Anda berhasil dicatat dan masuk status menunggu validasi petugas.',
                confirmButtonColor: '#009846'
            });
            document.getElementById('formPendaftaranWarga')?.reset();
            window.acakCaptchaPendaftaran();
            window.switchTabPublik('cekStatusSection');
            const cekInput = document.getElementById('cekNik') || document.getElementById('lacakNik');
            if (cekInput) cekInput.value = payload.nik;
        } else {
            showPortalAlert({ 
                icon: 'error', 
                title: 'Gagal Mendaftar', 
                text: json.message || 'Terjadi kesalahan saat memproses berkas pendaftaran.' 
            });
            window.acakCaptchaPendaftaran();
        }
    } catch (err) {
        Swal?.close();
        showPortalAlert({ 
            icon: 'error', 
            title: 'Koneksi Peladen Terputus', 
            html: '<p style="font-size:0.9rem;">Gagal mengirim berkas ke peladen. Pastikan backend Flask (<code>python app.py</code>) telah dijalankan.</p>' 
        });
        window.acakCaptchaPendaftaran();
    }
};

// =========================================================================
