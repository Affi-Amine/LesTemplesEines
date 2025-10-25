// Test script to verify login functionality after fixing the database query
// Using built-in fetch API (Node.js 18+)

async function testLogin() {
  try {
    console.log('Testing login with test@lestemples.fr...');
    
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@lestemples.fr',
        password: 'admin123' // Updated to match the password set in the database
      })
    });

    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.status === 200) {
      console.log('✅ Login successful!');
    } else {
      console.log('❌ Login failed');
    }
    
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

testLogin();