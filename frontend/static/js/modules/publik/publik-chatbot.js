/**
 * Modul: publik-chatbot.js
 * Deskripsi: Asisten virtual cerdas informasi bantuan sosial Kabupaten Sidoarjo
 */

// 14. CHATBOT ASISTEN VIRTUAL & INVESTIGASI SENGKETA
// =========================================================================
window.toggleChatbotWindow = window.toggleModernChatbot = function () {
    const win = document.getElementById('chatbotWindow') || document.getElementById('chatbotBox');
    if (!win) return;
    win.style.display = (win.style.display === 'flex' || win.style.display === 'block') ? 'none' : 'flex';
};

window.botReplyFAQ = function (topic) {
    const body = document.getElementById('chatbotMsgBody') || document.getElementById('chatbotMessages');
    if (!body) return;

    let qText = topic === 'kriteria' ? 'Siapa yang berhak menerima bansos?' : 'Kapan bantuan fisik dicairkan?';
    let aText = topic === 'kriteria'
        ? 'Bansos diprioritaskan bagi keluarga yang masuk dalam <b>Desil 1–4</b> hasil kalkulasi kriteria BWM-SAW yang akuntabel.'
        : 'Penyaluran fisik dilaksanakan terjadwal di kantor kelurahan/desa setempat membawa KTP dan KK asli.';

    body.innerHTML += `<div class="user-bubble" style="background:#009846; color:white; padding:10px 14px; border-radius:14px; align-self:flex-end; max-width:80%; margin-bottom:6px;">${qText}</div>`;
    setTimeout(() => {
        body.innerHTML += `<div class="bot-bubble" style="background:white; padding:12px 16px; border-radius:14px; border:1px solid #e2e8f0; font-size:0.88rem; line-height:1.5; margin-bottom:6px;">${aText}</div>`;
        body.scrollTop = body.scrollHeight;
    }, 300);
};

window.kirimPilihanBot = function (teks) {
    const body = document.getElementById('chatbotMessages') || document.getElementById('chatbotMsgBody');
    if (!body) return;
    body.innerHTML += `<div style="background: #0284c7; color: white; padding: 10px 14px; border-radius: 14px; align-self: flex-end; font-size: 0.88rem; max-width: 80%; margin-bottom:6px;">${teks}</div>`;

    setTimeout(() => {
        let balasan = "Petugas kami siap membantu penanganan aduan Anda.";
        if (teks.toLowerCase().includes('berhak')) {
            balasan = "Berdasarkan regulasi resmi, keluarga pada <b>Desil 1 sampai dengan 4</b> merupakan prioritas mutlak penerima bantuan sosial reguler.";
        } else if (teks.toLowerCase().includes('kapan')) {
            balasan = "Pencairan bantuan fisik dilakukan bertahap di kantor desa/kelurahan setempat dan divalidasi langsung oleh pendamping lapangan.";
        }
        body.innerHTML += `<div style="background: white; padding: 12px 16px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 0.88rem; line-height: 1.5; margin-bottom:6px;">${balasan}</div>`;
        body.scrollTop = body.scrollHeight;
    }, 350);
};

window.botSendMessage = window.kirimTeksBot = function () {
    const inp = document.getElementById('botInputText') || document.getElementById('chatbotInput');
    const txt = inp ? inp.value.trim() : '';
    if (!txt) return;
    inp.value = '';

    const body = document.getElementById('chatbotMsgBody') || document.getElementById('chatbotMessages');
    if (!body) return;
    body.innerHTML += `<div style="background: #0284c7; color: white; padding: 10px 14px; border-radius: 14px; align-self: flex-end; font-size: 0.88rem; max-width: 80%; margin-bottom:6px;">${safeHtml(txt)}</div>`;

    setTimeout(() => {
        body.innerHTML += `<div style="background: white; padding: 12px 16px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 0.88rem; line-height: 1.5; margin-bottom:6px;">Terima kasih atas pertanyaan Anda. Jika menemui kendala spesifik saat mendaftar, silakan gunakan tombol <b>Laporkan Masalah / Gagal Daftar</b> di atas.</div>`;
        body.scrollTop = body.scrollHeight;
    }, 350);
};

window.botBukaFormLapor = window.bukaFormLaporKendalaBot = async function () {
    window.toggleChatbotWindow();

    const { value: formValues } = await Swal.fire({
        title: '<i class="fas fa-shield-virus text-danger"></i> Laporkan Masalah / Gagal Daftar',
        html: `
            <div style="text-align:left; font-size:0.88rem;">
                <p style="margin-bottom:12px; color:#64748b;">Gunakan jalur ini jika Anda belum terdaftar atau terkendala teknis saat proses pendaftaran bansos.</p>
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Nomor Induk Kependudukan (NIK)</label>
                <input type="number" id="botSwalNik" class="form-input" placeholder="16 digit NIK KTP" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Nama Lengkap</label>
                <input type="text" id="botSwalNama" class="form-input" placeholder="Nama Anda" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Uraian Kendala yang Dialami</label>
                <textarea id="botSwalPesan" class="form-input" rows="3" placeholder="Contoh: NIK tidak terbaca, gagal kirim formulir, dll..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;"></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Buka Dashboard Pengaduan',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const nik = document.getElementById('botSwalNik')?.value.trim();
            const nama = document.getElementById('botSwalNama')?.value.trim();
            const pesan = document.getElementById('botSwalPesan')?.value.trim();
            if (!nik || nik.length !== 16) {
                Swal.showValidationMessage('Masukkan tepat 16 digit NIK!');
                return false;
            }
            if (!nama || !pesan) {
                Swal.showValidationMessage('Nama dan uraian kendala wajib ditulis!');
                return false;
            }
            return { nik, nama, pesan };
        }
    });

    if (formValues) {
        window.masukDashboardPengaduan(formValues.nik, formValues.nama, formValues.pesan, true);
    }
};

// =========================================================================
