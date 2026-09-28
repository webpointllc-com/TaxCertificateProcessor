'use strict';

function googleEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function appleEnabled() {
  return Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID);
}

function oauthStatus() {
  return { google: googleEnabled(), apple: appleEnabled() };
}

function originOf(req) {
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function googleAuthUrl(req, state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${originOf(req)}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state: state || 'webpoint'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function appleAuthUrl(req, state) {
  const params = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID,
    redirect_uri: `${originOf(req)}/api/auth/apple/callback`,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state: state || 'webpoint'
  });
  return `https://appleid.apple.com/auth/authorize?${params}`;
}

async function exchangeGoogleCode(req, code) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: `${originOf(req)}/api/auth/google/callback`,
    grant_type: 'authorization_code'
  });
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    throw new Error(tokens.error_description || tokens.error || 'Google token exchange failed');
  }
  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  const profile = await userRes.json();
  return {
    email: profile.email,
    display_name: profile.name || profile.given_name || (profile.email || '').split('@')[0],
    provider: 'google'
  };
}

module.exports = {
  googleEnabled,
  appleEnabled,
  oauthStatus,
  originOf,
  googleAuthUrl,
  appleAuthUrl,
  exchangeGoogleCode
};
