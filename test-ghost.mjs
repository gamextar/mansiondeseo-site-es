const API = 'https://mansion-deseo-api-production.green-silence-8594.workers.dev';

async function test() {
  // Login as a non-premium user
  const loginRes = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vilma@gmail.com', password: '123456' })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) { console.log('Login failed:', loginData); return; }
  console.log('Logged in as Vilma (non-premium)');
  
  // Fetch profiles
  const profRes = await fetch(API + '/api/profiles', {
    headers: { 'Authorization': 'Bearer ' + loginData.token }
  });
  const profData = await profRes.json();
  console.log('viewerPremium:', profData.viewerPremium);
  profData.profiles.forEach(p => {
    console.log(p.name, '- premium:', p.premium, '- ghost_mode:', p.ghost_mode, '- blurred:', p.blurred);
  });
}
test().catch(e => console.error(e));
