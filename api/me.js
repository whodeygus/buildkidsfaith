const { getSupabaseAdmin } = require('./_supabaseAdmin');

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('status, current_period_end')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  res.status(200).json({
    email: userData.user.email,
    active: subscriber?.status === 'active' || subscriber?.status === 'trialing',
    status: subscriber?.status || 'inactive',
  });
};
