const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function run() {
  const form = new FormData();
  form.append('file', fs.createReadStream('C:\\Users\\sacha\\Downloads\\Sales_ASDBPDS0434.pdf'));
  
  try {
    const response = await axios.post('https://web-psi-gules-30.vercel.app/api/inventory/import', form, {
      headers: {
        ...form.getHeaders()
      }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
}

run();
