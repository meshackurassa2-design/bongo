const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gqxdbwnmnqvtdpxnrgtx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeGRid25tbnF2dGRweG5yZ3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTkxODQsImV4cCI6MjA5ODQ5NTE4NH0.tR0UOoPtscMbIpQCkjMPQ3n8vtBWIEIyhOqHIUX3uS4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).order('created_at', { ascending: false }).limit(20);
  console.log('Error:', error);
  console.log('Tracks:', data);
}

check();
