// A local config plugin that turns on expo-updates code signing.
module.exports = (config) => ({
  ...config,
  updates: { ...config.updates, codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' } },
});
