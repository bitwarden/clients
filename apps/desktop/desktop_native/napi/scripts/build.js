/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');

args = process.argv.slice(2);

const isRelease = args.includes('--release');

const args = args.join(' ');

if (isRelease) {
  console.log('Building release mode.');

  execSync(`napi build --platform --no-js ${args}`, { stdio: 'inherit'});

} else {
  console.log('Building debug mode.');

  execSync(`napi build --platform --no-js ${args}`, {
    stdio: 'inherit',
    env: { ...process.env, RUST_LOG: 'debug' }
  });
}
