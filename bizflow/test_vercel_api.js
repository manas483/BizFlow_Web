const fs = require('fs');

async function testVercelImport() {
  try {
    const filePath = 'C:\\Users\\sacha\\Downloads\\Sales_ASDBPDS0434.pdf';
    const fileData = fs.readFileSync(filePath);
    
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="Sales_ASDBPDS0434.pdf"\r\n`;
    body += `Content-Type: application/pdf\r\n\r\n`;
    
    const bodyBuffer = Buffer.concat([
      Buffer.from(body),
      fileData,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    console.log('Sending request to Vercel production...');
    const res = await fetch('https://web-psi-gules-30.vercel.app/api/inventory/import', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

testVercelImport();
