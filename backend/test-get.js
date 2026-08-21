fetch('https://email-scheduler-backend-e9gcf9b3hfggg5aj.centralindia-01.azurewebsites.net/api/auth/me', {
  method: 'GET',
  headers: {
    'Origin': 'https://email-scheduler-rose.vercel.app',
    'Authorization': 'Bearer test'
  }
}).then(async res => {
  console.log('Status:', res.status);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));
  console.log('Body:', await res.text());
}).catch(console.error);
