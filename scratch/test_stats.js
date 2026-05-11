// No import needed for native fetch in Node 18+

async function testStats() {
    try {
        const response = await fetch('http://localhost:4000/api/public/stats');
        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Data:', data);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testStats();
