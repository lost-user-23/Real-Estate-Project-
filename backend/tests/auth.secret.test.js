describe('JWT secret', () => {
  it('makes auth.service throw at load when JWT_SECRET is missing (no fallback)', () => {
    const original = process.env.JWT_SECRET;
    // An empty string, not delete: dotenv would refill an unset var from backend/.env.
    process.env.JWT_SECRET = '';
    jest.resetModules();
    expect(() => require('../src/services/auth.service')).toThrow(/JWT_SECRET must be set/);
    process.env.JWT_SECRET = original;
    jest.resetModules();
  });
});
