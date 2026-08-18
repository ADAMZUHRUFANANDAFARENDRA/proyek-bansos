/* =========================================================
   GLOBAL JAVASCRIPT - PERBAIKAN JARINGAN OTOMATIS
========================================================= */
// KODE AJAIB: Otomatis mendeteksi IP/Localhost yang sedang digunakan
const API_URL = window.location.protocol + "//" + window.location.hostname + ":5000";

window.COORDS_SIDOARJO_CENTER = [-7.4478, 112.7183]; 

window.getCleanToken = function() {
    let t = localStorage.getItem('token') || localStorage.getItem('bansosToken');
    if (!t || t === 'undefined' || t === 'null') return '';
    return t.replace(/^["']+|["']+$/g, ''); 
};

window.fetchData = async function(url, options = {}) { 
    const token = window.getCleanToken(); 
    options.headers = { 'Authorization': `Bearer ${token}`, ...options.headers }; 
    const res = await fetch(API_URL + url + (url.includes('?')?'&':'?') + 'token=' + token, options); 
    if (res.status === 401) { window.logout(); } 
    return res; 
};

window.openLightbox = function(type, src) { 
    const content = document.getElementById('lightboxContent'); 
    if (type === 'image') { content.innerHTML = `<img src="${src}" style="max-width:100%; max-height:85vh; object-fit:contain; border-radius:8px;">`; } 
    else { content.innerHTML = `<video src="${src}" controls autoplay style="max-width:100%; max-height:85vh; border-radius:8px; outline:none; background:black;"></video>`; } 
    document.getElementById('mediaLightbox').style.display = 'flex'; 
};

window.closeLightbox = function(e) { 
    if (e.target.id === 'mediaLightbox' || e.target.classList.contains('close-lightbox-btn')) { 
        const mediaElements = document.querySelectorAll('#lightboxContent video, #lightboxContent audio'); 
        mediaElements.forEach(media => { media.pause(); media.removeAttribute('src'); media.load(); }); 
        document.getElementById('mediaLightbox').style.display = 'none'; 
        document.getElementById('lightboxContent').innerHTML = ''; 
    } 
};

window.openModalUniversal = function(id) { document.getElementById(id).style.display = 'flex'; };
window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; };
window.logout = function() { localStorage.removeItem('token'); localStorage.removeItem('bansosToken'); localStorage.removeItem('bansosUser'); window.location.href = 'login.html'; };