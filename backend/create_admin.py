"""
=============================================================================
CLI SEEDER & MANAJEMEN AKUN DINAS SOSIAL SIDOARJO
File: backend/create_admin.py
Menggunakan konteks SQLAlchemy dan Bcrypt langsung dari app.py
=============================================================================
"""

import sys
from app import app, db, User, bcrypt

def buat_admin_baru():
    with app.app_context():
        print("==================================================")
        print("  PANEL PEMBUATAN AKUN APARATUR DINSOS SIDOARJO   ")
        print("==================================================")
        
        username_input = input("Masukkan Username Akun        : ").strip()
        if not username_input:
            print("❌ Gagal: Username tidak boleh kosong!\n")
            return

        # Cek apakah username sudah ada dalam tabel user
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

            user_exist.password = bcrypt.generate_password_hash(password_baru).decode('utf-8')
            db.session.commit()
            print(f"✅ Sukses! Kata sandi untuk '{username_input}' berhasil diperbarui ke database.\n")
            return

        # Input data untuk akun baru
        password_input = input("Masukkan Password             : ").strip()
        if not password_input:
            print("❌ Gagal: Password tidak boleh kosong!\n")
            return

        email_default = f"{username_input.lower()}@sidoarjo.go.id"
        email_input = input(f"Masukkan Email [{email_default}]: ").strip()
        if not email_input:
            email_input = email_default

        print("\nPilihan Hak Akses:")
        print("  1. admin    (Akses Penuh: SPK, Manajemen User, Verifikasi Massal, Arsip)")
        print("  2. operator (Petugas Lapangan: Survei Warga, Live Chat, Unggah Bukti Salur)")
        role_pilihan = input("Pilih Role (admin/operator) [operator]: ").strip().lower()

        if role_pilihan in ['1', 'admin']:
            role_final = 'admin'
        else:
            role_final = 'operator'

        # Enkripsi kata sandi via Bcrypt
        hashed_pw = bcrypt.generate_password_hash(password_input).decode('utf-8')

        # Buat entitas akun baru sesuai model User
        new_user = User(
            username=username_input,
            email=email_input,
            password=hashed_pw,
            role=role_final
        )

        try:
            db.session.add(new_user)
            db.session.commit()
            print(f"\n✅ Sukses! Akun '{username_input}' ({email_input}) dengan hak akses '{role_final.upper()}' berhasil ditambahkan ke database.")
            print("==================================================\n")
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Terjadi kesalahan saat menyimpan ke database: {str(e)}\n")

def auto_seed_default():
    """Menyiapkan akun dinas standar jika tabel user masih kosong."""
    with app.app_context():
        defaults = [
            ("admin", "admin@sidoarjo.go.id", "admin123", "admin"),
            ("petugas", "petugas@sidoarjo.go.id", "12345", "operator")
        ]
        created = 0
        for uname, uemail, upass, urole in defaults:
            if not User.query.filter_by(username=uname).first():
                h_pw = bcrypt.generate_password_hash(upass).decode('utf-8')
                db.session.add(User(username=uname, email=uemail, password=h_pw, role=urole))
                created += 1
        if created > 0:
            db.session.commit()
            print(f"ℹ️  {created} akun bawaan (admin & petugas) berhasil diinisialisasi.")

if __name__ == '__main__':
    auto_seed_default()
    buat_admin_baru()