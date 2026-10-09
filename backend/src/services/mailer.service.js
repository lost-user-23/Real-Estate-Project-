const nodemailer = require('nodemailer');
const config = require('../config');

let transporter;

function getTransporter() {
  if (!transporter) {
    const { host, port, user, pass } = config.smtp;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      // Without these a blocked or silent SMTP port stalls the background send
      // for about two minutes before failing. Port 587 must upgrade to TLS
      // (STARTTLS) rather than fall back to plain text.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      ...(port === 587 ? { requireTLS: true } : {}),
      ...(user ? { auth: { user, pass } } : {}),
    });
  }
  return transporter;
}

// Single delivery point, so swapping the provider means changing only this.
// Without SMTP settings (local development) the message is logged instead, so
// the whole flow can be tried without a real inbox. Production never falls back.
async function deliver({ to, subject, text, html }) {
  if (!config.smtp.host) {
    if (config.env === 'production') {
      throw new Error('SMTP is not configured');
    }
    // The body holds codes and links, so it is printed in development only.
    if (config.env === 'development') {
      console.log(`[mailer] SMTP not configured; would send to ${to}\n  Subject: ${subject}\n  ${text}`);
    } else if (config.env !== 'test') {
      console.log('[mailer] SMTP not configured; email not sent');
    }
    return;
  }
  await getTransporter().sendMail({ from: config.mailFrom, to, subject, text, html });
}

async function sendVerificationEmail(to, link) {
  await deliver({
    to,
    subject: 'Verify your email address',
    text: `Confirm this email address by opening the link below. It expires in 24 hours.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
    html: `<p>Confirm this email address by opening the link below. It expires in 24 hours.</p><p><a href="${link}">${link}</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
  });
}

// Sent instead of a verification link when someone tries to use an address that
// already belongs to a verified account, so the request itself reveals nothing.
async function sendAccountExistsEmail(to) {
  const text =
    'A sign-up or email change was attempted with this address, but it already belongs to an account. If this was you, log in instead. Otherwise, you can ignore this email.';
  await deliver({
    to,
    subject: 'Someone tried to use your email address',
    text,
    html: `<p>${text}</p>`,
  });
}

async function sendPasswordResetEmail(to, code) {
  const text =
    `Your password reset code is: ${code}\n\nIt expires in 10 minutes. If you did not request this, you can ignore this email — your password will not change.`;
  await deliver({
    to,
    subject: 'Password reset code',
    text,
    html: `<p>Your password reset code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>It expires in 10 minutes. If you did not request this, you can ignore this email — your password will not change.</p>`,
  });
}

module.exports = { sendVerificationEmail, sendAccountExistsEmail, sendPasswordResetEmail };

