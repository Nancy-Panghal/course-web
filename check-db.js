const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize with public ANON key to simulate client-side query
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const creatorId = '7ba5fc01-717e-429b-866e-8f3f2b651d6a';
  
  const { data, error } = await supabase
    .from('creators')
    .select('id, name, telegram_bot_username')
    .eq('id', creatorId);

  if (error) {
    console.error('Error fetching creator with Anon client:', error);
  } else {
    console.log('Creator data fetched with Anon client:', data);
  }
}

check();
