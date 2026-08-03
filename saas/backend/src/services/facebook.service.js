import crypto from 'node:crypto';
import { env } from '../config/env.js';

const GRAPH_API_VERSION = 'v21.0';

// Facebook signs every webhook POST body with the App Secret; verifying this
// is how we know a request claiming to be Messenger actually came from
// Facebook. Requires FACEBOOK_APP_SECRET (real value from a real Meta App —
// not something this repo can supply on its own).
export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!env.facebookAppSecret || !signatureHeader) {
    return false;
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', env.facebookAppSecret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

export function verifyWebhookChallenge(mode, token, challenge) {
  if (mode === 'subscribe' && env.facebookWebhookVerifyToken && token === env.facebookWebhookVerifyToken) {
    return challenge;
  }

  return null;
}

// Sends a reply back to a Messenger user via the Send API. Requires the
// fanpage's real Page Access Token (obtained through Facebook's OAuth flow,
// not fabricated by this codebase).
export async function sendMessengerMessage({ pageAccessToken, recipientPsid, text, imageUrl }) {
  const message = imageUrl
    ? { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } }
    : { text };

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientPsid }, message })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Facebook Send API error (${response.status}): ${body}`);
    error.code = 'FACEBOOK_SEND_FAILED';
    throw error;
  }

  return response.json();
}

export function buildOAuthUrl(redirectUri, state) {
  if (!env.facebookAppId) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: env.facebookAppId,
    redirect_uri: redirectUri,
    state,
    scope: 'pages_messaging,pages_show_list,pages_manage_metadata'
  });

  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForPageTokens(code, redirectUri) {
  if (!env.facebookAppId || !env.facebookAppSecret) {
    const error = new Error('Facebook OAuth not configured: set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.');
    error.code = 'FACEBOOK_NOT_CONFIGURED';
    throw error;
  }

  const tokenParams = new URLSearchParams({
    client_id: env.facebookAppId,
    client_secret: env.facebookAppSecret,
    redirect_uri: redirectUri,
    code
  });

  const userTokenRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?${tokenParams}`);

  if (!userTokenRes.ok) {
    throw new Error(`Facebook OAuth token exchange failed: ${await userTokenRes.text()}`);
  }

  const { access_token: userAccessToken } = await userTokenRes.json();

  const pagesRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`
  );

  if (!pagesRes.ok) {
    throw new Error(`Facebook pages lookup failed: ${await pagesRes.text()}`);
  }

  const { data } = await pagesRes.json();

  return data.map(page => ({ pageId: page.id, pageName: page.name, accessToken: page.access_token }));
}
