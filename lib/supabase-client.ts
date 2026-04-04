import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

// This is a singleton client for the browser to avoid "Multiple GoTrueClient instances" warnings
export const supabase = createClient(supabaseUrl, supabaseKey);
