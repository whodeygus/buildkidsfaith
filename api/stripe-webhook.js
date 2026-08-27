const Stripe = require('stripe');
const { getSupabaseAdmin } = require('./_supabaseAdmin');

// Stripe needs the raw, unparsed request body to verify the webhook signature.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_details?.email || session.customer_email;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        if (!email || !customerId) break;

        // Look up the subscription so status/period end are accurate from the start.
        let status = 'active';
        let currentPeriodEnd = null;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          status = subscription.status;
          currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        }

        // Find or create the Supabase Auth user for this email, then send them
        // an email invite so they can set a password and log in.
        let userId;
        const { data: existing } = await supabase
          .from('subscribers')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();

        if (existing?.user_id) {
          userId = existing.user_id;
        } else {
          const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
            email,
            { redirectTo: `${process.env.SITE_URL || ''}/#members` }
          );
          if (inviteError) throw inviteError;
          userId = invited.user.id;
        }

        const { error: upsertError } = await supabase.from('subscribers').upsert(
          {
            user_id: userId,
            email,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        );
        if (upsertError) throw upsertError;
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : subscription.status;
        const currentPeriodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        const { error: updateError } = await supabase
          .from('subscribers')
          .update({ status, current_period_end: currentPeriodEnd, updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', subscription.customer);
        if (updateError) throw updateError;
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Error handling webhook event:', err);
    res.status(500).send('Webhook handler failed');
    return;
  }

  res.status(200).json({ received: true });
};
