/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const isRelease = args.includes('--release');

if (isRelease) {
  console.log('Building release mode.');

  execSync('napi build --platform --js false');

} else {
  console.log('Building debug mode.');

  execSync('napi build --platform --js false', {
    env: { ...process.env, RUST_LOG: 'debug' }
  });
}
