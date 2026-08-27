const { getSupabaseAdmin } = require('./_supabaseAdmin');
const curriculumFiles = require('../config/curriculum-files.json');

const SIGNED_URL_TTL_SECONDS = 300;

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const fileKey = req.query?.file;
  const fileEntry = fileKey && curriculumFiles[fileKey];
  if (!fileEntry) {
    res.status(400).json({ error: 'Unknown file' });
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
    .select('status')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  const isActive = subscriber?.status === 'active' || subscriber?.status === 'trialing';
  if (!isActive) {
    res.status(403).json({ error: 'No active subscription' });
    return;
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'curriculum';
  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(fileEntry.path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    console.error('Failed to sign URL:', signError);
    res.status(500).json({ error: 'Could not generate download link' });
    return;
  }

  res.status(200).json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
};
