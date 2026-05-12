const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const certDir = path.join(__dirname, 'ssl');
if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
}

console.log('Generating self-signed SSL certificate...');

const pems = selfsigned.generate([
    { name: 'commonName', value: 'localhost' }
], {
    algorithm: 'sha256',
    days: 365,
    keySize: 2048,
    extensions: [
        {
            name: 'subjectAltName',
            altNames: [
                { type: 2, value: 'localhost' },
                { type: 7, ip: '127.0.0.1' },
                { type: 7, ip: '10.109.86.121' }
            ]
        }
    ]
});

fs.writeFileSync(path.join(certDir, 'cert.pem'), pems.cert);
fs.writeFileSync(path.join(certDir, 'key.pem'), pems.private);

console.log('✅ SSL Certificate generated!');
console.log('   cert: ssl/cert.pem');
console.log('   key:  ssl/key.pem');
