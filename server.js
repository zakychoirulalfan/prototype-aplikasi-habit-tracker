/**
 * HTTPS Development Server for Habit Tracker
 * Generates a self-signed certificate on-the-fly and serves files over HTTPS
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;
const HOST = '0.0.0.0';
const ROOT_DIR = __dirname;

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
};

function serveFile(req, res) {
    let filePath = path.join(ROOT_DIR, req.url === '/' ? 'index.html' : req.url);
    
    // Clean URL support: try adding .html if no extension
    const ext = path.extname(filePath);
    if (!ext) {
        // Try with .html extension
        if (fs.existsSync(filePath + '.html')) {
            filePath = filePath + '.html';
        } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
            filePath = path.join(filePath, 'index.html');
        }
    }

    // Security: prevent directory traversal
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(ROOT_DIR))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - Not Found</h1>');
            return;
        }

        const fileExt = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[fileExt] || 'application/octet-stream';
        
        res.writeHead(200, { 
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
    });
}

// Generate self-signed certificate using Node.js crypto
function generateSelfSignedCert() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Create a self-signed certificate using X509Certificate (Node 15+)
    const cert = crypto.X509Certificate ? createCertWithX509(privateKey) : null;
    
    if (cert) {
        return { key: privateKey, cert: cert };
    }

    // Fallback: use createCertificate from node:tls (Node 22+)
    try {
        const tls = require('tls');
        if (tls.createSecureContext) {
            // Generate using a minimal self-signed approach
            const certPem = generateMinimalCert(privateKey, publicKey);
            return { key: privateKey, cert: certPem };
        }
    } catch (e) {}

    return null;
}

function createCertWithX509(privateKey) {
    try {
        // Node.js 22+ has crypto.createX509Certificate or we can use tls
        // For now, return null and use file-based certs
        return null;
    } catch (e) {
        return null;
    }
}

function generateMinimalCert(privateKey, publicKey) {
    // This is a minimal approach - for proper certs, use openssl or mkcert
    return null;
}

async function startServer() {
    const sslDir = path.join(__dirname, 'ssl');
    let useHttps = false;
    let serverOptions = {};

    // Check for existing SSL certificates
    const certPath = path.join(sslDir, 'cert.pem');
    const keyPath = path.join(sslDir, 'key.pem');

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        serverOptions.cert = fs.readFileSync(certPath);
        serverOptions.key = fs.readFileSync(keyPath);
        useHttps = true;
        console.log('✅ Found SSL certificates in ssl/ directory');
    } else {
        // Try to generate certificates using mkcert
        console.log('No SSL certificates found. Generating with mkcert...');
        try {
            const { execSync } = require('child_process');
            
            if (!fs.existsSync(sslDir)) {
                fs.mkdirSync(sslDir, { recursive: true });
            }

            // Use npx mkcert to generate certificates
            execSync(
                `npx -y mkcert create-ca && npx -y mkcert create-cert --domains localhost,127.0.0.1,10.109.86.121,0.0.0.0`,
                { cwd: sslDir, stdio: 'inherit' }
            );

            // mkcert creates ca.crt, ca.key, cert.crt, cert.key
            const mkcertCert = path.join(sslDir, 'cert.crt');
            const mkcertKey = path.join(sslDir, 'cert.key');

            if (fs.existsSync(mkcertCert) && fs.existsSync(mkcertKey)) {
                // Also copy as .pem for serve compatibility
                fs.copyFileSync(mkcertCert, certPath);
                fs.copyFileSync(mkcertKey, keyPath);
                serverOptions.cert = fs.readFileSync(certPath);
                serverOptions.key = fs.readFileSync(keyPath);
                useHttps = true;
                console.log('✅ SSL certificates generated successfully!');
            }
        } catch (err) {
            console.log('⚠️  Could not generate SSL certs:', err.message);
        }
    }

    if (useHttps) {
        // HTTPS Server
        const httpsServer = https.createServer(serverOptions, serveFile);
        httpsServer.listen(PORT, HOST, () => {
            console.log('');
            console.log('🔒 HTTPS Server running!');
            console.log(`   Local:   https://localhost:${PORT}`);
            console.log(`   Network: https://10.109.86.121:${PORT}`);
            console.log('');
            console.log('⚠️  Browser will show a security warning (self-signed cert).');
            console.log('   Click "Advanced" → "Proceed" to continue.');
        });

        // Also start HTTP server that redirects to HTTPS
        const httpServer = http.createServer((req, res) => {
            const host = req.headers.host?.replace(/:\d+$/, '') || 'localhost';
            res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
            res.end();
        });
        httpServer.listen(3080, HOST, () => {
            console.log(`   HTTP redirect: http://localhost:3080 → https`);
        });
    } else {
        // Fallback to HTTP
        console.log('⚠️  Running in HTTP mode (no SSL certificates available)');
        const httpServer = http.createServer(serveFile);
        httpServer.listen(PORT, HOST, () => {
            console.log(`   http://localhost:${PORT}`);
            console.log(`   http://10.109.86.121:${PORT}`);
        });
    }
}

startServer();
