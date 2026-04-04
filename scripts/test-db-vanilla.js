
async function test() {
    const url = "https://dinqndfjgnbyfkycmues.supabase.co/rest/v1/gastos?select=*&limit=1";
    const key = "SUPABASE_SERVICE_ROLE_KEY"; // Placeholder for manual test if I could
    
    // I will read env.local manually in this script
    const fs = require('fs');
    const env = fs.readFileSync('.env.local', 'utf8');
    const urlLine = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL='));
    const keyLine = env.split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY='));
    
    if (!urlLine || !keyLine) {
        console.error("Missing env variables in .env.local");
        return;
    }
    
    const apiUrl = urlLine.split('=')[1].replace(/"/g, '').trim();
    const serviceKey = keyLine.split('=')[1].replace(/"/g, '').trim();
    
    console.log("Testing connection to:", apiUrl);
    
    try {
        const response = await fetch(`${apiUrl}/rest/v1/gastos?select=*&limit=1`, {
            headers: {
                "apikey": serviceKey,
                "Authorization": `Bearer ${serviceKey}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log("SUCCESS! DB Connection confirmed. Data:", JSON.stringify(data));
        } else {
            console.error("FAIL! Status:", response.status);
            const text = await response.text();
            console.error("Error body:", text);
        }
    } catch (err) {
        console.error("FETCH ERROR:", err.message);
    }
}

test();
