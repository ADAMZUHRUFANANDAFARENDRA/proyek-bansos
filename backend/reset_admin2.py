from app import app, db, User
from werkzeug.security import generate_password_hash

with app.app_context():
    print("=" * 45)
    print("DAFTAR USER TERDAFTAR DI DATABASE SAAT INI:")
    print("=" * 45)
    all_users = User.query.all()
    if not all_users:
        print("(Tabel user masih kosong)")
    else:
        for u in all_users:
            print(f"- ID: {u.id} | Username: '{u.username}' | Role: {u.role}")
    print("=" * 45)

    # Target akun yang ingin dibuat / di-reset
    target_username = "admin2"  # Sesuaikan dengan username yang Anda ketik saat login
    new_password = "password_admin2_anda"  # Ganti dengan password yang Anda inginkan
    target_role = "admin"  # atau 'operator'

    user = User.query.filter_by(username=target_username).first()
    hashed = generate_password_hash(new_password, method="pbkdf2:sha256")

    if user:
        user.password = hashed
        db.session.commit()
        print(
            f"[BERHASIL DIPERBARUI] Password untuk '{target_username}' berhasil di-hash ulang."
        )
    else:
        new_user = User(
            username=target_username,
            password=hashed,
            role=target_role,
            email=f"{target_username}@sidoarjo.go.id",
        )
        db.session.add(new_user)
        db.session.commit()
        print(
            f"[BERHASIL DIBUAT] Akun baru '{target_username}' berhasil ditambahkan ke database."
        )

    print(f"-> Silakan login dengan Username: '{target_username}'")
    print(f"-> Password: '{new_password}'")
    print("=" * 45)