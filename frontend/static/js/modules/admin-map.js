/* =========================================================================
   ADMIN-MAP.JS - MODUL PETA SEBARAN 18 KECAMATAN, 31 KELURAHAN & 318 DESA
   ========================================================================= */

window.petaSebaranMode = 'kecamatan'; // 'kecamatan' | 'kelurahan' | 'desa'
window.petaModeDetailDesa = false;

// Helper internal jika belum tersedia di window
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

// 1. DATA 18 KECAMATAN TERKUNCI PRESISI KABUPATEN SIDOARJO
const WILAYAH_SIDOARJO = [
    {
        nama: "Balongbendo", center: [-7.3750, 112.5350], defaultAvgDesil: 2.4, kelurahan: "-",
        desa: "Bakalan, Bakungpringgodani, Balongbendo, Bogempinggir, Gadungkepuhsari, Gamping, Jabaran, Jeruklegi, Kedungsukodani, Kemangsen, Pagerwojo, Penambangan, Pitrosari, Seduri, Seketi, Singkalan, Sumokembangsri, Suwaluh, Waruberon, Watesnegoro",
        polygon: [[-7.3500, 112.5050], [-7.3500, 112.5650], [-7.4050, 112.5650], [-7.4050, 112.5050]]
    },
    {
        nama: "Krian", center: [-7.3880, 112.5975], defaultAvgDesil: 4.9, kelurahan: "Kel. Krian, Kel. Tambakkemerakan, Kel. Kemasan",
        desa: "Barengkrajan, Gawat, Jatikalang, Jerukgamping, Junwangi, Katerungan, Keboharan, Kraton, Ponokawan, Sedenganmijen, Sidomojo, Sidomulyo, Sidorejo, Tempel, Terik, Terungkulon, Terungwetan, Tropodo, Watutulis",
        polygon: [[-7.3650, 112.5650], [-7.3650, 112.6300], [-7.4100, 112.6300], [-7.4100, 112.5650]]
    },
    {
        nama: "Taman", center: [-7.3580, 112.6625], defaultAvgDesil: 3.8, kelurahan: "Kel. Bebekan, Kel. Geluran, Kel. Kalijaten, Kel. Krembangan, Kel. Ngelom, Kel. Sepanjang, Kel. Taman, Kel. Wonocolo",
        desa: "Bohar, Bringinbendo, Gilang, Jemundo, Kedungturi, Kletek, Kramat Jegu, Pertapan Maduretno, Sadang, Sambibulu, Sidodadi, Tanjungsari, Tawangsari, Trosobo, Wage",
        polygon: [[-7.3400, 112.6300], [-7.3400, 112.6950], [-7.3850, 112.6950], [-7.3850, 112.6300]]
    },
    {
        nama: "Waru", center: [-7.3580, 112.7250], defaultAvgDesil: 4.8, kelurahan: "Kel. Waru, Kel. Kureksari",
        desa: "Berbek, Bungurasih, Janti, Kedungrejo, Kepuhkiriman, Medaeng, Ngingas, Pepelegi, Tambakoso, Tambakrejo, Tambaksawah, Tambaksumur, Tropodo, Wadungasri, Wedoro",
        polygon: [[-7.3400, 112.6950], [-7.3400, 112.7550], [-7.3800, 112.7550], [-7.3800, 112.6950]]
    },
    {
        nama: "Sedati", center: [-7.3780, 112.7975], defaultAvgDesil: 2.3, kelurahan: "-",
        desa: "Banjar Kemuning, Betro, Buncitan, Cemandi, Gisikcemandi, Kalanganyar, Kwangsan, Pabean, Pepe, Pranti, Pulungan, Sedati Agung, Sedati Gede, Segoro Tambak, Semampir, Tambak Cemandi",
        polygon: [[-7.3450, 112.7550], [-7.3450, 112.8400], [-7.4100, 112.8400], [-7.4100, 112.7550]]
    },
    {
        nama: "Sukodono", center: [-7.4050, 112.6625], defaultAvgDesil: 3.4, kelurahan: "-",
        desa: "Anggaswangi, Bangsri, Cangkringsari, Jogosatru, Jumputrejo, Kebonagung, Kloposepuluh, Masangan Kulon, Masangan Wetan, Ngaresrejo, Pademonegoro, Panjunan, Pekarungan, Plumbungan, Sambungrejo, Suko, Sukodono, Suruh, Wilayut",
        polygon: [[-7.3850, 112.6300], [-7.3850, 112.6950], [-7.4250, 112.6950], [-7.4250, 112.6300]]
    },
    {
        nama: "Gedangan", center: [-7.4000, 112.7250], defaultAvgDesil: 3.6, kelurahan: "-",
        desa: "Ganting, Gedangan, Gemurung, Karangbong, Keboan Anom, Keboan Sikep, Ketajen, Kragan, Punggul, Sawotratap, Semambung, Seruni, Sruni, Tebel, Wedi",
        polygon: [[-7.3800, 112.6950], [-7.3800, 112.7550], [-7.4200, 112.7550], [-7.4200, 112.6950]]
    },
    {
        nama: "Tarik", center: [-7.4350, 112.5350], defaultAvgDesil: 1.9, kelurahan: "-",
        desa: "Banjarwungu, Gampingrowo, Gedangklutuk, Janti, Kalidawir, Kedungbocok, Kedunglosari, Kemuning, Kendalsewu, Klampisan, Kramattemanggung, Mergobener, Mergosari, Mindugading, Miriprowo, Sebani, Segodobancang, Singogalih, Sumberrejo, Tarik",
        polygon: [[-7.4050, 112.5050], [-7.4050, 112.5650], [-7.4650, 112.5650], [-7.4650, 112.5050]]
    },
    {
        nama: "Wonoayu", center: [-7.4350, 112.6000], defaultAvgDesil: 3.5, kelurahan: "-",
        desa: "Becirongengor, Candinegoro, Jimbaran Kulon, Jimbaran Wetan, Karangpuri, Lambangan, Mojorangagung, Mulyodadi, Pagerngumbuk, Pilang, Plaosan, Ploso, Popoh, Sawocangkring, Semambung, Simoangin-angin, Simoketawang, Suko, Sumberejo, Tanggul, Wonoayu, Wonokalang, Wonokasian",
        polygon: [[-7.4100, 112.5650], [-7.4100, 112.6350], [-7.4600, 112.6350], [-7.4600, 112.5650]]
    },
    {
        nama: "Sidoarjo", center: [-7.4450, 112.6750], defaultAvgDesil: 5.6, kelurahan: "Kel. Bulusidokare, Kel. Celep, Kel. Cemengkalang, Kel. Gebang, Kel. Lemahputro, Kel. Magersari, Kel. Pekauman, Kel. Pucang, Kel. Pucanganom, Kel. Sekardangan, Kel. Sidokare, Kel. Sidokumpul, Kel. Urangagung, Kel. Kemiri",
        desa: "Banjarbendo, Bluru Kidul, Cemengbakalan, Rangkah Kidul, Sarirogo, Sumput",
        polygon: [[-7.4250, 112.6350], [-7.4250, 112.7150], [-7.4650, 112.7150], [-7.4650, 112.6350]]
    },
    {
        nama: "Buduran", center: [-7.4350, 112.7700], defaultAvgDesil: 5.2, kelurahan: "-",
        desa: "Banjarkemantren, Banjarsari, Buduran, Damarsi, Dukuhtengah, Entalsewu, Pagerwojo, Prasung, Punggul, Sawohan, Sidokerto, Sidomulyo, Siwalanpanji, Sukorejo, Wadungasih",
        polygon: [[-7.4100, 112.7150], [-7.4100, 112.8250], [-7.4600, 112.8250], [-7.4600, 112.7150]]
    },
    {
        nama: "Prambon", center: [-7.4850, 112.5450], defaultAvgDesil: 3.1, kelurahan: "-",
        desa: "Bakungpringgodani, Batusanggar, Bendotretek, Bulang, Cangkringturi, Gampang, Gedangrowo, Jatialunalun, Jatikalang, Jedongcangkring, Kazian, Kedungwonokerto, Pejangkungan, Prambon, Simogirang, Simpang, Temu, Watutulis, Wirobiting, Wonoplintahan",
        polygon: [[-7.4650, 112.5150], [-7.4650, 112.5750], [-7.5050, 112.5750], [-7.5050, 112.5150]]
    },
    {
        nama: "Tulangan", center: [-7.4825, 112.6100], defaultAvgDesil: 2.2, kelurahan: "-",
        desa: "Gelang, Grabagan, Grogol, Janti, Jiken, Kajeksan, Kebaron, Kedondong, Kemantren, Kenongo, Kepadangan, Kepil, Kepit, Kepuhkemiri, Kepatihan, Medalem, Modong, Pangkemiri, Singopadu, Sudimoro, Tlasih, Tulangan",
        polygon: [[-7.4600, 112.5750], [-7.4600, 112.6450], [-7.5050, 112.6450], [-7.5050, 112.5750]]
    },
    {
        nama: "Tanggulangin", center: [-7.4850, 112.6800], defaultAvgDesil: 2.4, kelurahan: "-",
        desa: "Banjarasri, Banjarpanji, Boro, Gagangpanjang, Gempolsari, Kalidawir, Kalisampurno, Kalitengah, Kedensari, Kedungbanteng, Ketapang, Ketegan, Kludan, Ngaban, Penataran, Penatarsewu, Putat, Randegan, Sentul",
        polygon: [[-7.4650, 112.6450], [-7.4650, 112.7150], [-7.5050, 112.7150], [-7.5050, 112.6450]]
    },
    {
        nama: "Candi", center: [-7.4825, 112.7700], defaultAvgDesil: 3.2, kelurahan: "-",
        desa: "Balonggabus, Balongmacekan, Bligo, Candi, Durungbanjar, Durungbedug, Gelam, Jambangan, Kalipecabean, Karangtanjung, Kebonsari, Kedungkendo, Kedungpeluk, Kendalpecabean, Klurak, Larangan, Sepande, Sidodadi, Sugihwaras, Sumokali, Tenggulunan, Vedro, Wedoroklurak",
        polygon: [[-7.4600, 112.7150], [-7.4600, 112.8250], [-7.5050, 112.8250], [-7.5050, 112.7150]]
    },
    {
        nama: "Krembung", center: [-7.5225, 112.5875], defaultAvgDesil: 2.3, kelurahan: "-",
        desa: "Balonggarut, Cangkring, Gading, Jandep, Jenggot, Kandangan, Kedungrawan, Kedungsumur, Keper, Krembung, Lemujut, Mojoruntut, Ploso, Rejeni, Tambakrejo, Tanjegwagir, Wangkal, Waung, Wonomlati",
        polygon: [[-7.5050, 112.5500], [-7.5050, 112.6250], [-7.5400, 112.6250], [-7.5400, 112.5500]]
    },
    {
        nama: "Porong", center: [-7.5250, 112.6700], defaultAvgDesil: 2.1, kelurahan: "Kel. Gedang, Kel. Juwetkenongo, Kel. Mindi, Kel. Porong",
        desa: "Candipari, Glagaharum, Keboguyang, Kebonagung, Kesambi, Lajuk, Pamotan, Pesawahan, Plumbon, Reno Kenongo, Wirobiting",
        polygon: [[-7.5050, 112.6250], [-7.5050, 112.7150], [-7.5450, 112.7150], [-7.5450, 112.6250]]
    },
    {
        nama: "Jabon", center: [-7.5250, 112.7750], defaultAvgDesil: 1.8, kelurahan: "-",
        desa: "Balongtani, Besuki, Chandi, Dukuhsari, Keboguyang, Kedungcangkring, Kedungpandan, Kedungrejo, Kupang, Panggreh, Pejarakan, Permisan, Semambung, Tambakkalisogo, Trompoasri",
        polygon: [[-7.5050, 112.7150], [-7.5050, 112.8350], [-7.5450, 112.8350], [-7.5450, 112.7150]]
    }
];

// 2. DATA POLIGON 31 KELURAHAN
const DAFTAR_KELURAHAN_SIDOARJO = [
    { nama: "Kel. Sidokumpul", kec: "Sidoarjo", desil: 6, polygon: [[-7.4300, 112.6550], [-7.4300, 112.6750], [-7.4450, 112.6750], [-7.4450, 112.6550]] },
    { nama: "Kel. Lemahputro", kec: "Sidoarjo", desil: 5, polygon: [[-7.4300, 112.6750], [-7.4300, 112.6950], [-7.4450, 112.6950], [-7.4450, 112.6750]] },
    { nama: "Kel. Magersari", kec: "Sidoarjo", desil: 5, polygon: [[-7.4300, 112.6950], [-7.4300, 112.7150], [-7.4450, 112.7150], [-7.4450, 112.6950]] },
    { nama: "Kel. Celep", kec: "Sidoarjo", desil: 6, polygon: [[-7.4450, 112.6550], [-7.4450, 112.6750], [-7.4600, 112.6750], [-7.4600, 112.6550]] },
    { nama: "Kel. Pekauman", kec: "Sidoarjo", desil: 5, polygon: [[-7.4450, 112.6750], [-7.4450, 112.6950], [-7.4600, 112.6950], [-7.4600, 112.6750]] },
    { nama: "Kel. Sidokare", kec: "Sidoarjo", desil: 4, polygon: [[-7.4450, 112.6950], [-7.4450, 112.7150], [-7.4600, 112.7150], [-7.4600, 112.6950]] },
    { nama: "Kel. Sekardangan", kec: "Sidoarjo", desil: 6, polygon: [[-7.4250, 112.6350], [-7.4250, 112.6550], [-7.4400, 112.6550], [-7.4400, 112.6350]] },
    { nama: "Kel. Bulusidokare", kec: "Sidoarjo", desil: 5, polygon: [[-7.4400, 112.6350], [-7.4400, 112.6550], [-7.4550, 112.6550], [-7.4550, 112.6350]] },
    { nama: "Kel. Gebang", kec: "Sidoarjo", desil: 4, polygon: [[-7.4550, 112.6350], [-7.4550, 112.6550], [-7.4650, 112.6550], [-7.4650, 112.6350]] },
    { nama: "Kel. Pucang", kec: "Sidoarjo", desil: 6, polygon: [[-7.4250, 112.6750], [-7.4250, 112.6950], [-7.4300, 112.6950], [-7.4300, 112.6750]] },
    { nama: "Kel. Pucanganom", kec: "Sidoarjo", desil: 6, polygon: [[-7.4250, 112.6950], [-7.4250, 112.7150], [-7.4300, 112.7150], [-7.4300, 112.6950]] },
    { nama: "Kel. Urangagung", kec: "Sidoarjo", desil: 5, polygon: [[-7.4500, 112.6550], [-7.4500, 112.6750], [-7.4650, 112.6750], [-7.4650, 112.6550]] },
    { nama: "Kel. Kemiri", kec: "Sidoarjo", desil: 5, polygon: [[-7.4500, 112.6750], [-7.4500, 112.6950], [-7.4650, 112.6950], [-7.4650, 112.6750]] },
    { nama: "Kel. Cemengkalang", kec: "Sidoarjo", desil: 5, polygon: [[-7.4500, 112.6950], [-7.4500, 112.7150], [-7.4650, 112.7150], [-7.4650, 112.6950]] },
    { nama: "Kel. Sepanjang", kec: "Taman", desil: 4, polygon: [[-7.3400, 112.6300], [-7.3400, 112.6500], [-7.3600, 112.6500], [-7.3600, 112.6300]] },
    { nama: "Kel. Bebekan", kec: "Taman", desil: 4, polygon: [[-7.3400, 112.6500], [-7.3400, 112.6700], [-7.3600, 112.6700], [-7.3600, 112.6500]] },
    { nama: "Kel. Wonocolo", kec: "Taman", desil: 5, polygon: [[-7.3400, 112.6700], [-7.3400, 112.6950], [-7.3600, 112.6950], [-7.3600, 112.6700]] },
    { nama: "Kel. Geluran", kec: "Taman", desil: 5, polygon: [[-7.3600, 112.6300], [-7.3600, 112.6500], [-7.3750, 112.6500], [-7.3750, 112.6300]] },
    { nama: "Kel. Kalijaten", kec: "Taman", desil: 4, polygon: [[-7.3600, 112.6500], [-7.3600, 112.6700], [-7.3750, 112.6700], [-7.3750, 112.6500]] },
    { nama: "Kel. Ngelom", kec: "Taman", desil: 4, polygon: [[-7.3600, 112.6700], [-7.3600, 112.6950], [-7.3750, 112.6950], [-7.3750, 112.6700]] },
    { nama: "Kel. Krembangan", kec: "Taman", desil: 3, polygon: [[-7.3750, 112.6300], [-7.3750, 112.6600], [-7.3850, 112.6600], [-7.3850, 112.6300]] },
    { nama: "Kel. Taman", kec: "Taman", desil: 4, polygon: [[-7.3750, 112.6600], [-7.3750, 112.6950], [-7.3850, 112.6950], [-7.3850, 112.6600]] },
    { nama: "Kel. Krian", kec: "Krian", desil: 5, polygon: [[-7.3700, 112.5800], [-7.3700, 112.6100], [-7.3900, 112.6100], [-7.3900, 112.5800]] },
    { nama: "Kel. Tambakkemerakan", kec: "Krian", desil: 4, polygon: [[-7.3700, 112.6100], [-7.3700, 112.6300], [-7.3900, 112.6300], [-7.3900, 112.6100]] },
    { nama: "Kel. Kemasan", kec: "Krian", desil: 4, polygon: [[-7.3900, 112.5800], [-7.3900, 112.6100], [-7.4050, 112.6100], [-7.4050, 112.5800]] },
    { nama: "Kel. Porong", kec: "Porong", desil: 2, polygon: [[-7.5100, 112.6400], [-7.5100, 112.6700], [-7.5300, 112.6700], [-7.5300, 112.6400]] },
    { nama: "Kel. Gedang", kec: "Porong", desil: 3, polygon: [[-7.5100, 112.6700], [-7.5100, 112.7000], [-7.5300, 112.7000], [-7.5300, 112.6700]] },
    { nama: "Kel. Mindi", kec: "Porong", desil: 1, polygon: [[-7.5300, 112.6400], [-7.5300, 112.6700], [-7.5450, 112.6700], [-7.5450, 112.6400]] },
    { nama: "Kel. Juwetkenongo", kec: "Porong", desil: 2, polygon: [[-7.5300, 112.6700], [-7.5300, 112.7000], [-7.5450, 112.7000], [-7.5450, 112.6700]] },
    { nama: "Kel. Waru", kec: "Waru", desil: 5, polygon: [[-7.3450, 112.7100], [-7.3450, 112.7400], [-7.3650, 112.7400], [-7.3650, 112.7100]] },
    { nama: "Kel. Kureksari", kec: "Waru", desil: 4, polygon: [[-7.3650, 112.7100], [-7.3650, 112.7400], [-7.3800, 112.7400], [-7.3800, 112.7100]] }
];

// 3. GENERATOR 318 DESA SIDOARJO (SUB-GRID NON-OVERLAPPING)
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

            const desilOffset = ((idx % 3) - 1);
            const estimasiDesil = Math.max(1, Math.min(10, Math.round(kec.defaultAvgDesil + desilOffset)));

            listDesa.push({
                nama: `Desa ${namaDesa}`,
                kec: kec.nama,
                desil: estimasiDesil,
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

// 4. INISIALISASI PETA SEBARAN & 3-MODE SWITCHING
window.initMacroDistributionMap = function () {
    const bigMapBox = document.getElementById('bigMapContainer');
    if (!bigMapBox || window.macroMap) return;

    const centerCoords = window.MAP_CENTER_SIDOARJO || [-7.4478, 112.7183];

    window.macroMap = L.map('bigMapContainer', { 
        attributionControl: false,
        maxBounds: [[-7.5800, 112.4800], [-7.3100, 112.8800]],
        maxBoundsViscosity: 1.0,
        minZoom: 10
    }).setView(centerCoords, 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        maxZoom: 18, subdomains: ['a', 'b', 'c'] 
    }).addTo(window.macroMap);

    window.macroLayerGroup = L.layerGroup().addTo(window.macroMap);

    if (!window.macroModeSwitchControl) {
        window.macroModeSwitchControl = L.control({ position: 'topright' });
        window.macroModeSwitchControl.onAdd = function () {
            const div = L.DomUtil.create('div', 'map-mode-box');
            div.innerHTML = `
                <button onclick="window.cyclePetaMode()" class="btn btn-sm" style="background:#ffffff; color:#0f172a; font-weight:800; border:1.5px solid #cbd5e1; box-shadow:0 3px 10px rgba(0,0,0,0.12); padding:7px 12px; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <i class="fas fa-layer-group text-primary"></i> <span id="lblModePeta">Mode: 18 Kecamatan</span>
                </button>
            `;
            return div;
        };
        window.macroModeSwitchControl.addTo(window.macroMap);
    }

    if (!window.macroLegendControl) {
        window.macroLegendControl = L.control({ position: 'bottomright' });
        window.macroLegendControl.onAdd = function () {
            const div = L.DomUtil.create('div', 'map-legend-box');
            div.id = 'mapLegendContentBox';
            div.innerHTML = `
                <div style="font-weight:800; color:#0f172a; margin-bottom:6px; border-bottom:1px solid #cbd5e1; padding-bottom:4px;">
                    <i class="fas fa-layer-group text-primary"></i> <span id="legendTitleText">Kerentanan 18 Kecamatan</span>
                </div>
                <div><span class="map-legend-dot" style="background:#ef4444;"></span> <b>Tinggi:</b> Desil 1–2 (Merah)</div>
                <div><span class="map-legend-dot" style="background:#eab308;"></span> <b>Sedang:</b> Desil 3–4 (Kuning)</div>
                <div><span class="map-legend-dot" style="background:#10b981;"></span> <b>Rendah:</b> Desil 5–10 (Hijau)</div>
            `;
            return div;
        };
        window.macroLegendControl.addTo(window.macroMap);
    }

    window.renderChoroplethKerentanan();
    setTimeout(() => { if (window.macroMap) window.macroMap.invalidateSize(); }, 400);
};

window.cyclePetaMode = function () {
    if (window.petaSebaranMode === 'kecamatan') {
        window.petaSebaranMode = 'kelurahan';
    } else if (window.petaSebaranMode === 'kelurahan') {
        window.petaSebaranMode = 'desa';
    } else {
        window.petaSebaranMode = 'kecamatan';
    }

    window.petaModeDetailDesa = (window.petaSebaranMode === 'desa');
    const lbl = document.getElementById('lblModePeta');
    const legTitle = document.getElementById('legendTitleText');

    if (window.petaSebaranMode === 'kecamatan') {
        if (lbl) lbl.innerHTML = `<i class="fas fa-map text-primary"></i> Mode: 18 Kecamatan`;
        if (legTitle) legTitle.innerText = `Kerentanan 18 Kecamatan`;
    } else if (window.petaSebaranMode === 'kelurahan') {
        if (lbl) lbl.innerHTML = `<i class="fas fa-city text-info"></i> Mode: 31 Kelurahan`;
        if (legTitle) legTitle.innerText = `Kerentanan 31 Kelurahan`;
    } else {
        if (lbl) lbl.innerHTML = `<i class="fas fa-tree text-success"></i> Mode: 318 Desa`;
        if (legTitle) legTitle.innerText = `Kerentanan 318 Desa`;
    }

    window.renderChoroplethKerentanan();
};

window.togglePetaDetailMode = function () { window.cyclePetaMode(); };

window.renderChoroplethKerentanan = function () {
    if (!window.macroMap || !window.macroLayerGroup) return;
    window.macroLayerGroup.clearLayers();

    const dataWarga = window.globalDataWarga || [];

    // MODE: 31 KELURAHAN
    if (window.petaSebaranMode === 'kelurahan') {
        DAFTAR_KELURAHAN_SIDOARJO.forEach(k => {
            const wargaKel = dataWarga.filter(w => {
                const alamat = (w.alamat || '').toLowerCase();
                const namaBersih = k.nama.toLowerCase().replace('kel. ', '').trim();
                return alamat.includes(namaBersih);
            });

            let desilVal = k.desil;
            if (wargaKel.length > 0) {
                const sumDesil = wargaKel.reduce((acc, curr) => acc + (curr.desil || 5), 0);
                desilVal = parseFloat((sumDesil / wargaKel.length).toFixed(1));
            }

            let polyColor = '#10b981', statusText = 'Kerentanan Rendah', badgeStyle = 'background:#dcfce7; color:#15803d; border:1px solid #86efac;';
            if (desilVal <= 2.5) {
                polyColor = '#ef4444'; statusText = 'Prioritas Utama (Desil 1–2)'; badgeStyle = 'background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;';
            } else if (desilVal <= 4.5) {
                polyColor = '#eab308'; statusText = 'Prioritas Menengah (Desil 3–4)'; badgeStyle = 'background:#fef9c3; color:#a16207; border:1px solid #fde047;';
            }

            const poly = L.polygon(k.polygon, {
                color: polyColor, weight: 2, opacity: 0.95, dashArray: '3, 3', fillColor: polyColor, fillOpacity: 0.45
            });

            poly.on('mouseover', function (e) { e.target.setStyle({ weight: 3.5, fillOpacity: 0.7 }); });
            poly.on('mouseout', function (e) { e.target.setStyle({ weight: 2, fillOpacity: 0.45 }); });

            poly.bindPopup(`
                <div style="font-family:'Inter', sans-serif; font-size:12px; line-height:1.45; min-width:220px;">
                    <div style="font-size:13px; font-weight:800; color:#0f172a; margin-bottom:2px;"><i class="fas fa-city" style="color:${polyColor};"></i> <b>${k.nama}</b></div>
                    <small style="color:#64748b; font-weight:600;">Kecamatan ${k.kec}, Kab. Sidoarjo</small>
                    <div style="margin: 6px 0;"><span style="${badgeStyle} font-weight:700; font-size:10px; padding:2px 8px; border-radius:10px; display:inline-block;">${statusText}</span></div>
                    <div style="color:#334155; font-size:11px; margin-top:4px;"><b>Status Desil:</b> Desil ${desilVal}<br><b>Warga Terdata:</b> ${wargaKel.length} Jiwa</div>
                </div>
            `);
            window.macroLayerGroup.addLayer(poly);
        });
        return;
    }

    // MODE: 318 DESA
    if (window.petaSebaranMode === 'desa') {
        DAFTAR_318_DESA_SIDOARJO.forEach(d => {
            const wargaDesa = dataWarga.filter(w => {
                const alamat = (w.alamat || '').toLowerCase();
                const namaBersih = d.nama.toLowerCase().replace('desa ', '').trim();
                return alamat.includes(namaBersih);
            });

            let desilVal = d.desil;
            if (wargaDesa.length > 0) {
                const sumDesil = wargaDesa.reduce((acc, curr) => acc + (curr.desil || 5), 0);
                desilVal = parseFloat((sumDesil / wargaDesa.length).toFixed(1));
            }

            let polyColor = '#10b981', statusText = 'Kerentanan Rendah', badgeStyle = 'background:#dcfce7; color:#15803d; border:1px solid #86efac;';
            if (desilVal <= 2.5) {
                polyColor = '#ef4444'; statusText = 'Desil 1–2 (Prioritas Tinggi)'; badgeStyle = 'background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;';
            } else if (desilVal <= 4.5) {
                polyColor = '#eab308'; statusText = 'Desil 3–4 (Prioritas Sedang)'; badgeStyle = 'background:#fef9c3; color:#a16207; border:1px solid #fde047;';
            }

            const poly = L.polygon(d.polygon, {
                color: polyColor, weight: 1.2, opacity: 0.9, fillColor: polyColor, fillOpacity: 0.42
            });

            poly.on('mouseover', function (e) { e.target.setStyle({ weight: 2.8, fillOpacity: 0.65 }); });
            poly.on('mouseout', function (e) { e.target.setStyle({ weight: 1.2, fillOpacity: 0.42 }); });

            poly.bindPopup(`
                <div style="font-family:'Inter', sans-serif; font-size:12px; line-height:1.4; min-width:210px;">
                    <div style="font-size:12.5px; font-weight:800; color:#0f172a; margin-bottom:2px;"><i class="fas fa-tree" style="color:${polyColor};"></i> <b>${d.nama}</b></div>
                    <small style="color:#64748b; font-weight:600;">Kec. ${d.kec}, Kab. Sidoarjo</small>
                    <div style="margin: 5px 0;"><span style="${badgeStyle} font-weight:700; font-size:9.5px; padding:2px 7px; border-radius:10px; display:inline-block;">${statusText}</span></div>
                    <div style="color:#334155; font-size:11px;"><b>Tingkat Desil:</b> Desil ${desilVal}<br><b>Warga Terdata:</b> ${wargaDesa.length} Jiwa</div>
                </div>
            `);
            window.macroLayerGroup.addLayer(poly);
        });
        return;
    }

    // MODE: 18 KECAMATAN (DEFAULT)
    WILAYAH_SIDOARJO.forEach((wil) => {
        const wargaWilayah = dataWarga.filter(w => {
            const alamat = (w.alamat || '').toLowerCase();
            return alamat.includes(wil.nama.toLowerCase());
        });

        let avgDesil = wil.defaultAvgDesil;
        if (wargaWilayah.length > 0) {
            const totalDesil = wargaWilayah.reduce((acc, curr) => acc + (curr.desil || 5), 0);
            avgDesil = parseFloat((totalDesil / wargaWilayah.length).toFixed(1));
        }

        let polyColor = '#10b981', statusText = 'Kerentanan Rendah (Relatif Mandiri)', badgeStyle = 'background:#dcfce7; color:#15803d; border:1px solid #86efac;';
        if (avgDesil <= 2.5) {
            polyColor = '#ef4444'; statusText = 'Kerentanan Tinggi (Prioritas Utama)'; badgeStyle = 'background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;';
        } else if (avgDesil <= 4.5) {
            polyColor = '#eab308'; statusText = 'Kerentanan Sedang (Prioritas Menengah)'; badgeStyle = 'background:#fef9c3; color:#a16207; border:1px solid #fde047;';
        }

        const poly = L.polygon(wil.polygon, {
            color: polyColor, weight: 2, opacity: 0.95, dashArray: '5, 5', fillColor: polyColor, fillOpacity: 0.28
        });

        poly.on('mouseover', function (e) { e.target.setStyle({ weight: 3.5, fillOpacity: 0.52 }); });
        poly.on('mouseout', function (e) { e.target.setStyle({ weight: 2, fillOpacity: 0.28 }); });

        poly.bindPopup(`
            <div style="font-family:'Inter', sans-serif; font-size:12px; line-height:1.5; min-width:250px;">
                <div style="font-size:13.5px; font-weight:800; color:#0f172a; margin-bottom:4px;"><i class="fas fa-map-marker-alt" style="color:${polyColor};"></i> Kec. <b>${wil.nama}</b></div>
                <div style="margin: 4px 0;"><span style="${badgeStyle} font-weight:700; font-size:10.5px; padding:2px 8px; border-radius:12px; display:inline-block;">${statusText}</span></div>
                <div style="margin-top:6px; color:#475569; font-size:11.5px;"><b>Rata-rata Kelompok:</b> Desil ${avgDesil}<br><b>Jumlah Warga Terdata:</b> ${wargaWilayah.length} Jiwa</div>
                <div style="margin-top:4px; font-size:10.5px; color:#64748b; border-top:1px dashed #cbd5e1; padding-top:4px;">
                    <b>Kelurahan:</b> ${wil.kelurahan !== '-' ? wil.kelurahan : 'Tidak ada'}<br><b>Jumlah Desa:</b> ${wil.desa.split(',').length} Desa
                </div>
                <hr style="margin:8px 0; border:none; border-top:1px solid #e2e8f0;">
                <button onclick="window.bukaRincianWilayah('${window.escapeInlineJS(wil.nama)}')" class="btn btn-primary btn-sm" style="width:100%; font-size:11px; padding:6px; border-radius:6px; font-weight:700;"><i class="fas fa-list-ul"></i> Lihat Seluruh Data Warga</button>
            </div>
        `);
        window.macroLayerGroup.addLayer(poly);
    });
};

// 5. MODAL RINCIAN PER WILAYAH
window.bukaRincianWilayah = function (namaWilayah) {
    const modal = document.getElementById('modalWilayahDetail');
    const titleEl = document.getElementById('modalWilayahTitle');
    const tbody = document.getElementById('wilayahDetailTbody');
    if (!modal || !tbody) return;

    if (titleEl) titleEl.innerHTML = `<b>Kecamatan ${namaWilayah}</b>`;
    tbody.innerHTML = '';

    const targetWil = WILAYAH_SIDOARJO.find(w => w.nama.toLowerCase() === namaWilayah.toLowerCase());
    const daftarKelurahan = targetWil && targetWil.kelurahan !== '-' ? targetWil.kelurahan : 'Tidak ada kelurahan (seluruhnya berstatus desa)';
    const daftarDesa = targetWil && targetWil.desa ? targetWil.desa : 'Seluruh Desa Terkait';

    const dataWarga = window.globalDataWarga || [];
    const listWarga = dataWarga.filter(w => {
        const alamat = (w.alamat || '').toLowerCase();
        return alamat.includes(namaWilayah.toLowerCase()) || dataWarga.length <= 10;
    });

    let statsHeader = document.getElementById('wilayahModalStatsHeader');
    if (!statsHeader) {
        statsHeader = document.createElement('div');
        statsHeader.id = 'wilayahModalStatsHeader';
        const tableContainer = tbody.closest('.table-responsive') || tbody.closest('table');
        if (tableContainer && tableContainer.parentNode) tableContainer.parentNode.insertBefore(statsHeader, tableContainer);
    }

    const totalWilayah = listWarga.length;
    const totalLayakWil = listWarga.filter(w => (w.desil || 5) <= 4).length;
    const totalTidakWil = totalWilayah - totalLayakWil;
    const totalDanaWil = totalLayakWil * 600000;

    if (statsHeader) {
        statsHeader.innerHTML = `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin-bottom:14px; font-size:0.8rem; color:#475569; line-height:1.5;">
                <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:8px;">
                    <i class="fas fa-city text-info" style="margin-top:3px; font-size:1rem;"></i>
                    <div><b style="color:#0f172a;">Daftar Kelurahan di Kec. ${namaWilayah}:</b><br><span style="color:#0369a1; font-weight:600;">${daftarKelurahan}</span></div>
                </div>
                <div style="display:flex; align-items:flex-start; gap:8px; border-top:1px solid #e2e8f0; padding-top:8px;">
                    <i class="fas fa-tree text-success" style="margin-top:3px; font-size:1rem;"></i>
                    <div><b style="color:#0f172a;">Daftar Desa di Kec. ${namaWilayah} (${daftarDesa.split(',').length} Desa):</b><br><span>${daftarDesa}</span></div>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:16px; padding:2px;">
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-left:4px solid #0284c7; border-radius:10px; padding:12px 14px;"><div style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase;">Total Terdata</div><div style="font-size:1.15rem; font-weight:800; color:#0f172a; margin-top:2px;">${totalWilayah} <span style="font-size:0.75rem; font-weight:600; color:#64748b;">Jiwa</span></div></div>
                <div style="background:#ffffff; border:1px solid #bbf7d0; border-left:4px solid #16a34a; border-radius:10px; padding:12px 14px;"><div style="font-size:0.7rem; color:#15803d; font-weight:700; text-transform:uppercase;">Penerima (Desil 1–4)</div><div style="font-size:1.15rem; font-weight:800; color:#14532d; margin-top:2px;">${totalLayakWil} <span style="font-size:0.75rem; font-weight:600; color:#16a34a;">Warga</span></div></div>
                <div style="background:#ffffff; border:1px solid #fecaca; border-left:4px solid #dc2626; border-radius:10px; padding:12px 14px;"><div style="font-size:0.7rem; color:#b91c1c; font-weight:700; text-transform:uppercase;">Tidak Prioritas</div><div style="font-size:1.15rem; font-weight:800; color:#7f1d1d; margin-top:2px;">${totalTidakWil} <span style="font-size:0.75rem; font-weight:600; color:#b91c1c;">Warga</span></div></div>
                <div style="background:#ffffff; border:1px solid #fde68a; border-left:4px solid #d97706; border-radius:10px; padding:12px 14px;"><div style="font-size:0.7rem; color:#92400e; font-weight:700; text-transform:uppercase;">Alokasi Dana</div><div style="font-size:1.1rem; font-weight:800; color:#78350f; margin-top:2px;">Rp ${totalDanaWil.toLocaleString('id-ID')}</div></div>
            </div>
        `;
    }

    if (listWarga.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#64748b;">Belum ada data warga terdaftar di wilayah kecamatan ini.</td></tr>';
    } else {
        const baseUrl = window.API_BASE_URL || 'http://127.0.0.1:5000';
        listWarga.forEach((w, idx) => {
            const desilVal = w.desil || (w.is_verified ? 2 : 5);
            const isEligible = desilVal <= 4;
            const desilBadge = isEligible
                ? `<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:800; font-size:0.72rem; padding:4px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:3px;"><i class="fas fa-award"></i> DESIL ${desilVal}</span>`
                : `<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:700; font-size:0.72rem; padding:4px 8px; border-radius:12px;">DESIL ${desilVal}</span>`;

            const fotoBuktiHtml = w.bukti_salur
                ? `<img src="${baseUrl}/uploads/${w.bukti_salur}" style="width:42px; height:42px; border-radius:8px; object-fit:cover; cursor:pointer; border:1px solid #cbd5e1;" onclick="window.open('${baseUrl}/uploads/${w.bukti_salur}', '_blank')">`
                : '<span style="color:#94a3b8; font-size:0.75rem; font-style:italic;">Belum ada foto</span>';

            let gpsUrl = (w.lat && w.lng && !isNaN(parseFloat(w.lat)) && parseFloat(w.lat) !== 0)
                ? `https://www.google.com/maps?q=${parseFloat(w.lat).toFixed(6)},${parseFloat(w.lng).toFixed(6)}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(w.alamat || w.nama + ', ' + namaWilayah)}`;

            tbody.innerHTML += `
                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="text-align:center; font-weight:700; color:#64748b; font-size:0.8rem;">${idx + 1}</td>
                    <td><div style="font-weight:800; color:#0f172a; font-size:0.9rem;">${window.safeHtml(w.nama)}</div><small style="color:#64748b; font-family:monospace; font-size:0.78rem;">${w.nik}</small></td>
                    <td style="font-size:0.82rem; color:#334155;"><div>${window.safeHtml(w.tempat_lahir || 'Sidoarjo')}, ${w.tanggal_lahir || '-'}</div><small class="text-muted">${window.safeHtml(w.alamat)}</small></td>
                    <td style="text-align:center;">${desilBadge}</td>
                    <td style="text-align:center; font-size:0.8rem; color:#475569;">${w.tanggal_salur || '-'}</td>
                    <td><div style="color:#15803d; font-weight:800; font-size:0.85rem;">${w.nominal_bantuan || (isEligible ? 'Rp 600.000 / Beras 10 Kg' : '-')}</div></td>
                    <td style="text-align:center;">${fotoBuktiHtml}</td>
                    <td style="text-align:center;"><a href="${gpsUrl}" target="_blank" class="btn btn-sm" style="background:#e0f2fe; color:#0284c7; font-weight:700; font-size:0.75rem; padding:5px 12px; border-radius:20px; text-decoration:none;"><i class="fas fa-location-dot"></i> Peta</a></td>
                </tr>
            `;
        });
    }
    modal.style.display = 'flex';
};