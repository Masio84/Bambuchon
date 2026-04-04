
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Testing connection to:", supabaseUrl);
    const { data, error } = await supabase.from('gastos').select('*').limit(1);
    if (error) {
        console.error("Connection Error:", error);
    } else {
        console.log("Connection Successful! Found records:", data.length);
    }
}

test();
