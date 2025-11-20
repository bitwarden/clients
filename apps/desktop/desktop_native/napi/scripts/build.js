/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const isRelease = args.includes('--release');

if (isRelease) {
  console.log('Building release mode.');
} else {
  console.log('Building debug mode.');
  process.env.RUST_LOG = 'debug';
}

const featuresArg = process.env.SANDBOX_BUILD === '1' ? '--features sandbox' : '';
if (featuresArg) {
  console.log('Building with sandbox feature enabled.');
}

execSync(`napi build --platform --js false ${featuresArg}`, { stdio: 'inherit', env: process.env });
