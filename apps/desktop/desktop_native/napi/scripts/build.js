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

execSync(`napi build --platform --js false`, { stdio: 'inherit', env: process.env });


/*  Mac App Store build with sandboxing  - Does this belong here? 

const target = process.env.npm_config_target || '';
const featuresArg = target.includes('mas') ? '--features sandbox' : '';
execSync(`napi build --platform --js false ${featuresArg}`, { stdio: 'inherit', env: process.env });

*/
