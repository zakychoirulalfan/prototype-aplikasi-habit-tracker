const formRegister = document.getElementById('formRegister');

if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const fullName = document.getElementById('fullName').value; // Tambahan
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value; // Tambahan

        // Validasi kecocokan password di frontend
        if (password !== confirmPassword) {
            alert("Password dan Confirm Password tidak cocok!");
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, fullName, email, password }) // Kirim fullName juga
            });

            const result = await response.json();
            if (result.success) {
                alert(result.message);
                window.location.href = 'login.html';
            } else {
                alert('Registrasi gagal: ' + result.message);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Tidak dapat terhubung ke server backend.');
        }
    });
}