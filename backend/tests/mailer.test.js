// The mailer caches its transporter at module level, so each case loads a
// fresh copy of the module (and of config) with its own settings.
function loadMailer({ env, smtp, beforeLoad }) {
  jest.resetModules();
  if (beforeLoad) beforeLoad(require('nodemailer'));
  const config = require('../src/config');
  config.env = env;
  config.smtp = { host: '', port: 587, user: '', pass: '', ...smtp };
  return { mailer: require('../src/services/mailer.service'), config };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SMTP transport options', () => {
  function transportOptionsFor(port) {
    const sendMail = jest.fn().mockResolvedValue({});
    let create;
    const { mailer } = loadMailer({
      env: 'production',
      smtp: { host: 'smtp.example.com', port, user: 'u', pass: 'p' },
      beforeLoad: (nodemailer) => {
        create = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail });
      },
    });
    return mailer.sendPasswordResetEmail('a@example.com', '123456').then(() => create.mock.calls[0][0]);
  }

  it('sets timeouts and requires STARTTLS on port 587', async () => {
    const options = await transportOptionsFor(587);
    expect(options.connectionTimeout).toBeLessThanOrEqual(15000);
    expect(options.greetingTimeout).toBeLessThanOrEqual(15000);
    expect(options.requireTLS).toBe(true);
    expect(options.secure).toBe(false);
  });

  it('uses implicit TLS on 465 and does not force STARTTLS there', async () => {
    const options = await transportOptionsFor(465);
    expect(options.secure).toBe(true);
    expect(options.requireTLS).toBeUndefined();
    expect(options.connectionTimeout).toBeDefined();
  });
});

describe('mail body logging without SMTP', () => {
  async function logsFor(env) {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { mailer } = loadMailer({ env, smtp: { host: '' } });
    await mailer.sendPasswordResetEmail('a@example.com', '987654');
    return log.mock.calls.map((call) => call.join(' ')).join('\n');
  }

  it('prints the code in development', async () => {
    expect(await logsFor('development')).toContain('987654');
  });

  it('never prints the code in any other environment', async () => {
    expect(await logsFor('staging')).not.toContain('987654');
    expect(await logsFor('test')).not.toContain('987654');
  });
});
