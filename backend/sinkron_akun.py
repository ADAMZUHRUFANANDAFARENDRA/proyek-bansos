from app import app, db, User
from werkzeug.security import generate_password_hash

with app.app_context():
    # Daftar akun dinas yang akan diperbarui/dibuat
    daftar_akun = [
        {"username": "admin", "pass": "admin123", "role": "admin"},
        {"username": "admin2", "pass": "admin123", "role": "admin"},
        {"username": "petugas", "pass": "12345", "role": "operator"},
        {"username": "petugas2", "pass": "12345", "role": "operator"}
    ]

    print("=" * 50)
    print("MEMPERBARUI KREDENSIAL DAN HASH PASSWORD DATABASE...")
    print("=" * 50)

    for data in daftar_akun:
        u = User.query.filter_by(username=data["username"]).first()
        hashed_pass = generate_password_hash(data["pass"], method="pbkdf2:sha256")
        
        if u:
            u.password = hashed_pass
            u.role = data["role"]
            print(f"[DIPERBARUI] Akun '{data['username']}' -> Password disetel: '{data['pass']}'")
        else:
            new_u = User(
                username=data["username"],
                password=hashed_pass,
                role=data["role"],
                email=f"{data['username']}@sidoarjo.go.id"
            )
            db.session.add(new_u)
            print(f"[DIBUAT] Akun '{data['username']}' -> Password: '{data['pass']}'")

    db.session.commit()
    print("=" * 50)
    print("SINKRONISASI AKUN BERHASIL LENGKAP!")
    print("=" * 50)