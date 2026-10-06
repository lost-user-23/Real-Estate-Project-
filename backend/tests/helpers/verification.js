const request = require('supertest');
const { tokenFromLink } = require('./auth');

// Helpers for tests of the real sign-up flow: POST /register (no password),
// the link from the mocked mailer, then POST /verify-email with a password.
// The mailer's sendVerificationEmail must already be a jest spy.
function verificationHelpers(app, { mailer, User, password }) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitFor = async (fn, ms = 3000) => {
    const end = Date.now() + ms;
    for (;;) {
      if (await fn()) return;
      if (Date.now() > end) throw new Error('condition not met in time');
      await sleep(10);
    }
  };

  const linksTo = (address) =>
    mailer.sendVerificationEmail.mock.calls.filter(([to]) => to === address).map(([, link]) => link);
  const lastLinkTo = (address) => linksTo(address).at(-1);

  // Lets the next resend/re-register send a mail despite the one-minute cooldown.
  const endCooldown = (email) =>
    User.updateOne({ email }, { verifyTokenSentAt: new Date(Date.now() - 61 * 1000) });

  async function registerUnverified(body) {
    const address = body.email.toLowerCase();
    const before = linksTo(address).length;
    const res = await request(app).post('/api/auth/register').send(body);
    if (res.status !== 202) throw new Error(`register answered ${res.status}`);
    await waitFor(() => linksTo(address).length > before);
    return { ...body, link: lastLinkTo(address) };
  }

  const verify = (link, chosenPassword = password) =>
    request(app).post('/api/auth/verify-email').send({ token: tokenFromLink(link), password: chosenPassword });

  return { sleep, waitFor, linksTo, lastLinkTo, endCooldown, registerUnverified, verify };
}

module.exports = { verificationHelpers };
