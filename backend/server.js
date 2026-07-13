const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./backend/db');

const app = express();
// Menggunakan process.env.PORT sangat WAJIB untuk Render.com
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// WAJIB: Menyajikan (serve) file statis dari folder "public"
// Ini akan membuat file HTML/CSS/JS kamu bisa diakses secara publik
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// ENDPOINT API (CRUD HABIT)
// ==========================================

// 1. Ambil semua habit
app.get('/api/habits', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM habits ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Tambah habit baru
app.post('/api/habits', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama habit diperlukan' });

    try {
        const [result] = await db.query('INSERT INTO habits (name) VALUES (?)', [name]);
        res.json({ id: result.insertId, name, is_completed: 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Update status habit (Selesai/Belum)
app.put('/api/habits/:id', async (req, res) => {
    const { id } = req.params;
    const { is_completed } = req.body;

    try {
        await db.query('UPDATE habits SET is_completed = ? WHERE id = ?', [is_completed, id]);
        res.json({ message: 'Status diperbarui' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Hapus habit
app.delete('/api/habits/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM habits WHERE id = ?', [id]);
        res.json({ message: 'Habit dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// JALANKAN SERVER
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
