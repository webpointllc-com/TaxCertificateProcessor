'use strict';

function mailerEnabled() {
  return Boolean(process.env.RESEND_API_KEY);
}

async function sendConfirmEmail({ to, confirmUrl }) {
  if (!mailerEnabled()) return { ok: false, skipped: true };
  const from = process.env.MAIL_FROM || 'WebPoint <noreply@webpointllc.com>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Confirm your WebPoint account',
      html: [
        '<p>Confirm this email to finish your WebPoint account.</p>',
        `<p><a href="${confirmUrl}">Click to confirm it is you</a></p>`,
        '<p>If you did not create this account, ignore this message.</p>'
      ].join('')
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Resend ${res.status}`);
  }
  return { ok: true };
}

module.exports = { mailerEnabled, sendConfirmEmail };
