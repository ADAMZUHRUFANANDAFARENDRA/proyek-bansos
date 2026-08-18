import pandas as pd
import random
from datetime import datetime, timedelta

# Konfigurasi Generate Data
TOTAL_DATA = 100

# Kumpulan sampel nama
first_names = ["Budi", "Siti", "Agus", "Sri", "Joko", "Endang", "Wahyu", "Nur", "Heri", "Ani", 
               "Adam", "Evelyn", "Renda", "Khofifah", "Hkang", "Ahmad", "Ayu", "Rizky", "Dwi", 
               "Dimas", "Putri", "Surya", "Dewi", "Gilang", "Lestari", "Ananda", "Zuhruf", "Farendra"]
last_names = ["Santoso", "Wati", "Pratama", "Lestari", "Saputra", "Sari", "Kusuma", "Rahayu", 
              "Setiawan", "Hidayah", "Wijaya", "Ningsih", "Putra", "Astuti", "Arifin", "Handayani"]

# Kumpulan desa/jalan di area Sidoarjo
villages = ["Desa Cemandi", "Desa Pabean", "Desa Sedati Gede", "Desa Sedati Agung", "Desa Betro", "Desa Kalanganyar", "Desa Buncitan"]
streets = ["Jl. Raya Cemandi", "Jl. Garuda", "Jl. Merpati", "Jl. Rajawali", "Jl. Kenari", "Jl. Pahlawan", "Jl. Brawijaya", "Jl. Diponegoro"]

# Center koordinat Sidoarjo (-7.4478, 112.7183)
CENTER_LAT = -7.4478
CENTER_LNG = 112.7183

def random_date(start_year, end_year):
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    return start + timedelta(days=random.randint(0, (end - start).days))

data = []

for i in range(TOTAL_DATA):
    # Identitas
    fn = random.choice(first_names)
    ln = random.choice(last_names)
    nama = f"{fn} {ln}"
    
    # NIK Sidoarjo (3515) + 12 digit acak
    nik = f"3515{random.randint(100000000000, 999999999999)}"
    
    # Kontak
    no_wa = f"08{random.randint(100000000, 999999999)}"
    email = f"{fn.lower()}.{ln.lower()}{random.randint(1,99)}@gmail.com"
    
    # TTL
    tempat_lahir = random.choice(["Sidoarjo", "Surabaya", "Gresik", "Mojokerto", "Malang"])
    # Agar umur (C3) rasional, kita generate tahun lahir antara 1950 - 2005
    tgl_lahir_dt = random_date(1950, 2005)
    tgl_lahir = tgl_lahir_dt.strftime("%Y-%m-%d")
    
    # Alamat
    alamat = f"{random.choice(streets)} No.{random.randint(1, 100)}, RT {random.randint(1, 30)}/RW {random.randint(1, 10)}, {random.choice(villages)}, Kec. Sedati, Kabupaten Sidoarjo"
    
    # Koordinat acak di sekitar Sidoarjo (+- 0.05 derajat)
    lat = round(CENTER_LAT + random.uniform(-0.05, 0.05), 6)
    lng = round(CENTER_LNG + random.uniform(-0.05, 0.05), 6)
    
    # Kuesioner (C1 - C10)
    c1_ekonomi = round(random.uniform(500000, 5000000), 2)  # Pendapatan
    c2_aset = random.randint(1000000, 50000000)             # Nilai aset
    
    # Hitung umur (C3) di tahun 2026 berdasarkan tanggal lahir
    c3_umur = 2026 - tgl_lahir_dt.year
    
    c4_jenis_kelamin = random.choice([1, 2])                # 1: Laki, 2: Perempuan
    c5_tanggungan = random.randint(0, 5)                    # Jumlah tanggungan
    c6_status_pernikahan = random.choice([1, 2, 3, 4])      # 1: Belum, 2: Menikah, 3: Cerai Hidup/Mati, 4: Cerai
    
    # Logika anak (C7): tidak mungkin melebihi tanggungan, dan sangat kecil kemungkinan punya anak jika statusnya 1 (Belum menikah)
    if c6_status_pernikahan == 1:
        c7_anak = 0
    else:
        c7_anak = random.randint(0, c5_tanggungan)
        
    c8_tempat_tinggal = random.choice([1, 2, 3])            # 1: Milik, 2: Sewa, 3: Numpang
    c9_pendidikan = random.choice([1, 2, 3])                # 1: SD, 2: SMP/SMA, 3: Diploma/Sarjana
    
    # C10 Kesehatan: (Peluang 80% Sehat, 20% Sakit)
    c10_kesehatan = 1 if random.random() < 0.8 else 2       
    
    # Catatan Lapangan
    catatan_list = [
        "Kondisi rumah semi permanen.", 
        "Pekerja harian lepas, pendapatan tidak menentu.",
        "Lansia sebatang kara.",
        "Memiliki aset motor bebek tahun lama.",
        "Rumah sewa per bulan.",
        "Kondisi sehat namun terdampak PHK.",
        "Sering sakit-sakitan, tidak bisa bekerja berat.",
        "Rumah milik keluarga besar (numpang).",
        "Warga koperatif saat disurvei.",
        ""
    ]
    catatan = random.choice(catatan_list)

    # Simpan sebagai dictionary
    data.append({
        "Nama": nama,
        "NIK": nik,
        "Alamat Lengkap": alamat,
        "No. WA": no_wa,
        "Email": email,
        "Tempat Lahir": tempat_lahir,
        "Tanggal Lahir": tgl_lahir,
        "Garis Lintang": lat,
        "Garis Bujur": lng,
        "C1": c1_ekonomi,
        "C2": c2_aset,
        "C3": c3_umur,
        "C4": c4_jenis_kelamin,
        "C5": c5_tanggungan,
        "C6": c6_status_pernikahan,
        "C7": c7_anak,
        "C8": c8_tempat_tinggal,
        "C9": c9_pendidikan,
        "C10": c10_kesehatan,
        "Catatan": catatan
    })

# Konversi ke DataFrame Pandas
df = pd.DataFrame(data)

# Simpan ke Excel
nama_file = "data_100_warga_sidoarjo.xlsx"
df.to_excel(nama_file, index=False)

print(f"Data 100 warga berhasil di-generate dan disimpan ke dalam file: '{nama_file}'")