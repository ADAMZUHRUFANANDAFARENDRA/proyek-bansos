"""
=============================================================================
CLI SEEDER & MANAJEMEN AKUN DINAS SOSIAL KABUPATEN SIDOARJO
File: backend/create_admin.py
Arsitektur: Modular Clean Architecture (Factory Pattern)
Fungsi:
1. Inisialisasi otomatis akun default (Super Admin & Petugas)
2. Inisialisasi otomatis 10 kriteria evaluasi SPK BWM-SAW
3. CLI interaktif pembuatan dan pembaruan kata sandi akun aparatur dinas
=============================================================================
"""

import sys
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.kriteria import Kriteria
from app.services.spk_saw_service import SPKSawService

app = create_app()

def sync_kriteria_default():
    """Menyelaraskan 10 parameter kriteria baku BWM-SAW ke database."""
    with app.app_context():
        try:
            ditambahkan = 0
            for k in SPKSawService.KRITERIA_METADATA:
                terdaftar = Kriteria.query.filter_by(kode=k["code"]).first()
                if not terdaftar:
                    entitas_kriteria = Kriteria(
                        kode=k["code"],
                        nama=k["name"],
                        jenis=k["type"],
                        bobot=k["default_w"],
                        keterangan=f"Parameter penilaian resmi {k['name']}"
                    )
                    db.session.add(entitas_kriteria)
                    ditambahkan += 1

            if ditambahkan > 0:
                db.session.commit()
                print(f"[*] Berhasil menyelaraskan {ditambahkan} kriteria baku BWM-SAW ke database.")
            else:
                print("[i] 10 Kriteria BWM-SAW sudah terdaftar dan siap digunakan.")
        except Exception as e:
            db.session.rollback()
            print(f"[!] Peringatan saat menyelaraskan kriteria: {str(e)}")

def auto_seed_default():
    """Menyiapkan akun dinas standar jika tabel pengguna belum memiliki akun."""
    with app.app_context():
        defaults = [
            ("admin", "admin@sidoarjo.go.id", "admin123", "super_admin", "Admin 1 (Super Admin)"),
            ("petugas", "petugas@sidoarjo.go.id", "12345", "petugas", "Petugas Lapangan Dinsos")
        ]
        created = 0
        for uname, uemail, upass, urole, unama in defaults:
            user_exist = User.query.filter_by(username=uname).first()
            if not user_exist:
                user_baru = User(
                    username=uname,
                    email=uemail,
                    role=urole,
                    nama_lengkap=unama,
                    is_active=True
                )
                user_baru.set_password(upass)
                db.session.add(user_baru)
                created += 1

        if created > 0:
            db.session.commit()
            print(f"ℹ️  {created} akun dinas standar (admin & petugas) berhasil diinisialisasi.")
        else:
            print("[i] Akun dinas standar sudah aktif di dalam basis data.")

def buat_admin_baru():
    """Panel CLI interaktif pembuatan dan pengelolaan akun aparatur dinas sosial."""
    with app.app_context():
        print("\n==================================================")
        print("  PANEL PEMBUATAN AKUN APARATUR DINSOS SIDOARJO   ")
        print("==================================================")
        
        username_input = input("Masukkan Username Akun        : ").strip()
        if not username_input:
            print("❌ Gagal: Username tidak boleh kosong!\n")
            return

        # Cek apakah username sudah ada dalam tabel database
        user_exist = User.query.filter_by(username=username_input).first()
        if user_exist:
            print(f"\n⚠️  Peringatan: Pengguna '{username_input}' sudah terdaftar (Role: {user_exist.role.upper()}).")
            konfirmasi = input("Apakah Anda ingin memperbarui kata sandi pengguna ini? (y/n): ").strip().lower()
            if konfirmasi != 'y':
                print("Operasi dibatalkan.\n")
                return
            
            password_baru = input("Masukkan Password baru        : ").strip()
            if not password_baru:
                print("❌ Gagal: Kata sandi baru tidak boleh kosong!\n")
                return

            user_exist.set_password(password_baru)
            try:
                db.session.commit()
                print(f"✅ Sukses! Kata sandi untuk '{username_input}' berhasil diperbarui ke database.\n")
            except Exception as e:
                db.session.rollback()
                print(f"❌ Gagal memperbarui sandi: {str(e)}\n")
            return

        # Input data untuk akun baru
        password_input = input("Masukkan Password             : ").strip()
        if not password_input:
            print("❌ Gagal: Password tidak boleh kosong!\n")
            return

        nama_input = input("Masukkan Nama Lengkap Pegawai : ").strip()
        if not nama_input:
            nama_input = username_input.title()

        email_default = f"{username_input.lower()}@sidoarjo.go.id"
        email_input = input(f"Masukkan Email [{email_default}]: ").strip()
        if not email_input:
            email_input = email_default

        print("\nPilihan Hak Akses:")
        print("  1. super_admin (Akses Penuh: SPK, Manajemen Akun, Verifikasi Massal, Arsip)")
        print("  2. admin       (Administrator: Evaluasi SPK, Manajemen Data Warga, BWM)")
        print("  3. petugas     (Petugas Lapangan: Survei Verifikasi, Live Chat, Mediasi Sengketa)")
        role_pilihan = input("Pilih Role (1/2/3) [3]: ").strip().lower()

        if role_pilihan in ['1', 'super_admin']:
            role_final = 'super_admin'
        elif role_pilihan in ['2', 'admin']:
            role_final = 'admin'
        else:
            role_final = 'petugas'

        # Buat entitas akun baru sesuai model User
        new_user = User(
            username=username_input,
            nama_lengkap=nama_input,
            email=email_input,
            role=role_final,
            is_active=True
        )
        new_user.set_password(password_input)

        try:
            db.session.add(new_user)
            db.session.commit()
            print(f"\n✅ Sukses! Akun '{username_input}' ({email_input}) dengan hak akses '{role_final.upper()}' berhasil ditambahkan ke database.")
            print("==================================================\n")
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Terjadi kesalahan saat menyimpan ke database: {str(e)}\n")

if __name__ == '__main__':
    auto_seed_default()
    sync_kriteria_default()
    
    # Jika dijalankan tanpa parameter tambahan, buka CLI pembuatan akun interaktif
    if len(sys.argv) == 1:
        buat_admin_baru()