/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');

const args = process.argv.slice(2);

const isRelease = args.includes('--release');

const argsString = args.join(' ');

if (isRelease) {
  console.log('Building release mode.');

  execSync(`napi build --platform --no-js ${argsString}`, { stdio: 'inherit'});

} else {
  console.log('Building debug mode.');

  execSync(`napi build --platform --no-js ${argsString}`, {
    stdio: 'inherit',
    env: { ...process.env, RUST_LOG: 'debug' }
  });
}
