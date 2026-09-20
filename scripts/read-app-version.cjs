/**
 * The marketing version, read out of app.config.ts without evaluating it.
 *
 * The config is TypeScript and pulls in Expo's types, so `require`ing it from
 * a plain Node script means a transpiler. The version is a single literal, so
 * a regex is honest here - and it fails loudly rather than returning
 * something wrong, which is the only property that matters when the caller is
 * a release gate.
 */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

module.exports = function readAppVersion() {
  const source = readFileSync(join(__dirname, '..', 'app.config.ts'), 'utf8');
  const match = /^\s*version:\s*'([^']+)'/m.exec(source);

  if (!match) {
    throw new Error('Could not find a version in app.config.ts');
  }
  return match[1];
};
