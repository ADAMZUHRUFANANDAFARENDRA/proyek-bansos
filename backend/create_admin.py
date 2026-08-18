from app import app, db, User, bcrypt

# Fungsi ini langsung mengakses konteks aplikasi Flask dan Database
def buat_admin_baru():
    with app.app_context():
        print("=== PANEL PEMBUATAN ADMIN DINSOS SIDOARJO ===")
        username_input = input("Masukkan Username Admin baru : ").strip()
        password_input = input("Masukkan Password baru       : ").strip()
        role_input = input("Pilih Role (admin/operator)  : ").strip().lower()

        if not username_input or not password_input:
            print("❌ Gagal: Username dan Password tidak boleh kosong!")
            return

        if role_input not in ['admin', 'operator']:
            role_input = 'operator' # Default otomatis jika salah ketik

        # Cek apakah username sudah dipakai
        user_exist = User.query.filter_by(username=username_input).first()
        
        if user_exist:
            print(f"⚠️ Peringatan: Username '{username_input}' sudah ada di dalam sistem!")
        else:
            # Enkripsi sandi (Hashing)
            hashed_pw = bcrypt.generate_password_hash(password_input).decode('utf-8')
            
            # Buat objek pengguna baru
            new_user = User(username=username_input, password=hashed_pw, role=role_input)
            
            # Simpan ke Database
            db.session.add(new_user)
            db.session.commit()
            print(f"✅ Sukses! Akun '{username_input}' dengan hak akses '{role_input.upper()}' berhasil ditambahkan ke database.")

if __name__ == '__main__':
    buat_admin_baru()