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
    console.log('--- TEST 1: Empty Body ---');
    try {
        const res1 = await post('{}');
        console.log('Status:', res1.statusCode);
        console.log('Body:', res1.body);
    } catch (e) { console.error(e); }

    console.log('\n--- TEST 2: Duplicate Email ---');
    try {
        const res2 = await post(JSON.stringify({
            email: "admin@example.com",
            password: "Password123!",
            fullName: "Test User",
            phone: "0900000000"
        }));
        console.log('Status:', res2.statusCode);
        console.log('Body:', res2.body);
    } catch (e) { console.error(e); }
})();
