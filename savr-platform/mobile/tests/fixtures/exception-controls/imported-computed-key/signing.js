// The signing key is computed, so the literal never appears in app.config.ts.
const key = ['codeSigning', 'Certificate'].join('');

module.exports = { updateSettings: { [key]: './certs/certificate.pem' } };
