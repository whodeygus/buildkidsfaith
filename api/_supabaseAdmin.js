const { createClient } = require('@supabase/supabase-js');

// Service-role client for server-side use only. Never expose this key to the browser.
function getSupabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

module.exports = { getSupabaseAdmin };
