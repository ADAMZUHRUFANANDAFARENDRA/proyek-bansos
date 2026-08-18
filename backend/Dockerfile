# Menggunakan Python 3.9 yang stabil
FROM python:3.9-slim

# Menentukan lokasi kerja di dalam container
WORKDIR /app

# Menyalin file requirements dan menginstalnya
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Menyalin seluruh file backend
COPY . .

# Membuka port 5000 untuk Flask
EXPOSE 5000

# Menjalankan aplikasi
CMD ["python", "app.py"]