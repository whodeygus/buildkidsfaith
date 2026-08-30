const { getSupabaseAdmin } = require('./_supabaseAdmin');
const { TOTAL_MONTHS } = require('../config/total-months');

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
    .select('status, plan, months_unlocked, current_period_end')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  const active = subscriber?.status === 'active' || subscriber?.status === 'trialing';
  const plan = subscriber?.plan || null;
  const unlockedMonths = plan === 'annual' ? TOTAL_MONTHS : subscriber?.months_unlocked || 1;

  res.status(200).json({
    email: userData.user.email,
    active,
    status: subscriber?.status || 'inactive',
    plan,
    unlockedMonths,
    totalMonths: TOTAL_MONTHS,
    // Monthly plan only: the next content month unlocks when this billing
    // cycle renews. Not meaningful once everything is already unlocked.
    nextUnlockDate:
      plan === 'monthly' && unlockedMonths < TOTAL_MONTHS ? subscriber?.current_period_end || null : null,
  });
};
