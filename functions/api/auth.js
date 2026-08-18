// Cloudflare Pages Serverless Auth Handler ($0 Free Tier)
export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { action, email, provider } = body;

    if (action === 'send_verification') {
      // Simuliert echten SMTP-Trigger ueber Cloudflare Edge
      const verifyToken = crypto.randomUUID();
      return new Response(JSON.stringify({
        success: true,
        message: `Bestaetigungs-Anforderung fuer ${email} aktiv.`,
        token: verifyToken
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}