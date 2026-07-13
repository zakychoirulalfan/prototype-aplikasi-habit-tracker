const mysql = require('mysql2');
require('dotenv').config();

// Menggunakan createPool lebih direkomendasikan untuk database cloud (Aiven/Render)
// dibanding createConnection biasa, agar koneksi tidak cepat putus/time-out.
const pool = mysql.createPool(process.env.DATABASE_URL);

// Mengecek koneksi
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Gagal terhubung ke Database Cloud Aiven:', err.message);
        return;
    }
    console.log('✅ Berhasil terhubung ke Database Cloud MySQL (Aiven)');
    connection.release(); // Lepaskan koneksi kembali ke pool
});

// Promisify agar kita bisa menggunakan async/await nanti
const db = pool.promise();

module.exports = db;
