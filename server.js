// ================================================================
// server.js — HabitFlow Backend (Full Custom MySQL)
// Runtime: Node.js | Framework: Express.js
// DB: MySQL via Laragon (mysql2) | Auth: bcryptjs + nodemailer
// Schema: users, categories, habits, progress_logs, password_resets
// ================================================================

require('dotenv').config(); // Harus di baris paling atas

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');   // built-in Node.js
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();

app.use(cors());
app.use(express.json());

// WAJIB UNTUK RENDER: Menyajikan file Frontend secara aman tanpa merusak path
const path = require('path');
app.use('/views', express.static(path.join(__dirname, 'views')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// Redirect otomatis ke index.html saat web pertama kali dibuka
app.get('/', (req, res) => {
    res.redirect('/views/index.html');
});// ================================================================
// 1. KONEKSI DATABASE (dari .env — Cloud Aiven)
// ================================================================
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 21677,
    // WAJIB UNTUK AIVEN (CLOUD) AGAR KONEKSI DITERIMA:
    ssl: {
        rejectUnauthorized: false
    }
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Koneksi ke Database Cloud Aiven Gagal:', err.stack);
        return;
    }
    console.log(`✅ Terhubung ke MySQL Cloud Aiven → database: ${process.env.DB_NAME}`);
    connection.release();
});


// ================================================================
// 2. KONFIGURASI NODEMAILER (SMTP Kustom dari .env)
// ================================================================
const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

mailer.verify((err, success) => {
    if (err) {
        console.error('❌ SMTP Koneksi GAGAL:', err.message);
        console.error('   → Cek SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT di file .env');
    } else {
        console.log(`✅ SMTP Siap! Terhubung ke ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} sebagai ${process.env.SMTP_USER}`);
    }
});

// ── Endpoint debug SMTP ──────────────────────────────────────────
app.get('/auth/test-smtp', async (req, res) => {
    mailer.verify((err, success) => {
        if (err) {
            return res.status(500).json({
                ok: false,
                message: 'Koneksi SMTP GAGAL',
                detail: err.message,
                tips: [
                    'Pastikan SMTP_USER dan SMTP_PASS di .env sudah benar',
                    'Untuk Gmail: gunakan App Password (bukan password biasa)',
                    'App Password: https://myaccount.google.com/apppasswords',
                    'Pastikan Verifikasi 2 Langkah aktif di akun Google kamu'
                ]
            });
        }
        return res.status(200).json({
            ok: true,
            message: `SMTP OK! Terhubung ke ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`,
            user: process.env.SMTP_USER
        });
    });
});


// ================================================================
// 3. ENDPOINT: Register Akun Baru
//    POST /api/register
//    Body: { username, email, password }
//    Schema baru: tidak ada kolom full_name, id = AUTO_INCREMENT
// ================================================================
app.post('/api/register', async (req, res) => {
    // fullName diterima tapi diabaikan — schema baru tidak punya kolom full_name
    const { username, email, password, fullName } = req.body;

    console.log('Register attempt:', { username, email, password: '***' });

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'Username, email, dan password wajib diisi.' });
    }

    if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password minimal 8 karakter.' });
    }

    try {
        const dbPromise = db.promise();

        // Hash password dengan bcrypt (cost factor 10)
        const passwordHash = await bcrypt.hash(password, 10);

        // INSERT — id auto-increment (4 digit zerofill dihandle oleh MySQL)
        const [result] = await dbPromise.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username.trim(), email.trim().toLowerCase(), passwordHash]
        );

        const userId = result.insertId;
        console.log(`✅ User baru terdaftar: ${email} (id: ${userId})`);
        return res.status(201).json({ success: true, message: 'Akun berhasil terdaftar!', userId });

    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            if (err.sqlMessage && err.sqlMessage.includes('email')) {
                return res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });
            }
            if (err.sqlMessage && err.sqlMessage.includes('username')) {
                return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
            }
        }
        console.error('❌ Register error:', err);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }
});

// ================================================================
// 4. ENDPOINT: Login
//    POST /api/login
//    Body: { email, password }
// ================================================================
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    console.log('Login attempt:', email);

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    }

    try {
        const dbPromise = db.promise();

        const [results] = await dbPromise.query(
            'SELECT id, username, email, password_hash FROM users WHERE email = ?',
            [email.trim().toLowerCase()]
        );

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Email atau password salah.' });
        }

        const user = results[0];

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Email atau password salah.' });
        }

        console.log(`✅ Login berhasil: ${user.email}`);

        return res.status(200).json({
            success: true,
            message: 'Login berhasil!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (err) {
        console.error('❌ Login error:', err);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }
});

// ================================================================
// 5. ENDPOINT: Forgot Password (Kirim Email Reset)
//    POST /auth/forgot-password
//    Body: { email }
//    Schema baru: password_resets menyimpan user_id (bukan email)
// ================================================================
app.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(`\n[DEBUG] 1. Menerima request forgot password untuk email: "${email}"`);

    if (!email || typeof email !== 'string' || !email.includes('@')) {
        console.log(`[DEBUG] -> Validasi gagal: Format email tidak valid.`);
        return res.status(400).json({ success: false, message: 'Format email tidak valid.' });
    }

    const safeEmail = email.trim().toLowerCase();

    try {
        const dbPromise = db.promise();

        // Cari user berdasarkan email
        const [users] = await dbPromise.query(
            'SELECT id, username FROM users WHERE email = ?',
            [safeEmail]
        );

        console.log(`[DEBUG] 2. Hasil pencarian DB untuk "${safeEmail}": Ditemukan ${users.length} user.`);

        // Selalu kembalikan respons sukses meski email tidak ada (anti user-enumeration)
        if (users.length === 0) {
            console.log(`[DEBUG] -> Email tidak ada di database. Respons sukses palsu dikirim.`);
            return res.status(200).json({
                success: true,
                message: 'Jika email terdaftar, tautan reset akan segera dikirim.'
            });
        }

        const user = users[0];

        // Generate token aman secara kriptografi (64 karakter hex)
        const token = crypto.randomBytes(32).toString('hex');

        // Hitung waktu kedaluwarsa
        const expMinutes = parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES) || 60;
        const expiresAt = new Date(Date.now() + expMinutes * 60 * 1000);
        const expiresAtMysql = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

        // Hapus token lama milik user ini dulu, lalu insert yang baru
        await dbPromise.query('DELETE FROM password_resets WHERE user_id = ?', [user.id]);
        await dbPromise.query(
            'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
            [user.id, token, expiresAtMysql]
        );
        console.log(`[DEBUG] 3. Token reset berhasil disimpan untuk user_id=${user.id}.`);

        const frontendUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5500/views';
        const resetLink = `${frontendUrl}/reset-password.html?token=${token}`;

        const htmlBody = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password — HabitFlow</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#10B981 0%,#059669 100%);padding:40px 40px 32px;text-align:center;">
              <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px;">🌿</div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">HabitFlow</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Reset Kata Sandi Kamu</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;color:#374151;font-size:16px;font-weight:600;">Halo, ${user.username}!</p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
                Kami menerima permintaan untuk mereset kata sandi akun HabitFlow kamu.
                Klik tombol di bawah untuk membuat kata sandi baru.
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetLink}"
                   style="display:inline-block;background:linear-gradient(135deg,#10B981 0%,#059669 100%);
                          color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;
                          padding:14px 40px;border-radius:12px;
                          box-shadow:0 4px 14px rgba(16,185,129,0.4);">
                  🔑 Reset Kata Sandi
                </a>
              </div>

              <!-- Info Box -->
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0;color:#065f46;font-size:13px;line-height:1.5;">
                  ⏰ <strong>Tautan ini berlaku selama ${expMinutes} menit</strong> dan hanya bisa digunakan sekali.
                </p>
              </div>

              <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;line-height:1.6;">
                Jika tombol di atas tidak berfungsi, salin dan tempel URL berikut ke browser kamu:
              </p>
              <p style="margin:0 0 24px;word-break:break-all;">
                <a href="${resetLink}" style="color:#10B981;font-size:12px;">${resetLink}</a>
              </p>

              <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;">

              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                Jika kamu tidak meminta reset kata sandi, abaikan email ini. Akun kamu tetap aman.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#d1d5db;font-size:11px;">
                © ${new Date().getFullYear()} HabitFlow. Semua hak dilindungi.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        console.log(`[DEBUG] 4. Mencoba mengirim email via Nodemailer...`);
        await mailer.sendMail({
            from: `"HabitFlow" <${process.env.SMTP_USER}>`,
            to: safeEmail,
            subject: '🔑 Reset Kata Sandi HabitFlow Kamu',
            html: htmlBody
        });

        console.log(`[DEBUG] 5. ✅ Email reset password BERHASIL terkirim ke: "${safeEmail}"`);
        return res.status(200).json({
            success: true,
            message: 'Jika email terdaftar, tautan reset akan segera dikirim.'
        });

    } catch (err) {
        console.error('\n[DEBUG] ❌ ERROR PADA PROSES FORGOT PASSWORD:');
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Gagal mengirim email. Pastikan konfigurasi SMTP di .env sudah benar.'
        });
    }
});

// ================================================================
// 6. ENDPOINT: Reset Password (Proses Token)
//    POST /auth/reset-password
//    Body: { token, newPassword }
//    Schema baru: token → user_id → UPDATE users by id
// ================================================================
app.post('/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string' || token.length !== 64) {
        return res.status(400).json({ success: false, message: 'Token tidak valid.' });
    }
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'Password baru minimal 8 karakter.' });
    }

    try {
        const dbPromise = db.promise();

        // Cari token di password_resets
        const [resets] = await dbPromise.query(
            'SELECT user_id, expires_at FROM password_resets WHERE token = ?',
            [token]
        );

        if (resets.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Token tidak valid atau sudah tidak aktif.'
            });
        }

        const reset = resets[0];

        // Cek apakah token sudah kedaluwarsa
        if (new Date() > new Date(reset.expires_at)) {
            await dbPromise.query('DELETE FROM password_resets WHERE token = ?', [token]);
            return res.status(400).json({
                success: false,
                message: 'Token sudah kedaluwarsa. Silakan minta reset password baru.'
            });
        }

        // Token valid — hash password baru
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // UPDATE password_hash di tabel users berdasarkan user_id
        const [updateResult] = await dbPromise.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [newPasswordHash, reset.user_id]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan. Hubungi admin.'
            });
        }

        // HAPUS token agar tidak bisa di-reuse
        await dbPromise.query('DELETE FROM password_resets WHERE user_id = ?', [reset.user_id]);

        console.log(`✅ Password berhasil direset untuk user_id: ${reset.user_id}`);
        return res.status(200).json({
            success: true,
            message: 'Password berhasil direset! Silakan login dengan password baru kamu.'
        });

    } catch (err) {
        console.error('❌ Reset password error:', err);
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server.'
        });
    }
});

// ================================================================
// 7. ENDPOINT: Submit Feedback / Rate App
//    POST /api/feedback
//    Header: X-User-Id: <user_id>
//    Body: { rating: 1-5, comments }
// ================================================================
app.post('/api/feedback', async (req, res) => {
    const { rating, comments } = req.body;
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ success: false, message: 'User tidak terautentikasi.' });
    }

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ success: false, message: 'Rating harus antara 1 dan 5.' });
    }

    const safeComments = (comments && typeof comments === 'string')
        ? comments.trim().substring(0, 1000)
        : null;

    try {
        const dbPromise = db.promise();
        await dbPromise.query(
            'INSERT INTO app_feedback (user_id, rating, comments) VALUES (?, ?, ?)',
            [userId, ratingNum, safeComments]
        );
        console.log(`✅ Feedback dari user_id=${userId}, rating=${ratingNum}`);
        return res.status(201).json({ success: true, message: 'Feedback berhasil dikirim! Terima kasih.' });
    } catch (err) {
        console.error('❌ Feedback error:', err);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan feedback.' });
    }
});

// ================================================================
// 8. ENDPOINT: Categories
//    GET  /api/categories  — Ambil semua kategori (standard + milik user)
//    POST /api/categories  — Buat kategori kustom baru
// ================================================================

// GET semua kategori (standard + kustom milik user yang sedang login)
app.get('/api/categories', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });

    try {
        const dbPromise = db.promise();
        const [rows] = await dbPromise.query(
            `SELECT id, name, icon_name, type, created_by_user_id
             FROM categories
             WHERE type = 'standard' OR created_by_user_id = ?
             ORDER BY type ASC, id ASC`,
            [userId]
        );
        return res.status(200).json({ success: true, categories: rows });
    } catch (err) {
        console.error('❌ GET categories error:', err);
        return res.status(500).json({ success: false, message: 'Gagal mengambil kategori.' });
    }
});

// POST buat kategori kustom baru
app.post('/api/categories', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { name, icon_name } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi.' });

    const iconName = icon_name && icon_name.trim() ? icon_name.trim() : 'bi-grid';

    try {
        const dbPromise = db.promise();
        const [result] = await dbPromise.query(
            'INSERT INTO categories (name, icon_name, type, created_by_user_id) VALUES (?, ?, ?, ?)',
            [name.trim(), iconName, 'custom', userId]
        );
        console.log(`✅ Kategori kustom dibuat: "${name}" oleh user_id=${userId}`);
        return res.status(201).json({
            success: true,
            categoryId: result.insertId,
            message: 'Kategori kustom berhasil dibuat.'
        });
    } catch (err) {
        console.error('❌ POST category error:', err);
        return res.status(500).json({ success: false, message: 'Gagal membuat kategori.' });
    }
});

// ================================================================
// 9. ENDPOINT: CRUD Habits (Schema Baru)
//    GET    /api/habits            — ambil semua habit milik user
//    POST   /api/habits            — tambah habit baru
//    PUT    /api/habits/:id        — edit habit
//    DELETE /api/habits/:id        — hapus habit
// ================================================================

// GET semua habit milik user (JOIN dengan categories)
app.get('/api/habits', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });

    try {
        const dbPromise = db.promise();
        const [rows] = await dbPromise.query(
            `SELECT
                h.id,
                h.habit_name,
                h.goals,
                h.description,
                h.evaluation_type,
                h.is_active,
                h.created_at,
                h.updated_at,
                c.id         AS category_id,
                c.name       AS category_name,
                c.icon_name  AS category_icon
             FROM habits h
             JOIN categories c ON h.category_id = c.id
             WHERE h.user_id = ? AND h.is_active = 1
             ORDER BY h.created_at ASC`,
            [userId]
        );
        return res.status(200).json({ success: true, habits: rows });
    } catch (err) {
        console.error('❌ GET habits error:', err);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data habit.' });
    }
});

// POST tambah habit baru
app.post('/api/habits', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { habit_name, category_id, goals, description, evaluation_type } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });
    if (!habit_name || !habit_name.trim()) return res.status(400).json({ success: false, message: 'Nama habit wajib diisi.' });
    if (!category_id) return res.status(400).json({ success: false, message: 'Kategori wajib dipilih.' });

    const validEvalTypes = ['checklist', 'numeric', 'timer'];
    const evalType = validEvalTypes.includes(evaluation_type) ? evaluation_type : 'checklist';

    try {
        const dbPromise = db.promise();

        // Pastikan category_id valid (standard atau kustom milik user ini)
        const [catRows] = await dbPromise.query(
            `SELECT id FROM categories
             WHERE id = ? AND (type = 'standard' OR created_by_user_id = ?)`,
            [category_id, userId]
        );
        if (catRows.length === 0) {
            return res.status(400).json({ success: false, message: 'Kategori tidak valid.' });
        }

        const [result] = await dbPromise.query(
            `INSERT INTO habits (user_id, category_id, habit_name, goals, description, evaluation_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, category_id, habit_name.trim(), goals || null, description || null, evalType]
        );

        console.log(`✅ Habit baru dibuat: id=${result.insertId}, user=${userId}, eval=${evalType}`);
        return res.status(201).json({
            success: true,
            habitId: result.insertId,
            message: 'Habit berhasil ditambahkan.'
        });
    } catch (err) {
        console.error('❌ POST habit error:', err);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan habit.' });
    }
});

// PUT edit habit (ownership check)
app.put('/api/habits/:id', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const habitId = parseInt(req.params.id, 10);
    const { habit_name, category_id, goals, description, evaluation_type, is_active } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });
    if (isNaN(habitId)) return res.status(400).json({ success: false, message: 'ID habit tidak valid.' });
    if (!habit_name || !habit_name.trim()) return res.status(400).json({ success: false, message: 'Nama habit wajib diisi.' });

    const validEvalTypes = ['checklist', 'numeric', 'timer'];
    const evalType = validEvalTypes.includes(evaluation_type) ? evaluation_type : 'checklist';
    const activeStatus = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    try {
        const dbPromise = db.promise();
        const [result] = await dbPromise.query(
            `UPDATE habits
             SET habit_name = ?, category_id = ?, goals = ?, description = ?,
                 evaluation_type = ?, is_active = ?
             WHERE id = ? AND user_id = ?`,
            [habit_name.trim(), category_id, goals || null, description || null,
                evalType, activeStatus, habitId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ success: false, message: 'Habit tidak ditemukan atau bukan milik Anda.' });
        }

        return res.status(200).json({ success: true, message: 'Habit berhasil diperbarui.' });
    } catch (err) {
        console.error('❌ PUT habit error:', err);
        return res.status(500).json({ success: false, message: 'Gagal memperbarui habit.' });
    }
});

// DELETE habit (CASCADE otomatis hapus progress_logs)
app.delete('/api/habits/:id', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const habitId = parseInt(req.params.id, 10);

    if (!userId) return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });
    if (isNaN(habitId)) return res.status(400).json({ success: false, message: 'ID habit tidak valid.' });

    try {
        const dbPromise = db.promise();
        const [result] = await dbPromise.query(
            'DELETE FROM habits WHERE id = ? AND user_id = ?',
            [habitId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ success: false, message: 'Habit tidak ditemukan atau bukan milik Anda.' });
        }

        return res.status(200).json({ success: true, message: 'Habit berhasil dihapus.' });
    } catch (err) {
        console.error('❌ DELETE habit error:', err);
        return res.status(500).json({ success: false, message: 'Gagal menghapus habit.' });
    }
});

// ================================================================
// 10. ENDPOINT: Progress Logs (Pengganti habit_logs)
//     POST /api/progress-logs/toggle   — Toggle checklist (ON/OFF)
//     POST /api/progress-logs          — Simpan nilai numeric/timer
//     GET  /api/progress-logs/:habitId — Riwayat log satu habit
//     GET  /api/habits-with-logs       — Semua habit + log hari ini
// ================================================================

// Toggle checklist habit (sebelumnya /api/habit-logs/toggle)
app.post('/api/habit-logs/toggle', async (req, res) => {
    const { habit_id, date } = req.body;
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ success: false, message: 'User tidak terautentikasi.' });
    }

    const habitIdNum = parseInt(habit_id, 10);
    if (isNaN(habitIdNum) || habitIdNum <= 0) {
        return res.status(400).json({ success: false, message: 'habit_id tidak valid.' });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, message: 'Format tanggal tidak valid (YYYY-MM-DD).' });
    }

    try {
        const dbPromise = db.promise();

        // Ownership check
        const [habitRows] = await dbPromise.query(
            'SELECT id, evaluation_type FROM habits WHERE id = ? AND user_id = ?',
            [habitIdNum, userId]
        );
        if (habitRows.length === 0) {
            return res.status(403).json({ success: false, message: 'Habit tidak ditemukan atau bukan milik Anda.' });
        }

        // Cek log yang sudah ada
        const [existingLog] = await dbPromise.query(
            'SELECT id, status FROM progress_logs WHERE habit_id = ? AND log_date = ?',
            [habitIdNum, date]
        );

        let newStatus;
        if (existingLog.length === 0) {
            // Belum ada log → insert dengan status = 1 (completed)
            await dbPromise.query(
                'INSERT INTO progress_logs (habit_id, log_date, status) VALUES (?, ?, 1)',
                [habitIdNum, date]
            );
            newStatus = 1;
        } else {
            // Sudah ada → toggle status
            newStatus = existingLog[0].status === 1 ? 0 : 1;
            await dbPromise.query(
                'UPDATE progress_logs SET status = ? WHERE habit_id = ? AND log_date = ?',
                [newStatus, habitIdNum, date]
            );
        }

        const statusLabel = newStatus === 1 ? 'Completed' : 'Pending';
        console.log(`✅ Toggle habit_id=${habitIdNum}, date=${date} → ${statusLabel}`);

        return res.status(200).json({
            success: true,
            habit_id: habitIdNum,
            date,
            status: statusLabel,
            status_value: newStatus,
            message: `Habit ditandai sebagai ${statusLabel}.`
        });

    } catch (err) {
        console.error('❌ Toggle progress log error:', err);
        return res.status(500).json({ success: false, message: 'Gagal memperbarui status habit.' });
    }
});

// POST simpan progress numeric atau timer
app.post('/api/progress-logs', async (req, res) => {
    const { habit_id, log_date, numeric_value, timer_value_seconds, notes } = req.body;
    const userId = req.headers['x-user-id'];

    if (!userId) return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });
    if (!habit_id || !log_date) return res.status(400).json({ success: false, message: 'habit_id dan log_date wajib diisi.' });

    try {
        const dbPromise = db.promise();

        // Ownership check
        const [habitRows] = await dbPromise.query(
            'SELECT id, evaluation_type FROM habits WHERE id = ? AND user_id = ?',
            [habit_id, userId]
        );
        if (habitRows.length === 0) {
            return res.status(403).json({ success: false, message: 'Habit tidak ditemukan atau bukan milik Anda.' });
        }

        // Upsert log (INSERT or UPDATE jika sudah ada)
        await dbPromise.query(
            `INSERT INTO progress_logs (habit_id, log_date, numeric_value, timer_value_seconds, notes)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 numeric_value = VALUES(numeric_value),
                 timer_value_seconds = VALUES(timer_value_seconds),
                 notes = VALUES(notes)`,
            [habit_id, log_date, numeric_value || null, timer_value_seconds || null, notes || null]
        );

        console.log(`✅ Progress log disimpan: habit_id=${habit_id}, date=${log_date}`);
        return res.status(201).json({ success: true, message: 'Progress berhasil disimpan.' });
    } catch (err) {
        console.error('❌ POST progress log error:', err);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan progress.' });
    }
});

// GET riwayat log satu habit
app.get('/api/progress-logs/:habitId', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const habitId = parseInt(req.params.habitId, 10);

    if (!userId) return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });
    if (isNaN(habitId)) return res.status(400).json({ success: false, message: 'ID habit tidak valid.' });

    try {
        const dbPromise = db.promise();

        // Ownership check
        const [habitRows] = await dbPromise.query(
            'SELECT id FROM habits WHERE id = ? AND user_id = ?',
            [habitId, userId]
        );
        if (habitRows.length === 0) {
            return res.status(403).json({ success: false, message: 'Habit tidak ditemukan atau bukan milik Anda.' });
        }

        const [logs] = await dbPromise.query(
            `SELECT id, log_date, status, numeric_value, timer_value_seconds, notes, created_at
             FROM progress_logs
             WHERE habit_id = ?
             ORDER BY log_date DESC`,
            [habitId]
        );

        return res.status(200).json({ success: true, habitId, logs });
    } catch (err) {
        console.error('❌ GET progress logs error:', err);
        return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat log.' });
    }
});

// GET semua habit + log di tanggal tertentu
app.get('/api/habits-with-logs', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { date } = req.query;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'User tidak terautentikasi.' });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, message: 'Parameter ?date= wajib diisi (YYYY-MM-DD).' });
    }

    try {
        const dbPromise = db.promise();

        const [rows] = await dbPromise.query(
            `SELECT
                h.id              AS habit_id,
                h.habit_name,
                h.goals,
                h.description,
                h.evaluation_type,
                h.created_at      AS habit_created_at,
                c.id              AS category_id,
                c.name            AS category_name,
                c.icon_name       AS category_icon,
                pl.status                  AS checklist_status,
                pl.numeric_value,
                pl.timer_value_seconds,
                pl.notes,
                pl.log_date
             FROM habits h
             JOIN categories c ON h.category_id = c.id
             LEFT JOIN progress_logs pl
                 ON h.id = pl.habit_id
                 AND pl.log_date = ?
             WHERE h.user_id = ? AND h.is_active = 1
             ORDER BY h.created_at ASC`,
            [date, userId]
        );

        console.log(`✅ Sync: ${rows.length} habit untuk user_id=${userId}, date=${date}`);
        return res.status(200).json({ success: true, date, habits: rows });

    } catch (err) {
        console.error('❌ Habits-with-logs error:', err);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data habit.' });
    }
});

// ================================================================
// START SERVER
// ================================================================
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => {
    console.log(`🚀 HabitFlow Backend berjalan di http://localhost:${PORT}`);
    console.log(`📧 SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
    console.log(`🗄️  DB  : ${process.env.DB_HOST}/${process.env.DB_NAME}`);
});
