import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zugvyqgchwnupchwqxbf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SoJUnxBXflBNzG4fCBPWvA_6b8VvA13';

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Vaultify: Supabase env vars are missing. Copy .env.example to .env and fill in your project URL + anon key.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
