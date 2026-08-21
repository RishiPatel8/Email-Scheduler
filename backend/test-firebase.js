const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

try {
  const app = initializeApp();
  const auth = getAuth(app);
  auth.verifyIdToken('fake-token').catch(e => console.log('Error verifying:', e.message));
} catch (e) {
  console.log('Error initializing:', e.message);
}