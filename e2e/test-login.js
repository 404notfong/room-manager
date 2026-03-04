const http = require('http');
const data = JSON.stringify({ email: 'admin@example.com', password: 'password123' });
const req = http.request({
  hostname: 'localhost', port: 3000, path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', body.substring(0, 500)));
});
req.write(data);
req.end();
