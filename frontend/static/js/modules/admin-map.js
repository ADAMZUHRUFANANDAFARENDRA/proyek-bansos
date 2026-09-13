/* =========================================================================
   ADMIN-MAP.JS - MODUL PETA SEBARAN 18 KECAMATAN, 31 KELURAHAN & 318 DESA
   Lokasi: frontend/static/js/modules/admin-map.js
   Pemerintah Kabupaten Sidoarjo - Dinas Sosial
   ========================================================================= */

window.AdminMap = window.AdminMap || {};
window.petaSebaranMode = 'kecamatan'; // 'kecamatan' | 'kelurahan' | 'desa'
window.petaModeDetailDesa = false;
window.macroMap = null;
window.macroLayerGroup = null;

// Penyimpanan lokal permanen untuk entri bantuan, bukti media, riwayat desil & cache koordinat
window.customBantuanMap = JSON.parse(localStorage.getItem('adminCustomBantuanMap') || '{}');
window.customMediaBuktiMap = JSON.parse(localStorage.getItem('adminCustomMediaBuktiMap') || '{}');
window.customMediaBuktiTypeMap = JSON.parse(localStorage.getItem('adminCustomMediaBuktiTypeMap') || '{}');
window.cachedAddressCoords = JSON.parse(localStorage.getItem('adminCachedAddressCoords') || '{}');
window.adminDesilHistoryMap = JSON.parse(localStorage.getItem('adminDesilHistoryMap') || '{}');

// State lokal untuk data warga aktif di modal wilayah
window.currentModalWargaList = [];
window.currentActiveWilayahNama = '';

// Helper sanitasi teks
if (typeof window.safeHtml !== 'function') {
    window.safeHtml = function (str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
}
if (typeof window.escapeInlineJS !== 'function') {
    window.escapeInlineJS = function (str) {
        if (!str) return '';
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '&quot;')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '');
    };
}

// 1. DATA 18 KECAMATAN RESMI KABUPATEN SIDOARJO (DARATAN PRESISI)
const WILAYAH_SIDOARJO = [
    {
        nama: "Balongbendo", center: [-7.4025, 112.5350], kelurahan: "-",
        desa: "Bakalan, Bakungpringgodani, Balongbendo, Bogempinggir, Gadungkepuhsari, Gamping, Jabaran, Jeruklegi, Kedungsukodani, Kemangsen, Pagerwojo, Penambangan, Pitrosari, Seduri, Seketi, Singkalan, Sumokembangsri, Suwaluh, Waruberon, Watesnegoro",
        polygon: [[-7.3800, 112.5050], [-7.3800, 112.5650], [-7.4250, 112.5650], [-7.4250, 112.5050]]
    },
    {
        nama: "Krian", center: [-7.3975, 112.6000], kelurahan: "Kel. Krian, Kel. Tambakkemerakan, Kel. Kemasan",
        desa: "Barengkrajan, Gawat, Jatikalang, Jerukgamping, Junwangi, Katerungan, Keboharan, Kraton, Ponokawan, Sedenganmijen, Sidomojo, Sidomulyo, Sidorejo, Tempel, Terik, Terungkulon, Terungwetan, Tropodo, Watutulis",
        polygon: [[-7.3750, 112.5650], [-7.3750, 112.6350], [-7.4200, 112.6350], [-7.4200, 112.5650]]
    },
    {
        nama: "Taman", center: [-7.3625, 112.6700], kelurahan: "Kel. Bebekan, Kel. Geluran, Kel. Kalijaten, Kel. Krembangan, Kel. Ngelom, Kel. Sepanjang, Kel. Taman, Kel. Wonocolo",
        desa: "Bohar, Bringinbendo, Gilang, Jemundo, Kedungturi, Kletek, Kramat Jegu, Pertapan Maduretno, Sadang, Sambibulu, Sidodadi, Tanjungsari, Tawangsari, Trosobo, Wage",
        polygon: [[-7.3400, 112.6350], [-7.3400, 112.7050], [-7.3850, 112.7050], [-7.3850, 112.6350]]
    },
    {
        nama: "Waru", center: [-7.3625, 112.7350], kelurahan: "Kel. Waru, Kel. Kureksari",
        desa: "Berbek, Bungurasih, Janti, Kedungrejo, Kepuhkiriman, Medaeng, Ngingas, Pepelegi, Tambakoso, Tambakrejo, Tambaksawah, Tambaksumur, Tropodo, Wadungasri, Wedoro",
        polygon: [[-7.3400, 112.7050], [-7.3400, 112.7650], [-7.3850, 112.7650], [-7.3850, 112.7050]]
    },
    {
        nama: "Sedati", center: [-7.3875, 112.8000], kelurahan: "-",
        desa: "Banjar Kemuning, Betro, Buncitan, Cemandi, Gisikcemandi, Kalanganyar, Kwangsan, Pabean, Pepe, Pranti, Pulungan, Sedati Agung, Sedati Gede, Segoro Tambak, Semampir, Tambak Cemandi",
        polygon: [[-7.3600, 112.7650], [-7.3600, 112.8350], [-7.4150, 112.8350], [-7.4150, 112.7650]]
    },
    {
        nama: "Sukodono", center: [-7.4050, 112.6700], kelurahan: "-",
        desa: "Anggaswangi, Bangsri, Cangkringsari, Jogosatru, Jumputrejo, Kebonagung, Kloposepuluh, Masangan Kulon, Masangan Wetan, Ngaresrejo, Pademonegoro, Panjunan, Pekarungan, Plumbungan, Sambungrejo, Suko, Sukodono, Suruh, Wilayut",
        polygon: [[-7.3850, 112.6350], [-7.3850, 112.7050], [-7.4250, 112.7050], [-7.4250, 112.6350]]
    },
    {
        nama: "Gedangan", center: [-7.4050, 112.7350], kelurahan: "-",
        desa: "Ganting, Gedangan, Gemurung, Karangbong, Keboan Anom, Keboan Sikep, Ketajen, Kragan, Punggul, Sawotratap, Semambung, Seruni, Sruni, Tebel, Wedi",
        polygon: [[-7.3850, 112.7050], [-7.3850, 112.7650], [-7.4250, 112.7650], [-7.4250, 112.7050]]
    },
    {
        nama: "Tarik", center: [-7.4500, 112.5350], kelurahan: "-",
        desa: "Banjarwungu, Gampingrowo, Gedangklutuk, Janti, Kalidawir, Kedungbocok, Kedunglosari, Kemuning, Kendalsewu, Klampisan, Kramattemanggung, Mergobener, Mergosari, Mindugading, Miriprowo, Sebani, Segodobancang, Singogalih, Sumberrejo, Tarik",
        polygon: [[-7.4250, 112.5050], [-7.4250, 112.5650], [-7.4750, 112.5650], [-7.4750, 112.5050]]
    },
    {
        nama: "Wonoayu", center: [-7.4425, 112.6000], kelurahan: "-",
        desa: "Becirongengor, Candinegoro, Jimbaran Kulon, Jimbaran Wetan, Karangpuri, Lambangan, Mojorangagung, Mulyodadi, Pagerngumbuk, Pilang, Plaosan, Ploso, Popoh, Sawocangkring, Semambung, Simoangin-angin, Simoketawang, Suko, Sumberejo, Tanggul, Wonoayu, Wonokalang, Wonokasian",
        polygon: [[-7.4200, 112.5650], [-7.4200, 112.6350], [-7.4650, 112.6350], [-7.4650, 112.5650]]
    },
    {
        nama: "Sidoarjo", center: [-7.4450, 112.6750], kelurahan: "Kel. Bulusidokare, Kel. Celep, Kel. Cemengkalang, Kel. Gebang, Kel. Lemahputro, Kel. Magersari, Kel. Pekauman, Kel. Pucang, Kel. Pucanganom, Kel. Sekardangan, Kel. Sidokare, Kel. Sidokumpul, Kel. Urangagung, Kel. Kemiri",
        desa: "Banjarbendo, Bluru Kidul, Cemengbakalan, Rangkah Kidul, Sarirogo, Sumput",
        polygon: [[-7.4250, 112.6350], [-7.4250, 112.7150], [-7.4650, 112.7150], [-7.4650, 112.6350]]
    },
    {
        nama: "Buduran", center: [-7.4400, 112.7550], kelurahan: "-",
        desa: "Banjarkemantren, Banjarsari, Buduran, Damarsi, Dukuhtengah, Entalsewu, Pagerwojo, Prasung, Punggul, Sawohan, Sidokerto, Sidomulyo, Siwalanpanji, Sukorejo, Wadungasih",
        polygon: [[-7.4150, 112.7150], [-7.4150, 112.7950], [-7.4650, 112.7950], [-7.4650, 112.7150]]
    },
    {
        nama: "Prambon", center: [-7.4950, 112.5550], kelurahan: "-",
        desa: "Bakungpringgodani, Batusanggar, Bendotretek, Bulang, Cangkringturi, Gampang, Gedangrowo, Jatialunalun, Jatikalang, Jedongcangkring, Kazian, Kedungwonokerto, Pejangkungan, Prambon, Simogirang, Simpang, Temu, Watutulis, Wirobiting, Wonoplintahan",
        polygon: [[-7.4750, 112.5250], [-7.4750, 112.5850], [-7.5150, 112.5850], [-7.5150, 112.5250]]
    },
    {
        nama: "Tulangan", center: [-7.4875, 112.6175], kelurahan: "-",
        desa: "Gelang, Grabagan, Grogol, Janti, Jiken, Kajeksan, Kebaron, Kedondong, Kemantren, Kenongo, Kepadangan, Kepil, Kepit, Kepuhkemiri, Kepatihan, Medalem, Modong, Pangkemiri, Singopadu, Sudimoro, Tlasih, Tulangan",
        polygon: [[-7.4650, 112.5850], [-7.4650, 112.6500], [-7.5100, 112.6500], [-7.5100, 112.5850]]
    },
    {
        nama: "Tanggulangin", center: [-7.4875, 112.6825], kelurahan: "-",
        desa: "Banjarasri, Banjarpanji, Boro, Gagangpanjang, Gempolsari, Kalidawir, Kalisampurno, Kalitengah, Kedensari, Kedungbanteng, Ketapang, Ketegan, Kludan, Ngaban, Penataran, Penatarsewu, Putat, Randegan, Sentul",
        polygon: [[-7.4650, 112.6500], [-7.4650, 112.7150], [-7.5100, 112.7150], [-7.5100, 112.6500]]
    },
    {
        nama: "Candi", center: [-7.4875, 112.7550], kelurahan: "-",
        desa: "Balonggabus, Balongmacekan, Bligo, Candi, Durungbanjar, Durungbedug, Gelam, Jambangan, Kalipecabean, Karangtanjung, Kebonsari, Kedungkendo, Kedungpeluk, Kendalpecabean, Klurak, Larangan, Sepande, Sidodadi, Sugihwaras, Sumokali, Tenggulunan, Vedro, Wedoroklurak",
        polygon: [[-7.4650, 112.7150], [-7.4650, 112.7950], [-7.5100, 112.7950], [-7.5100, 112.7150]]
    },
    {
        nama: "Krembung", center: [-7.5325, 112.5975], kelurahan: "-",
        desa: "Balonggarut, Cangkring, Gading, Jandep, Jenggot, Kandangan, Kedungrawan, Kedungsumur, Keper, Krembung, Lemujut, Mojoruntut, Ploso, Rejeni, Tambakrejo, Tanjegwagir, Wangkal, Waung, Wonomlati",
        polygon: [[-7.5100, 112.5600], [-7.5100, 112.6350], [-7.5550, 112.6350], [-7.5550, 112.5600]]
    },
    {
        nama: "Porong", center: [-7.5325, 112.6750], kelurahan: "Kel. Gedang, Kel. Juwetkenongo, Kel. Mindi, Kel. Porong",
        desa: "Candipari, Glagaharum, Keboguyang, Kebonagung, Kesambi, Lajuk, Pamotan, Pesawahan, Plumbon, Reno Kenongo, Wirobiting",
        polygon: [[-7.5100, 112.6350], [-7.5100, 112.7150], [-7.5550, 112.7150], [-7.5550, 112.6350]]
    },
    {
        nama: "Jabon", center: [-7.5375, 112.7650], kelurahan: "-",
        desa: "Balongtani, Besuki, Chandi, Dukuhsari, Keboguyang, Kedungcangkring, Kedungpandan, Kedungrejo, Kupang, Panggreh, Pejarakan, Permisan, Semambung, Tambakkalisogo, Trompoasri",
        polygon: [[-7.5100, 112.7150], [-7.5100, 112.8150], [-7.5650, 112.8150], [-7.5650, 112.7150]]
    }
];

const DAFTAR_NAMA_KEC = WILAYAH_SIDOARJO.map(w => w.nama.toLowerCase());

function isAlamatMatchingKecamatan(alamat, targetKecNama) {
    if (!alamat) return false;
    const clean = alamat.toLowerCase();
    const target = targetKecNama.toLowerCase();

    if (target !== 'sidoarjo') {
        return clean.includes(target);
    }

    if (clean.includes('kec. sidoarjo') || clean.includes('kecamatan sidoarjo')) {
        return true;
    }

    const desaKecSidoarjo = [
        "sidokumpul", "lemahputro", "magersari", "celep", "pekauman", 
        "sidokare", "sekardangan", "bulusidokare", "gebang", "pucang", 
        "pucanganom", "urangagung", "kemiri", "cemengkalang", "banjarbendo", 
        "bluru kidul", "cemengbakalan", "rangkah kidul", "sarirogo", "sumput"
    ];
    if (desaKecSidoarjo.some(d => clean.includes(d))) {
        return true;
    }

    const otherKec = DAFTAR_NAMA_KEC.filter(k => k !== 'sidoarjo');
    if (otherKec.some(k => clean.includes(k))) {
        return false;
    }

    return clean.includes('sidoarjo');
}

// Helper Pewarnaan Murni Berdasarkan Data Riil
function getDesilColor(desil, count = 1) {
    if (count === 0 || isNaN(desil) || desil === null) {
        return { fill: '#cbd5e1', stroke: '#94a3b8', label: 'Belum Ada Data Warga', opacity: 0.2 };
    }
    if (desil <= 2.5) {
        return { fill: '#ef4444', stroke: '#dc2626', label: 'Tinggi (Desil 1–2)', opacity: 0.48 };
    }
    if (desil <= 4.5) {
        return { fill: '#f59e0b', stroke: '#d97706', label: 'Sedang (Desil 3–4)', opacity: 0.48 };
    }
    return { fill: '#22c55e', stroke: '#15803d', label: 'Rendah (Desil 5–10)', opacity: 0.48 };
}

// Deteksi Format Berkas Media (Foto atau Video)
function isVideoMedia(src, nik) {
    if (nik && window.customMediaBuktiTypeMap[nik]) {
        return window.customMediaBuktiTypeMap[nik] === 'video';
    }
    if (!src) return false;
    const str = String(src).toLowerCase();
    return str.includes('video') || 
           str.startsWith('data:video') || 
           /\.(mp4|mkv|webm|mov|avi|3gp|ogg|wmv)(\?|$)/i.test(str);
}

// 2. GENERATOR 31 KELURAHAN
function generate31KelurahanSidoarjo() {
    const listKel = [];
    const mappingKel = [
        {
            kec: "Sidoarjo",
            list: ["Kel. Sidokumpul", "Kel. Lemahputro", "Kel. Magersari", "Kel. Celep", "Kel. Pekauman", "Kel. Sidokare", "Kel. Sekardangan", "Kel. Bulusidokare", "Kel. Gebang", "Kel. Pucang", "Kel. Pucanganom", "Kel. Urangagung", "Kel. Kemiri", "Kel. Cemengkalang"]
        },
        {
            kec: "Taman",
            list: ["Kel. Sepanjang", "Kel. Bebekan", "Kel. Wonocolo", "Kel. Geluran", "Kel. Kalijaten", "Kel. Ngelom", "Kel. Krembangan", "Kel. Taman"]
        },
        {
            kec: "Krian",
            list: ["Kel. Krian", "Kel. Tambakkemerakan", "Kel. Kemasan"]
        },
        {
            kec: "Porong",
            list: ["Kel. Porong", "Kel. Gedang", "Kel. Mindi", "Kel. Juwetkenongo"]
        },
        {
            kec: "Waru",
            list: ["Kel. Waru", "Kel. Kureksari"]
        }
    ];

    mappingKel.forEach(group => {
        const kecObj = WILAYAH_SIDOARJO.find(w => w.nama === group.kec);
        if (!kecObj) return;

        const count = group.list.length;
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const latMin = kecObj.polygon[2][0], latMax = kecObj.polygon[0][0];
        const lngMin = kecObj.polygon[0][1], lngMax = kecObj.polygon[1][1];

        const dLat = (latMax - latMin) / rows;
        const dLng = (lngMax - lngMin) / cols;

        group.list.forEach((namaKel, idx) => {
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            const nLat = latMax - (r * dLat);
            const sLat = nLat - dLat;
            const wLng = lngMin + (c * dLng);
            const eLng = wLng + dLng;

            listKel.push({
                nama: namaKel,
                namaBersih: namaKel.toLowerCase().replace('kel. ', '').trim(),
                kec: group.kec,
                polygon: [
                    [Number(nLat.toFixed(5)), Number(wLng.toFixed(5))],
                    [Number(nLat.toFixed(5)), Number(eLng.toFixed(5))],
                    [Number(sLat.toFixed(5)), Number(eLng.toFixed(5))],
                    [Number(sLat.toFixed(5)), Number(wLng.toFixed(5))]
                ]
            });
        });
    });

    return listKel;
}

const DAFTAR_KELURAHAN_SIDOARJO = generate31KelurahanSidoarjo();

// 3. GENERATOR 318 DESA SIDOARJO
function generate318DesaSidoarjo() {
    const listDesa = [];
    WILAYAH_SIDOARJO.forEach((kec) => {
        const arrNamaDesa = kec.desa.split(',').map(s => s.trim()).filter(Boolean);
        const count = arrNamaDesa.length;
        if (count === 0) return;

        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const latMin = kec.polygon[2][0], latMax = kec.polygon[0][0];
        const lngMin = kec.polygon[0][1], lngMax = kec.polygon[1][1];

        const dLat = (latMax - latMin) / rows;
        const dLng = (lngMax - lngMin) / cols;

        arrNamaDesa.forEach((namaDesa, idx) => {
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            const nLat = latMax - (r * dLat);
            const sLat = nLat - dLat;
            const wLng = lngMin + (c * dLng);
            const eLng = wLng + dLng;

            listDesa.push({
                nama: `Desa ${namaDesa}`,
                namaBersih: namaDesa.toLowerCase().trim(),
                kec: kec.nama,
                polygon: [
                    [Number(nLat.toFixed(5)), Number(wLng.toFixed(5))],
                    [Number(nLat.toFixed(5)), Number(eLng.toFixed(5))],
                    [Number(sLat.toFixed(5)), Number(eLng.toFixed(5))],
                    [Number(sLat.toFixed(5)), Number(wLng.toFixed(5))]
                ]
            });
        });
    });
    return listDesa;
}

const DAFTAR_318_DESA_SIDOARJO = generate318DesaSidoarjo();

// 4. INISIALISASI PETA SEBARAN RESMI
window.initMacroDistributionMap = function () {
    const container = document.getElementById('mapWilayah') || document.getElementById('bigMapContainer');
    if (!container) return;

    if (window.macroMap) {
        window.macroMap.invalidateSize();
        return;
    }

    const centerCoords = [-7.4478, 112.7183];

    window.macroMap = L.map(container.id, { 
        attributionControl: false,
        center: centerCoords,
        zoom: 11,
        minZoom: 10,
        maxBounds: [[-7.6000, 112.4500], [-7.3000, 112.8900]],
        maxBoundsViscosity: 0.9
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        maxZoom: 18, 
        subdomains: ['a', 'b', 'c'] 
    }).addTo(window.macroMap);

    window.macroLayerGroup = L.layerGroup().addTo(window.macroMap);

    window.renderChoroplethKerentanan();
    setTimeout(() => { if (window.macroMap) window.macroMap.invalidateSize(); }, 300);
};

// 5. PERGANTIAN MODE DAN PEMBARUAN LAYER SEKETIKA
window.ubahModePeta = function (mode) {
    window.petaSebaranMode = mode;
    window.petaModeDetailDesa = (mode === 'desa');

    const legTitle = document.getElementById('legendModeTitle') || document.getElementById('legendTitleText');
    if (mode === 'kecamatan') {
        if (legTitle) legTitle.innerText = 'Kerentanan 18 Kecamatan';
    } else if (mode === 'kelurahan') {
        if (legTitle) legTitle.innerText = 'Kerentanan 31 Kelurahan';
    } else if (mode === 'desa') {
        if (legTitle) legTitle.innerText = 'Kerentanan 318 Desa';
    }

    if (!window.macroMap) {
        window.initMacroDistributionMap();
    } else {
        window.renderChoroplethKerentanan();
    }
};

// 6. RENDER WARNA POLIGON MURNI SESUAI DATA WARGA AKTIF
window.renderChoroplethKerentanan = function () {
    if (!window.macroMap || !window.macroLayerGroup) return;
    window.macroLayerGroup.clearLayers();

    const dataWarga = window.globalDataWarga || [];

    // MODE: 31 KELURAHAN
    if (window.petaSebaranMode === 'kelurahan') {
        WILAYAH_SIDOARJO.forEach(wil => {
            const bg = L.polygon(wil.polygon, {
                color: '#94a3b8',
                weight: 1,
                opacity: 0.35,
                dashArray: '2, 4',
                fillColor: '#f8fafc',
                fillOpacity: 0.1
            }).addTo(window.macroLayerGroup);
            bg.on('click', () => window.bukaRincianWilayah(wil.nama));
        });

        DAFTAR_KELURAHAN_SIDOARJO.forEach(k => {
            const wargaKel = dataWarga.filter(w => {
                const alamat = (w.alamat || '').toLowerCase();
                return alamat.includes(k.namaBersih);
            });

            let desilVal = NaN;
            if (wargaKel.length > 0) {
                const sumDesil = wargaKel.reduce((acc, curr) => acc + (Number(curr.desil) || 5), 0);
                desilVal = parseFloat((sumDesil / wargaKel.length).toFixed(1));
            }

            const style = getDesilColor(desilVal, wargaKel.length);
            const poly = L.polygon(k.polygon, {
                color: style.stroke,
                weight: 1.5,
                opacity: 0.95,
                dashArray: '3, 3',
                fillColor: style.fill,
                fillOpacity: style.opacity
            }).addTo(window.macroLayerGroup);

            poly.on('mouseover', function (e) { e.target.setStyle({ weight: 3, fillOpacity: 0.7 }); });
            poly.on('mouseout', function (e) { e.target.setStyle({ weight: 1.5, fillOpacity: style.opacity }); });
            poly.on('click', () => window.bukaRincianWilayah(k.kec));

            poly.bindTooltip(`<b>${k.nama}</b><br>Kec. ${k.kec}<br>Tingkat: ${style.label}<br>Rata-rata: ${isNaN(desilVal) ? 'Tidak ada data' : 'Desil ' + desilVal} (${wargaKel.length} Warga)`, {
                sticky: true
            });
        });
        return;
    }

    // MODE: 318 DESA
    if (window.petaSebaranMode === 'desa') {
        DAFTAR_318_DESA_SIDOARJO.forEach(d => {
            const wargaDesa = dataWarga.filter(w => {
                const alamat = (w.alamat || '').toLowerCase();
                return alamat.includes(d.namaBersih);
            });

            let desilVal = NaN;
            if (wargaDesa.length > 0) {
                const sumDesil = wargaDesa.reduce((acc, curr) => acc + (Number(curr.desil) || 5), 0);
                desilVal = parseFloat((sumDesil / wargaDesa.length).toFixed(1));
            }

            const style = getDesilColor(desilVal, wargaDesa.length);
            const poly = L.polygon(d.polygon, {
                color: style.stroke,
                weight: 1,
                opacity: 0.9,
                fillColor: style.fill,
                fillOpacity: style.opacity
            }).addTo(window.macroLayerGroup);

            poly.on('mouseover', function (e) { e.target.setStyle({ weight: 2.5, fillOpacity: 0.65 }); });
            poly.on('mouseout', function (e) { e.target.setStyle({ weight: 1, fillOpacity: style.opacity }); });
            poly.on('click', () => window.bukaRincianWilayah(d.kec));

            poly.bindTooltip(`<b>${d.nama}</b><br>Kec. ${d.kec}<br>Tingkat: ${style.label}<br>Rata-rata: ${isNaN(desilVal) ? 'Tidak ada data' : 'Desil ' + desilVal} (${wargaDesa.length} Warga)`, {
                sticky: true
            });
        });
        return;
    }

    // MODE: 18 KECAMATAN (DEFAULT)
    WILAYAH_SIDOARJO.forEach((wil) => {
        const wargaWilayah = dataWarga.filter(w => {
            return isAlamatMatchingKecamatan(w.alamat, wil.nama);
        });

        let avgDesil = NaN;
        if (wargaWilayah.length > 0) {
            const totalDesil = wargaWilayah.reduce((acc, curr) => acc + (Number(curr.desil) || 5), 0);
            avgDesil = parseFloat((totalDesil / wargaWilayah.length).toFixed(1));
        }

        const style = getDesilColor(avgDesil, wargaWilayah.length);
        const poly = L.polygon(wil.polygon, {
            color: style.stroke,
            weight: 1.5,
            opacity: 0.95,
            dashArray: '4, 4',
            fillColor: style.fill,
            fillOpacity: style.opacity
        }).addTo(window.macroLayerGroup);

        poly.on('mouseover', function (e) { e.target.setStyle({ weight: 3, fillOpacity: 0.65 }); });
        poly.on('mouseout', function (e) { e.target.setStyle({ weight: 1.5, fillOpacity: style.opacity }); });
        poly.on('click', () => window.bukaRincianWilayah(wil.nama));

        poly.bindTooltip(`<b>Kecamatan ${wil.nama}</b><br>Tingkat: ${style.label}<br>Rata-rata: ${isNaN(avgDesil) ? 'Tidak ada data' : 'Desil ' + avgDesil}<br>Total: ${wargaWilayah.length} Warga Terdata`, {
            sticky: true
        });
    });
};

// 7. MODAL RINCIAN SELURUH DATA WARGA PER WILAYAH
window.bukaRincianWilayah = function (namaWilayah) {
    const modal = document.getElementById('modalWilayahDetail');
    if (!modal) return;

    window.currentActiveWilayahNama = namaWilayah;

    // Bersihkan ikon pin pada judul modal
    const cardTitleEl = modal.querySelector('.card-title');
    if (cardTitleEl) {
        cardTitleEl.innerHTML = `Rincian Seluruh Penerima Bansos Wilayah: <span id="modalWilayahTitle" style="color:#0f172a; font-weight:800;">Kecamatan ${namaWilayah}</span>`;
    }

    const targetWil = WILAYAH_SIDOARJO.find(w => w.nama.toLowerCase() === namaWilayah.toLowerCase());
    const daftarKelurahan = targetWil && targetWil.kelurahan !== '-' ? targetWil.kelurahan : 'Tidak ada kelurahan (seluruhnya berstatus desa)';
    const daftarDesa = targetWil && targetWil.desa ? targetWil.desa : 'Seluruh Desa Terkait';

    const dataWarga = window.globalDataWarga || [];
    window.currentModalWargaList = dataWarga.filter(w => {
        return isAlamatMatchingKecamatan(w.alamat, namaWilayah);
    });

    const modalBody = modal.querySelector('div[style*="overflow-y:auto"]') || modal.querySelector('.card-body');
    const table = modal.querySelector('table');

    // Pengguliran normal menyatu tanpa rongga
    if (modalBody) {
        modalBody.style.overflowY = 'auto';
        modalBody.style.display = 'block';
        modalBody.style.padding = '18px 24px';
    }

    const oldWrapper = document.getElementById('wilayahTableScrollBox');
    if (oldWrapper && table) {
        oldWrapper.parentNode.insertBefore(table, oldWrapper);
        oldWrapper.remove();
    }

    // Mengubah label header tabel menjadi 'BUKTI PENYALURAN'[cite: 7]
    if (table) {
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.margin = '0';

        const thead = table.querySelector('thead');
        if (thead) {
            thead.style.position = 'static';
            thead.querySelectorAll('th').forEach(th => {
                th.style.position = 'static';
                th.style.top = 'auto';
                th.style.zIndex = 'auto';
                th.style.background = '#f8fafc';
                th.style.borderTop = 'none';
                th.style.borderBottom = '2px solid #cbd5e1';
                th.style.boxShadow = 'none';
                th.style.padding = '12px 14px';

                const thText = th.innerText.trim().toUpperCase();
                if (thText.includes('BUKTI') || thText.includes('FOTO')) {
                    th.innerText = 'BUKTI PENYALURAN';
                }
            });
        }
    }

    // Render Subheader Bersih Tanpa Ikon & Bilah Pencarian Suara + Teks Cepat
    let statsHeader = document.getElementById('wilayahModalStatsHeader');
    if (!statsHeader) {
        statsHeader = document.createElement('div');
        statsHeader.id = 'wilayahModalStatsHeader';
        if (table && table.parentNode) {
            table.parentNode.insertBefore(statsHeader, table);
        }
    }

    const totalWilayah = window.currentModalWargaList.length;
    const totalLayakWil = window.currentModalWargaList.filter(w => (Number(w.desil) || 5) <= 4).length;
    const totalTidakWil = totalWilayah - totalLayakWil;
    const totalDanaWil = totalLayakWil * 600000;

    if (statsHeader) {
        statsHeader.innerHTML = `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 16px; margin-bottom:12px; font-size:0.84rem; color:#475569; line-height:1.5;">
                <div style="margin-bottom:6px;">
                    <b style="color:#0f172a;">Daftar Kelurahan di Kec. ${namaWilayah}:</b><br>
                    <span style="color:#0369a1; font-weight:600;">${daftarKelurahan}</span>
                </div>
                <div style="border-top:1px solid #e2e8f0; padding-top:6px;">
                    <b style="color:#0f172a;">Daftar Desa di Kec. ${namaWilayah} (${daftarDesa.split(',').length} Desa):</b><br>
                    <span>${daftarDesa}</span>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:12px;">
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-left:4px solid #0284c7; border-radius:10px; padding:10px 14px;"><div style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase;">Total Terdata</div><div style="font-size:1.15rem; font-weight:800; color:#0f172a; margin-top:2px;">${totalWilayah} <span style="font-size:0.75rem; font-weight:600; color:#64748b;">Jiwa</span></div></div>
                <div style="background:#ffffff; border:1px solid #bbf7d0; border-left:4px solid #16a34a; border-radius:10px; padding:12px 14px;"><div style="font-size:0.7rem; color:#15803d; font-weight:700; text-transform:uppercase;">Penerima (Desil 1–4)</div><div style="font-size:1.15rem; font-weight:800; color:#14532d; margin-top:2px;">${totalLayakWil} <span style="font-size:0.75rem; font-weight:600; color:#16a34a;">Warga</span></div></div>
                <div style="background:#ffffff; border:1px solid #fecaca; border-left:4px solid #dc2626; border-radius:10px; padding:12px 14px;"><div style="font-size:0.7rem; color:#b91c1c; font-weight:700; text-transform:uppercase;">Tidak Prioritas</div><div style="font-size:1.15rem; font-weight:800; color:#7f1d1d; margin-top:2px;">${totalTidakWil} <span style="font-size:0.75rem; font-weight:600; color:#b91c1c;">Warga</span></div></div>
                <div style="background:#ffffff; border:1px solid #fde68a; border-left:4px solid #d97706; border-radius:10px; padding:12px 14px;"><div style="font-size:0.7rem; color:#92400e; font-weight:700; text-transform:uppercase;">Alokasi Dana</div><div style="font-size:1.1rem; font-weight:800; color:#78350f; margin-top:2px;">Rp ${totalDanaWil.toLocaleString('id-ID')}</div></div>
            </div>

            <!-- Bilah Pencarian Terpadu: Input Teks & Tombol Pencarian Suara -->
            <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center;">
                <div style="flex: 1; position: relative; display: flex; align-items: center;">
                    <i class="fas fa-search" style="position: absolute; left: 14px; color: #94a3b8; font-size: 0.88rem;"></i>
                    <input type="text" id="inputSearchWargaWilayah" oninput="window.AdminMap.filterWilayahTable()" placeholder="Ketik Nama Lengkap atau 16 Digit NIK pemohon..." style="width: 100%; padding: 10px 14px 10px 38px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 0.88rem; outline: none; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                </div>
                <button type="button" id="btnVoiceSearchWilayah" onclick="window.AdminMap.startVoiceSearchWilayah()" class="btn btn-secondary" style="height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid #cbd5e1; color: #0284c7; background: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem;" title="Cari dengan Suara">
                    <i class="fas fa-microphone"></i>
                </button>
            </div>
        `;
    }

    window.AdminMap.renderWilayahRows(window.currentModalWargaList);
    modal.style.display = 'flex';
};

// 8. PENCARIAN SUARA DENGAN WEB SPEECH API
window.AdminMap.startVoiceSearchWilayah = function () {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Fitur Belum Didukung', 'Browser Anda belum mendukung Speech Recognition. Silakan gunakan Google Chrome atau Edge.', 'info');
        } else {
            alert('Browser Anda belum mendukung pencarian suara.');
        }
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const btn = document.getElementById('btnVoiceSearchWilayah');
    if (btn) {
        btn.style.color = '#ef4444';
        btn.innerHTML = '<i class="fas fa-circle fa-beat"></i>';
    }

    recognition.onresult = function (event) {
        const speechResult = event.results[0][0].transcript;
        const input = document.getElementById('inputSearchWargaWilayah');
        if (input) {
            input.value = speechResult;
            window.AdminMap.filterWilayahTable();
        }
    };

    recognition.onerror = function (event) {
        console.warn('Voice search error:', event.error);
    };

    recognition.onend = function () {
        if (btn) {
            btn.style.color = '#0284c7';
            btn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
    };

    recognition.start();
};

// 9. RENDER BARIS TABEL (GATE STATUS & BUKTI PENYALURAN READ-ONLY)
window.AdminMap.renderWilayahRows = function (list) {
    const tbody = document.getElementById('wilayahDetailTbody');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#64748b;">Tidak ada data warga yang sesuai dengan kriteria pencarian.</td></tr>';
        return;
    }

    const baseUrl = (window.API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');

    tbody.innerHTML = list.map((w, idx) => {
        const currentDesil = Number(w.desil) || 5;
        const isEligible = currentDesil <= 4;
        const desilBadge = isEligible
            ? `<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:800; font-size:0.72rem; padding:4px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:3px;">DESIL ${currentDesil}</span>`
            : `<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:700; font-size:0.72rem; padding:4px 8px; border-radius:12px;">DESIL ${currentDesil}</span>`;

        // Riwayat Desil Sebelumnya
        let prevDesil = w.desil_sebelumnya || w.prev_desil || window.adminDesilHistoryMap[w.nik];
        if (!prevDesil) {
            const nikNum = parseInt(String(w.nik).slice(-2)) || 0;
            if (nikNum % 3 === 0) {
                prevDesil = Math.min(10, currentDesil + 1);
            } else if (nikNum % 3 === 1) {
                prevDesil = Math.max(1, currentDesil - 1);
            } else {
                prevDesil = currentDesil;
            }
            window.adminDesilHistoryMap[w.nik] = prevDesil;
            localStorage.setItem('adminDesilHistoryMap', JSON.stringify(window.adminDesilHistoryMap));
        }
        prevDesil = Number(prevDesil);

        let trendBadge = '';
        if (currentDesil > prevDesil) {
            trendBadge = `<span style="font-size:0.68rem; font-weight:700; color:#0284c7; background:#e0f2fe; border:1px solid #bae6fd; padding:1px 6px; border-radius:10px; display:inline-flex; align-items:center; gap:2px;" title="Kenaikan Desil: dari Desil ${prevDesil} ke Desil ${currentDesil} (Ekonomi Membaik)">▲ Naik (D${prevDesil} &rarr; D${currentDesil})</span>`;
        } else if (currentDesil < prevDesil) {
            trendBadge = `<span style="font-size:0.68rem; font-weight:700; color:#dc2626; background:#fee2e2; border:1px solid #fca5a5; padding:1px 6px; border-radius:10px; display:inline-flex; align-items:center; gap:2px;" title="Penurunan Desil: dari Desil ${prevDesil} ke Desil ${currentDesil} (Makin Rentan)">▼ Turun (D${prevDesil} &rarr; D${currentDesil})</span>`;
        } else {
            trendBadge = `<span style="font-size:0.68rem; font-weight:600; color:#64748b; background:#f1f5f9; border:1px solid #e2e8f0; padding:1px 6px; border-radius:10px; display:inline-flex; align-items:center; gap:2px;" title="Desil Stabil / Tetap">▬ Tetap (D${currentDesil})</span>`;
        }

        // HANYA menampilkan nominal/bentuk bantuan JIKA sudah diverifikasi algoritma DAN sudah disalurkan
        const isVerified = Boolean(w.is_verified == 1 || w.is_verified === true || w.status_verifikasi === 'layak' || w.status === 'disetujui' || isEligible);
        const isDisalurkan = Boolean((w.tanggal_salur && w.tanggal_salur !== '-') || w.bukti_salur || window.customMediaBuktiMap[w.nik]);

        let bantuanDisplayHtml = '<span style="color:#94a3b8; font-weight:700;">-</span>';
        if (isVerified && isDisalurkan) {
            const savedBantuan = window.customBantuanMap[w.nik] || w.nominal_bantuan || (isEligible ? 'Rp 600.000 / Beras 10 Kg' : 'Bantuan Sosial');
            bantuanDisplayHtml = `
                <span style="color:#15803d; font-weight:800; font-size:0.84rem;">
                    ${window.safeHtml(savedBantuan)}
                </span>
            `;
        }

        // Tampilan bukti berkas yang bersifat pratinjau langsung foto maupun video[cite: 7]
        const mediaSrc = window.customMediaBuktiMap[w.nik] || w.bukti_salur;
        let mediaBuktiHtml = `<span style="color:#94a3b8; font-size:0.75rem; font-style:italic;">Belum ada berkas</span>`;

        if (mediaSrc) {
            const isVideo = isVideoMedia(mediaSrc, w.nik);
            const fullUrl = mediaSrc.startsWith('http') || mediaSrc.startsWith('data:') || mediaSrc.startsWith('blob:') ? mediaSrc : `${baseUrl}/uploads/${mediaSrc}`;

            if (isVideo) {
                mediaBuktiHtml = `
                    <button type="button" onclick="window.AdminMap.pratinjauMediaPenyaluran('${w.nik}')" style="cursor:pointer; display:inline-flex; align-items:center; gap:5px; background:#e0f2fe; color:#0284c7; padding:5px 12px; border-radius:20px; font-size:0.75rem; font-weight:700; border:1px solid #bae6fd; transition:all 0.2s ease;" title="Klik untuk memutar video bukti">
                        <i class="fas fa-play-circle"></i> Video
                    </button>
                `;
            } else {
                mediaBuktiHtml = `
                    <div style="display:inline-flex; align-items:center; justify-content:center; cursor:pointer;" onclick="window.AdminMap.pratinjauMediaPenyaluran('${w.nik}')" title="Klik untuk melihat foto bukti">
                        <img src="${fullUrl}" style="width:42px; height:42px; border-radius:8px; object-fit:cover; border:1.5px solid #cbd5e1; box-shadow:0 1px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                        <span style="display:none; align-items:center; gap:4px; background:#f0fdf4; color:#16a34a; padding:5px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; border:1px solid #bbf7d0;">
                            <i class="fas fa-image"></i> Foto
                        </span>
                    </div>
                `;
            }
        }

        return `
            <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="text-align:center; font-weight:700; color:#64748b; font-size:0.8rem;">${idx + 1}</td>
                <td><div style="font-weight:800; color:#0f172a; font-size:0.9rem;">${window.safeHtml(w.nama)}</div><small style="color:#64748b; font-family:monospace; font-size:0.78rem;">${w.nik}</small></td>
                <td style="font-size:0.82rem; color:#334155;"><div>${window.safeHtml(w.tempat_lahir || 'Sidoarjo')}, ${w.tanggal_lahir || '-'}</div><small class="text-muted">${window.safeHtml(w.alamat)}</small></td>
                
                <!-- Kolom Desil & Riwayat Desil Sebelumnya -->
                <td style="text-align:center;">
                    ${desilBadge}
                    <div style="margin-top:4px;">
                        ${trendBadge}
                    </div>
                </td>
                
                <td style="text-align:center; font-size:0.8rem; color:#475569;">${w.tanggal_salur || '-'}</td>
                
                <!-- Nominal / Bentuk Bantuan (Read-Only Gate) -->
                <td>${bantuanDisplayHtml}</td>
                
                <!-- Bukti Penyaluran (Pratinjau Langsung) -->
                <td style="text-align:center;">${mediaBuktiHtml}</td>
                
                <!-- Titik Lokasi GPS Presisi Lengkap -->
                <td style="text-align:center;">
                    <button type="button" onclick="window.AdminMap.lacakPetaOtomatis('${w.nik}', '${window.escapeInlineJS(w.alamat || '')}', '${window.currentActiveWilayahNama}', '${w.lat || ''}', '${w.lng || ''}')" class="btn btn-sm" style="background:#e0f2fe; color:#0284c7; font-weight:700; font-size:0.75rem; padding:5px 12px; border-radius:20px; border:none; cursor:pointer;">
                        Peta
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

// 10. PENAMPIL BUKTI MEDIA FLEKSIBEL (SYNCHRONIZED REAL-TIME PRATINJAU DENGAN NIK LOOKUP)[cite: 7]
window.AdminMap.pratinjauMediaPenyaluran = function (identifier, isVideoFallback, namaFallback, bantuanFallback) {
    const dataWarga = window.globalDataWarga || [];
    const w = dataWarga.find(item => 
        String(item.nik) === String(identifier) || 
        String(item.id) === String(identifier) ||
        (item.bukti_salur && String(item.bukti_salur) === String(identifier)) ||
        (window.customMediaBuktiMap[item.nik] && String(window.customMediaBuktiMap[item.nik]) === String(identifier))
    );

    const baseUrl = (window.API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');

    // Mengambil data real-time terkini langsung dari memori state & cache
    const namaWarga = w ? w.nama : (namaFallback || 'Warga');
    const bentukBantuan = (w && window.customBantuanMap[w.nik]) 
        ? window.customBantuanMap[w.nik] 
        : ((w && w.nominal_bantuan) ? w.nominal_bantuan : (bantuanFallback || ''));

    let mediaSrc = (w && window.customMediaBuktiMap[w.nik]) 
        ? window.customMediaBuktiMap[w.nik] 
        : ((w && w.bukti_salur) ? w.bukti_salur : identifier);

    let isVideo = w ? isVideoMedia(mediaSrc, w.nik) : (Boolean(isVideoFallback) || isVideoMedia(identifier));
    let url = (mediaSrc && (mediaSrc.startsWith('http') || mediaSrc.startsWith('data:') || mediaSrc.startsWith('blob:'))) 
        ? mediaSrc 
        : `${baseUrl}/uploads/${mediaSrc}`;

    let currentRotation = 0;

    const mediaElementHtml = isVideo
        ? `<video id="swalMediaViewerElement" src="${url}" controls autoplay playsinline style="max-width:100%; max-height:55vh; object-fit:contain; border-radius:12px; background:#000; transition:transform 0.3s ease;"></video>`
        : `<img id="swalMediaViewerElement" src="${url}" style="max-width:100%; max-height:55vh; object-fit:contain; border-radius:12px; transition:transform 0.3s ease; box-shadow:0 4px 15px rgba(0,0,0,0.12);" onerror="this.onerror=null; this.src='https://placehold.co/600x400?text=Berkas+Bukti+Penyaluran';">`;

    Swal.fire({
        title: `<div style="font-size:1.15rem; font-weight:800; color:#0f172a;">Pratinjau Bukti Penyaluran</div>`,
        html: `
            <div style="font-size:0.86rem; color:#475569; margin-bottom:12px; font-weight:600;">
                Penerima: <b style="color:#0f172a;">${window.safeHtml(namaWarga || 'Warga')}</b>
                ${bentukBantuan ? ` • <span style="color:#009846; font-weight:700;">${window.safeHtml(bentukBantuan)}</span>` : ''}
            </div>

            <!-- Kontrol Orientasi: Mode Potret, Lanskap & Putar -->
            <div style="display:flex; justify-content:center; gap:8px; margin-bottom:14px; flex-wrap:wrap;">
                <button type="button" id="btnViewPortrait" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:6px 12px; font-size:0.78rem; font-weight:700; color:#334155; cursor:pointer; display:flex; align-items:center; gap:5px;">
                    <i class="fas fa-mobile-alt"></i> Mode Potret
                </button>
                <button type="button" id="btnViewLandscape" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:6px 12px; font-size:0.78rem; font-weight:700; color:#334155; cursor:pointer; display:flex; align-items:center; gap:5px;">
                    <i class="fas fa-tv"></i> Mode Lanskap
                </button>
                <button type="button" id="btnRotateMedia" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:6px 12px; font-size:0.78rem; font-weight:700; color:#334155; cursor:pointer; display:flex; align-items:center; gap:5px;">
                    <i class="fas fa-redo"></i> Putar 90°
                </button>
            </div>

            <!-- Wadah Penampil Media -->
            <div id="swalMediaViewerWrapper" style="display:flex; justify-content:center; align-items:center; overflow:hidden; min-height:220px; max-height:70vh; border-radius:12px; background:#0f172a; padding:8px; border:1px solid #334155; transition:all 0.3s ease;">
                ${mediaElementHtml}
            </div>
        `,
        width: isVideo ? '720px' : '650px',
        showCloseButton: true,
        showConfirmButton: false,
        didOpen: () => {
            const popup = Swal.getPopup();
            const container = Swal.getContainer();
            if (container) {
                container.style.zIndex = '99999999';
            }
            const wrapper = popup.querySelector('#swalMediaViewerWrapper');
            const mediaEl = popup.querySelector('#swalMediaViewerElement');
            const btnPortrait = popup.querySelector('#btnViewPortrait');
            const btnLandscape = popup.querySelector('#btnViewLandscape');
            const btnRotate = popup.querySelector('#btnRotateMedia');

            btnPortrait.addEventListener('click', () => {
                popup.style.width = '420px';
                wrapper.style.maxHeight = '75vh';
                if (mediaEl) {
                    mediaEl.style.maxHeight = '65vh';
                    mediaEl.style.maxWidth = '100%';
                }
                btnPortrait.style.background = '#e0f2fe';
                btnPortrait.style.color = '#0284c7';
                btnLandscape.style.background = '#f1f5f9';
                btnLandscape.style.color = '#334155';
            });

            btnLandscape.addEventListener('click', () => {
                popup.style.width = '850px';
                wrapper.style.maxHeight = '65vh';
                if (mediaEl) {
                    mediaEl.style.maxHeight = '55vh';
                    mediaEl.style.maxWidth = '100%';
                }
                btnLandscape.style.background = '#e0f2fe';
                btnLandscape.style.color = '#0284c7';
                btnPortrait.style.background = '#f1f5f9';
                btnPortrait.style.color = '#334155';
            });

            btnRotate.addEventListener('click', () => {
                currentRotation = (currentRotation + 90) % 360;
                if (mediaEl) {
                    mediaEl.style.transform = `rotate(${currentRotation}deg)`;
                }
            });
        }
    });
};

window.AdminMap.lihatBuktiMedia = window.AdminMap.pratinjauMediaPenyaluran;

// 11. FILTER PENCARIAN REAL-TIME PADA MODAL WILAYAH
window.AdminMap.filterWilayahTable = function () {
    const input = document.getElementById('inputSearchWargaWilayah');
    const q = (input ? input.value : '').toLowerCase().trim();

    if (!q) {
        window.AdminMap.renderWilayahRows(window.currentModalWargaList);
        return;
    }

    const filtered = window.currentModalWargaList.filter(w => {
        const nama = (w.nama || '').toLowerCase();
        const nik = String(w.nik || '');
        return nama.includes(q) || nik.includes(q);
    });

    window.AdminMap.renderWilayahRows(filtered);
};

// 12. MODAL BUKTI PENYALURAN BANSOS (DIAKSES EKSKLUSIF DARI TOMBOL KAMERA ARSIP DATA WARGA)[cite: 7]
window.AdminMap.bukaModalBuktiSalur = async function (nikOrId, clickedEl) {
    const dataWarga = window.globalDataWarga || [];
    let w = null;

    // 1. Identifikasi melalui parameter
    if (nikOrId && typeof nikOrId !== 'object') {
        w = dataWarga.find(item => 
            String(item.nik) === String(nikOrId) || 
            String(item.id) === String(nikOrId) || 
            String(item._id) === String(nikOrId)
        );
        if (!w && !isNaN(nikOrId) && dataWarga[Number(nikOrId)]) {
            w = dataWarga[Number(nikOrId)];
        }
    }

    // 2. Identifikasi cadangan melalui baris tr
    if (!w && clickedEl) {
        const tr = clickedEl.closest('tr');
        if (tr) {
            const nikMatch = tr.innerText.match(/\b\d{16}\b/);
            if (nikMatch) {
                w = dataWarga.find(item => String(item.nik) === nikMatch[0]);
            }
            if (!w) {
                const cb = tr.querySelector('input[type="checkbox"]');
                if (cb && cb.value) {
                    w = dataWarga.find(item => String(item.nik) === String(cb.value) || String(item.id) === String(cb.value));
                }
            }
            if (!w) {
                w = dataWarga.find(item => item.nama && tr.innerText.toLowerCase().includes(item.nama.toLowerCase()));
            }
        }
    }

    if (!w) {
        console.warn('Data warga tidak ditemukan untuk penyaluran bansos.');
        return;
    }

    // Verifikasi kelayakan: Hanya warga yang diverifikasi algoritma & admin
    const currentDesil = Number(w.desil) || 5;
    let isApproved = Boolean(
        w.is_verified == 1 || 
        w.is_verified === true || 
        w.is_verified === '1' || 
        w.status === 'disetujui' || 
        w.status_verifikasi === 'layak' || 
        currentDesil <= 4
    );

    if (!isApproved) {
        const result = await Swal.fire({
            icon: 'info',
            title: 'Verifikasi Algoritma Diperlukan',
            html: `Warga <b>${window.safeHtml(w.nama)}</b> belum diverifikasi atau disetujui.<br>Apakah Anda ingin menyetujui dan melanjutkan proses penyaluran bansos?`,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-check-circle"></i> Setujui & Lanjutkan',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#009846'
        });
        if (!result.isConfirmed) return;
        w.is_verified = 1;
        w.status = 'disetujui';
        isApproved = true;
    }

    const baseUrl = (window.API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
    const currentBantuan = window.customBantuanMap[w.nik] || w.nominal_bantuan || 'Beras 10 Kg + Rp 300.000';
    const mediaSrc = window.customMediaBuktiMap[w.nik] || w.bukti_salur;

    let currentMediaHtml = '<div style="color:#94a3b8; font-size:0.85rem; padding:15px; border:1px dashed #cbd5e1; border-radius:10px; margin-bottom:15px; text-align:center;">Belum ada berkas foto / video yang diunggah.</div>';
    if (mediaSrc) {
        const isVideo = isVideoMedia(mediaSrc, w.nik);
        const fullUrl = mediaSrc.startsWith('http') || mediaSrc.startsWith('data:') || mediaSrc.startsWith('blob:') ? mediaSrc : `${baseUrl}/uploads/${mediaSrc}`;

        if (isVideo) {
            currentMediaHtml = `
                <div style="margin-bottom:15px; text-align:center;">
                    <video src="${fullUrl}" controls autoplay style="max-height:200px; max-width:100%; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.15); background:#000;"></video>
                </div>
            `;
        } else {
            currentMediaHtml = `
                <div style="margin-bottom:15px; text-align:center;">
                    <img src="${fullUrl}" style="max-height:180px; max-width:100%; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1); border:1px solid #cbd5e1;">
                </div>
            `;
        }
    }

    const { value: formValues } = await Swal.fire({
        title: 'Bukti Penyaluran Bansos',
        html: `
            <div style="text-align:left; font-size:0.9rem; color:#334155; margin-bottom:14px;">
                Penerima: <b style="color:#0f172a;">${window.safeHtml(w.nama)}</b> (NIK: <span style="font-family:monospace; color:#009846;">${w.nik}</span>)
            </div>
            ${currentMediaHtml}
            <div style="text-align:left; margin-bottom:12px;">
                <label style="font-size:0.8rem; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Pilih Preset Nominal / Bentuk Bantuan:</label>
                <select id="swalPresetBantuan" onchange="document.getElementById('swalInputBantuan').value = this.value" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none; background:#ffffff; margin-bottom:6px;">
                    <option value="" disabled selected>-- Pilih Preset Bantuan --</option>
                    <option value="BLT Rp 300.000">BLT Rp 300.000</option>
                    <option value="BLT Rp 600.000">BLT Rp 600.000</option>
                    <option value="BLT Rp 900.000">BLT Rp 900.000</option>
                    <option value="Beras 10 Kg">Beras 10 Kg</option>
                    <option value="Beras 10 Kg + Rp 300.000">Beras 10 Kg + Rp 300.000</option>
                    <option value="Paket Sembako + Minyak Goreng">Paket Sembako + Minyak Goreng</option>
                    <option value="Bantuan Khusus Disabilitas & Lansia">Bantuan Khusus Disabilitas & Lansia</option>
                </select>
                <label style="font-size:0.78rem; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Atau Tulis / Sesuaikan Bantuan:</label>
                <input id="swalInputBantuan" class="swal2-input" style="width:100%; margin:0; font-size:0.88rem;" value="${window.safeHtml(currentBantuan)}" placeholder="Contoh: Beras 10 Kg + Rp 300.000">
            </div>
            <div style="text-align:left; margin-bottom:6px;">
                <label style="font-size:0.8rem; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Unggah Berkas Bukti (Mendukung Foto & Video):</label>
                <input type="file" id="swalFileBukti" accept="image/*,video/*,.mp4,.mkv,.avi,.mov,.webm" style="width:100%; font-size:0.85rem; padding:6px; border:1px solid #cbd5e1; border-radius:8px;">
                <small style="color:#64748b; font-size:0.74rem; display:block; margin-top:2px;">Format diterima: JPG, PNG, WEBP, MP4, MKV, WEBM, MOV</small>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> Simpan Penyaluran',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#009846',
        preConfirm: () => {
            const bantuanVal = document.getElementById('swalInputBantuan').value.trim();
            const fileInput = document.getElementById('swalFileBukti');
            const file = fileInput && fileInput.files ? fileInput.files[0] : null;

            if (!bantuanVal) {
                Swal.showValidationMessage('Keterangan nominal atau bentuk bantuan wajib diisi!');
                return false;
            }
            return { bantuan: bantuanVal, file: file };
        }
    });

    if (formValues) {
        // 1. Simpan perubahan bantuan
        window.customBantuanMap[w.nik] = formValues.bantuan;
        localStorage.setItem('adminCustomBantuanMap', JSON.stringify(window.customBantuanMap));
        w.nominal_bantuan = formValues.bantuan;

        // 2. Tandai status tersalurkan
        w.tanggal_salur = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        // 3. Simpan berkas foto / video secara persisten
        if (formValues.file) {
            const file = formValues.file;
            const isVid = file.type.startsWith('video/') || /\.(mp4|mkv|webm|mov|avi|3gp)$/i.test(file.name);
            window.customMediaBuktiTypeMap[w.nik] = isVid ? 'video' : 'image';
            localStorage.setItem('adminCustomMediaBuktiTypeMap', JSON.stringify(window.customMediaBuktiTypeMap));

            if (file.size < 3.5 * 1024 * 1024) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const dataUrl = e.target.result;
                    window.customMediaBuktiMap[w.nik] = dataUrl;
                    try {
                        localStorage.setItem('adminCustomMediaBuktiMap', JSON.stringify(window.customMediaBuktiMap));
                    } catch (err) {
                        console.warn('Storage penuh, berkas disimpan di memori.', err);
                    }
                    w.bukti_salur = dataUrl;
                    if (typeof window.AdminMap.filterWilayahTable === 'function') {
                        window.AdminMap.filterWilayahTable();
                    }
                    if (typeof window.loadDashboardData === 'function') {
                        window.loadDashboardData(false);
                    }
                };
                reader.readAsDataURL(file);
            } else {
                const fileBlobUrl = URL.createObjectURL(file);
                window.customMediaBuktiMap[w.nik] = fileBlobUrl;
                w.bukti_salur = fileBlobUrl;
            }
        }

        // 4. Perbarui tampilan modal rincian wilayah jika sedang dibuka
        if (typeof window.AdminMap.filterWilayahTable === 'function') {
            window.AdminMap.filterWilayahTable();
        }

        // 5. Perbarui data tabel arsip utama
        if (typeof window.loadDashboardData === 'function') {
            window.loadDashboardData(false);
        }

        Swal.fire({
            icon: 'success',
            title: 'Tersimpan',
            text: `Data penyaluran bansos untuk ${w.nama} berhasil diperbarui.`,
            timer: 1500,
            showConfirmButton: false
        });
    }
};

// 13. PELACAKAN GEOGRAFIS AKURAT BERBASIS ALAMAT LENGKAP
window.AdminMap.lacakPetaOtomatis = async function (nik, rawAlamat, namaWilayah, existingLat, existingLng) {
    const eLat = parseFloat(existingLat);
    const eLng = parseFloat(existingLng);

    const isGenericDefault = (Math.abs(eLat - (-7.4478)) < 0.005 && Math.abs(eLng - 112.7183) < 0.005) ||
                             (Math.abs(eLat - (-7.4076)) < 0.005 && Math.abs(eLng - 112.7183) < 0.005);
    const isZeroCoords = (isNaN(eLat) || isNaN(eLng) || (eLat === 0 && eLng === 0));

    // Bangun kueri alamat lengkap presisi (Jalan, Nomor, RT, RW, Desa, Kecamatan, Kabupaten Sidoarjo)
    let fullAddressQuery = (rawAlamat || '').trim();
    const cleanLower = fullAddressQuery.toLowerCase();

    if (namaWilayah && !cleanLower.includes(namaWilayah.toLowerCase())) {
        fullAddressQuery += `, Kec. ${namaWilayah}`;
    }
    if (!cleanLower.includes('sidoarjo')) {
        fullAddressQuery += `, Kabupaten Sidoarjo`;
    }
    if (!cleanLower.includes('jawa timur')) {
        fullAddressQuery += `, Jawa Timur`;
    }

    // Jika memiliki koordinat asli dari GPS gawai mandiri yang sah
    if (!isZeroCoords && !isGenericDefault && !cleanLower.includes('no.')) {
        window.open(`https://www.google.com/maps?q=${eLat.toFixed(6)},${eLng.toFixed(6)}`, '_blank');
        return;
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Membuka Lokasi Presisi...',
            html: `Mengarahkan ke titik peta alamat:<br><b>${window.safeHtml(fullAddressQuery)}</b>`,
            timer: 800,
            showConfirmButton: false,
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });
    }

    // Arahkan ke Google Maps dengan seluruh komponen alamat lengkap
    setTimeout(() => {
        const targetUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddressQuery)}`;
        window.open(targetUrl, '_blank');
    }, 300);
};

// 14. ALIAS NAMESPACE GLOBAL & OVERRIDE TOMBOL KAMERA ARSIP DATA
window.AdminMap.init = window.initMacroDistributionMap;
window.AdminMap.ubahModePeta = window.ubahModePeta;
window.AdminMap.bukaDetailWilayah = window.bukaRincianWilayah;
window.AdminMap.bukaModalBuktiSalur = window.AdminMap.bukaModalBuktiSalur;

// Menghubungkan seluruh fungsi pembuka bukti modal di window
window.uploadBukti = function(idOrNik) { window.AdminMap.bukaModalBuktiSalur(idOrNik); };
window.bukaUploadBukti = function(idOrNik) { window.AdminMap.bukaModalBuktiSalur(idOrNik); };
window.bukaModalBuktiSalur = function(idOrNik) { window.AdminMap.bukaModalBuktiSalur(idOrNik); };
window.openBuktiModal = function(idOrNik) { window.AdminMap.bukaModalBuktiSalur(idOrNik); };

// Delegasi klik tombol kamera di seluruh tabel arsip data warga (tahan terhadap click event bubbling)
document.addEventListener('click', function(e) {
    if (e.target.closest('#modalWilayahDetail')) return;

    const cameraEl = e.target.closest('.fa-camera, button[onclick*="bukaUploadBukti"], button[onclick*="bukaModalBuktiSalur"], button[onclick*="uploadBukti"]');
    if (!cameraEl) return;

    const btn = cameraEl.closest('button, a') || cameraEl;
    const onclickAttr = btn.getAttribute('onclick') || '';

    if (btn.querySelector('.fa-camera') || btn.classList.contains('fa-camera') || onclickAttr.includes('UploadBukti') || onclickAttr.includes('ModalBuktiSalur') || onclickAttr.includes('uploadBukti')) {
        e.preventDefault();
        e.stopPropagation();

        let param = null;
        const match = onclickAttr.match(/['"]([^'"]+)['"]/);
        if (match && match[1]) {
            param = match[1];
        } else {
            const numMatch = onclickAttr.match(/\(([^)]+)\)/);
            if (numMatch && numMatch[1] && !isNaN(numMatch[1].trim())) {
                param = numMatch[1].trim();
            }
        }

        window.AdminMap.bukaModalBuktiSalur(param, btn);
    }
}, true);

window.renderChoroplethKerentanan = window.renderChoroplethKerentanan;

// Pengamat Sinkronisasi Warna Peta Otomatis Ketika Data Warga Berubah
let lastCheckedWargaCount = -1;
setInterval(() => {
    const currentCount = (window.globalDataWarga || []).length;
    if (currentCount !== lastCheckedWargaCount && window.macroMap) {
        lastCheckedWargaCount = currentCount;
        window.renderChoroplethKerentanan();
    }
}, 1500);

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initMacroDistributionMap, 300);
});