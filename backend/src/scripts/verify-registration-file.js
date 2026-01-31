const fs = require('fs');
const http = require('http');

function post(data) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/register',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

(async () => {
    const logFile = 'e:/Project/room-manager/verify_output.log';
    fs.writeFileSync(logFile, '');

    try {
        const res1 = await post('{}');
        fs.appendFileSync(logFile, `--- TEST 1: Empty Body ---\nStatus: ${res1.statusCode}\nBody: ${res1.body}\n\n`);
    } catch (e) {
        fs.appendFileSync(logFile, `Error Test 1: ${e.message}\n`);
    }

    try {
        const res2 = await post(JSON.stringify({
            email: "admin@example.com",
            password: "Password123!",
            fullName: "Test User",
            phone: "0900000000"
        }));
        fs.appendFileSync(logFile, `--- TEST 2: Duplicate Email ---\nStatus: ${res2.statusCode}\nBody: ${res2.body}\n`);
    } catch (e) {
        fs.appendFileSync(logFile, `Error Test 2: ${e.message}\n`);
    }
})();
