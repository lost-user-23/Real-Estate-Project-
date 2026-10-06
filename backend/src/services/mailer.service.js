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
    if (config.env !== 'test') {
      console.log(`[mailer] SMTP not configured; would send to ${to}\n  Subject: ${subject}\n  ${text}`);
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

module.exports = { sendVerificationEmail, sendAccountExistsEmail };
