/**
 * Modul: admin-investigasi.js
 * Deskripsi: Investigasi sengketa dan aduan penyaluran bantuan sosial warga
 */

// 21. INVESTIGASI & SENGKETA ADUAN
// =========================================================================
window.loadLaporanChatData = async function () {
    const container = document.getElementById('laporanChatList');
    if (!container) return;

    try {
        const token = window.getCleanToken();
        const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

        const laporanEndpoints = [
            `${window.BASE_URL}/api/laporan-chat`,
            `${window.BASE_URL}/api/chat/laporan`,
            `${window.BASE_URL}/api/pengaduan`,
            `${window.BASE_URL}/laporan-chat`
        ];

        let res = null;
        for (const url of laporanEndpoints) {
            try {
                let testRes = await fetch(url, { headers });
                if (testRes.status === 401 || testRes.status === 422) {
                    testRes = await fetch(url, { headers: { 'Accept': 'application/json' } });
                }
                if (testRes && testRes.ok) {
                    res = testRes;
                    break;
                }
            } catch (e) {}
        }

        if (res && res.ok) {
            const resJson = await res.json();
            window.allLaporanChatData = Array.isArray(resJson) ? resJson : (resJson.data || []);
            renderLaporanChat(window.allLaporanChatData);
        } else {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8;">Belum ada laporan sengketa atau aduan warga yang masuk.</div>';
        }
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#ef4444;">Gagal mengambil data laporan investigasi.</div>';
    }
};

window.bukaChatDariAduan = function (nik) {
    window.closeModal('modalLaporanChat');
    if (typeof window.openAdminChat === 'function') window.openAdminChat();
    setTimeout(() => {
        const search = document.getElementById('searchChatInput');
        if (search) {
            search.value = nik;
            if (typeof window.filterChatList === 'function') window.filterChatList();
        }
        if (typeof window.selectWargaChat === 'function') window.selectWargaChat(nik);
    }, 300);
};

function renderLaporanChat(data) {
    const container = document.getElementById('laporanChatList');
    if (!container) return;

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8;">Tidak ada laporan yang sesuai kriteria.</div>';
        return;
    }

    container.innerHTML = data.map(item => `
        <div class="card" style="padding:20px; margin-bottom:16px; border:1.5px solid #e2e8f0; border-radius:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-weight:800; font-size:0.88rem; color:#dc2626;"><i class="fas fa-shield-virus"></i> ${item.id} — ${item.kategori}</span>
                <span style="font-size:0.75rem; color:#64748b; font-weight:700;">${item.waktu || ''}</span>
            </div>
            <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-bottom:6px;">Pelapor: ${item.nama} • NIK: <span class="font-mono text-primary">${item.nik}</span></div>
            <div style="background:#f8fafc; padding:12px 16px; border-radius:14px; font-size:0.88rem; color:#334155; margin-bottom:14px; border:1px solid #e2e8f0;">${item.uraian || item.deskripsi || '-'}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="badge" style="background:#fee2e2; color:#dc2626; font-weight:800; padding: 6px 14px; border-radius: 20px;">Tahap: ${item.status_text || item.status || 'Tinjauan'}</span>
                <button onclick="window.bukaChatDariAduan('${item.nik}')" class="btn btn-primary btn-sm" style="border-radius:24px; padding:7px 16px;"><i class="fas fa-comments"></i> Buka Chat Mediasi Warga</button>
            </div>
        </div>
    `).join('');
}

window.filterInvestigasi = function (filterType, btn) {
    if (btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('button').forEach(b => {
            b.className = 'btn btn-secondary btn-sm';
            b.style.color = '';
            b.style.borderColor = '';
            b.style.borderRadius = '20px';
        });
        btn.className = 'btn btn-primary btn-sm';
        btn.style.borderRadius = '20px';
    }

    let filtered = window.allLaporanChatData || [];
    if (filterType === 'urgent') {
        filtered = filtered.filter(x => (x.kategori && x.kategori.toLowerCase().includes('urgent')) || (x.uraian && x.uraian.toLowerCase().includes('urgent')));
    } else if (filterType === 'sengketa') {
        filtered = filtered.filter(x => (x.kategori && x.kategori.toLowerCase().includes('sengketa')) || (x.kategori && x.kategori.toLowerCase().includes('salur')));
    } else if (filterType === 'data') {
        filtered = filtered.filter(x => (x.kategori && x.kategori.toLowerCase().includes('data')) || (x.kategori && x.kategori.toLowerCase().includes('nik')));
    }
    renderLaporanChat(filtered);
};

window.bukaMediaLightbox = function (url) {
    const modal = document.getElementById('mediaLightbox');
    const container = document.getElementById('lightboxContent');
    if (!modal || !container) return;
    container.innerHTML = `<img src="${url}" style="max-width:90vw; max-height:80vh; border-radius:12px; object-fit:contain;" />`;
    modal.style.display = 'flex';
};

window.closeLightbox = function (e) {
    if (!e || e.target.id === 'mediaLightbox' || e.target.classList.contains('close-lightbox-btn')) {
        const modal = document.getElementById('mediaLightbox');
        const container = document.getElementById('lightboxContent');
        if (container) container.innerHTML = '';
        if (modal) modal.style.display = 'none';
    }
};

window.bukaWilayahDetail = function (kecamatanNama) {
    const modal = document.getElementById('modalWilayahDetail');
    const titleEl = document.getElementById('modalWilayahTitle');
    const tbody = document.getElementById('wilayahDetailTbody');
    if (!modal || !tbody) return;

    if (titleEl) titleEl.innerText = kecamatanNama || 'Kabupaten Sidoarjo';
    const dataList = window.globalDataWarga || [];
    const filtered = dataList.filter(w => String(w.alamat || '').toLowerCase().includes(String(kecamatanNama || '').toLowerCase()));

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#94a3b8;">Tidak ada data warga terdaftar di wilayah ini.</td></tr>';
    } else {
        tbody.innerHTML = filtered.map((w, idx) => `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><b>${window.safeHtml(w.nama)}</b><br><small class="text-muted font-mono">${w.nik}</small></td>
                <td>${window.safeHtml(w.alamat || '-')}</td>
                <td style="text-align:center;"><span class="badge badge-blue">Desil ${w.desil || 5}</span></td>
                <td>${w.status_salur === 'Telah Menerima' ? 'Telah Menerima' : 'Belum Salur'}</td>
                <td>Rp 600.000,-</td>
                <td style="text-align:center;">${w.bukti_salur ? '<i class="fas fa-check text-success"></i>' : '-'}</td>
                <td style="text-align:center;">${w.lat && w.lng ? `${Number(w.lat).toFixed(4)},${Number(w.lng).toFixed(4)}` : '-'}</td>
            </tr>
        `).join('');
    }

    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
};

// =========================================================================
