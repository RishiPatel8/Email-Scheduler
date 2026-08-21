fetch('https://email-scheduler-backend-e9gcf9b3hfggg5aj.centralindia-01.azurewebsites.net/api/auth/me', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://email-scheduler-rose.vercel.app',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization'
  }
}).then(res => {
  console.log('Status:', res.status);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));
}).catch(console.error);
