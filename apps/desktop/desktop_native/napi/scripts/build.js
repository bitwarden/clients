/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');

const args = process.argv.slice(2);

console.log(args);
const releaseFlag = args.find(arg => arg === "--release") ?? ""
const isRelease = releaseFlag != "";

const target = args.find(arg => arg.startsWith("--target")) ?? ""

if (isRelease) {
  console.log('Building release mode.');
} else {
  console.log('Building debug mode.');
  process.env.RUST_LOG = 'debug';
}

const cmd = `napi build --platform --js false ${target} ${releaseFlag}`
console.log(`Executing: ${cmd}`);
execSync(cmd, { stdio: 'inherit', env: process.env });
