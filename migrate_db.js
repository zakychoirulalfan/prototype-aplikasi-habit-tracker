require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrateDatabase() {
    console.log('🔄 Memulai migrasi tabel ke Aiven Cloud...');
    
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT) || 21677,
            ssl: { rejectUnauthorized: false },
            multipleStatements: true // Penting agar bisa eksekusi banyak query sekaligus
        });

        // Membaca file SQL
        const sqlPath = path.join(__dirname, 'setup_database.sql');
        let sqlScript = fs.readFileSync(sqlPath, 'utf8');

        // Menghapus perintah yang tidak didukung/berbahaya di Aiven
        // Aiven biasanya memblokir CREATE DATABASE dan USE untuk user biasa
        sqlScript = sqlScript.replace(/CREATE DATABASE IF NOT EXISTS[^;]+;/g, '');
        sqlScript = sqlScript.replace(/USE habit_tracker;/g, '');

        console.log('⏳ Menjalankan script SQL...');
        await pool.query(sqlScript);

        console.log('✅ BERHASIL! Semua tabel (users, categories, habits, dll) telah terbuat di Aiven Cloud!');
        process.exit(0);
    } catch (error) {
        console.error('❌ GAGAL:', error.message);
        process.exit(1);
    }
}

migrateDatabase();
