const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'views');
const loader = `
    <!-- AUTHENTICATION GUARD LOADER -->
    <div id="auth-guard-loader" class="fixed inset-0 bg-white z-[99999] flex flex-col items-center justify-center transition-opacity duration-300">
        <i class="fa-solid fa-circle-notch fa-spin text-4xl text-[var(--primary)] text-green-500 mb-4"></i>
        <p class="text-gray-500 font-medium tracking-wide">Verifying Session...</p>
    </div>
`;
const filesToProcess = ['calendar.html', 'add_habit.html', 'edit_habit.html', 'statistics.html', 'profile.html'];
for (const f of filesToProcess) {
    const fPath = path.join(dir, f);
    let content = fs.readFileSync(fPath, 'utf8');
    // Remove existing if any
    content = content.replace(/<!-- AUTHENTICATION GUARD LOADER -->[\s\S]*?<\/div>\s*<\/div>/g, '');
    content = content.replace(/<!-- AUTHENTICATION GUARD LOADER -->[\s\S]*?<\/div>\s*/g, '');

    // add it after body
    content = content.replace(/(<body[^>]*>)/i, '$1' + loader);
    fs.writeFileSync(fPath, content);
    console.log('Processed', f);
}
