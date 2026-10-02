/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

// Neither exports these from its package root. electron-builder reaches into osx-sign the same way.
const { walkAsync } = require("@electron/osx-sign/dist/cjs/util");
const { sign } = require("app-builder-lib/out/codeSign/macCodeSign");
const { retry } = require("builder-util");

const execFile = promisify(child_process.execFile);

const ELECTRON_FRAMEWORK = "Electron Framework.framework";

// How many files are signed at once. Each spends most of its time waiting on Apple's timestamp
// server rather than on the CPU, so this is not tied to the number of cores, which is as few as 3
// on GitHub's macOS runners.
const SIGNING_CONCURRENCY = 12;

/**
 * electron-builder's `sign` hook for macOS builds. Signs Electron's framework, then hands the
 * rest of the app to osx-sign the way electron-builder would, with the framework left out.
 *
 * The framework is most of the files osx-sign would sign, and it signs them one at a time, each
 * with a round trip to Apple's timestamp server. Here they are signed in parallel. Nothing in the
 * framework comes from the app, so it is signed on its own, with the options electron-builder
 * resolved for it, before the app's signature seals it.
 *
 * @param {import("@electron/osx-sign").SignOptions} opts The options electron-builder would pass to osx-sign.
 */
exports.default = async function (opts) {
  const frameworkPath = path.resolve(opts.app, "Contents/Frameworks", ELECTRON_FRAMEWORK);
  await signElectronFramework(frameworkPath, opts);
  await sign({
    ...opts,
    ignore: (file) =>
      file === frameworkPath || file.startsWith(frameworkPath + path.sep) || opts.ignore(file),
  });
};

/**
 * Signs each binary in the framework, as osx-sign would find them, then the framework itself.
 *
 * @param {string} frameworkPath
 * @param {import("@electron/osx-sign").SignOptions} opts
 */
async function signElectronFramework(frameworkPath, opts) {
  const start = Date.now();

  // walkAsync follows symlinks, and a framework's top-level entries all point into Versions/A,
  // so it finds some files more than once. codesign must not sign the same file twice at once.
  const found = await walkAsync(frameworkPath);
  const files = [...new Set(await Promise.all(found.map((file) => fs.promises.realpath(file))))];

  // A bundle has to be signed after everything in it, which signing in parallel does not do.
  const bundles = files.filter((file) => [".app", ".framework"].includes(path.extname(file)));
  if (bundles.length > 0) {
    throw new Error(
      `${ELECTRON_FRAMEWORK} has nested bundles, which are not supported: ${bundles}`,
    );
  }

  console.log(`Signing ${files.length} files in ${ELECTRON_FRAMEWORK}`);
  const queue = [...files];
  const worker = async () => {
    for (let file = queue.shift(); file != null; file = queue.shift()) {
      await codesign(file, opts);
    }
  };
  await Promise.all(Array.from({ length: SIGNING_CONCURRENCY }, worker));
  await codesign(frameworkPath, opts);
  console.log(`Signed ${ELECTRON_FRAMEWORK} in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

/**
 * Signs one file with the arguments osx-sign would use for it.
 *
 * @param {string} file
 * @param {import("@electron/osx-sign").SignOptions} opts
 */
async function codesign(file, opts) {
  const { entitlements, hardenedRuntime, timestamp, requirements, additionalArguments } =
    opts.optionsForFile(file);
  if (entitlements == null) {
    // osx-sign would fall back to its own defaults, which electron-builder never lets it do.
    throw new Error(`electron-builder resolved no entitlements for ${file}`);
  }

  const args = ["--sign", opts.identity, "--force"];
  if (opts.keychain) {
    args.push("--keychain", opts.keychain);
  }
  if (requirements) {
    args.push(
      ...(requirements.startsWith("=") ? [`-r${requirements}`] : ["--requirements", requirements]),
    );
  }
  args.push(timestamp ? `--timestamp=${timestamp}` : "--timestamp");
  if (hardenedRuntime) {
    args.push("--options", "runtime");
  }
  args.push(...(additionalArguments ?? []), "--entitlements", entitlements, file);

  // As electron-builder retries osx-sign, since the timestamp server fails now and then.
  await retry(
    async () => {
      try {
        // Captured rather than inherited: codesign reports "replacing existing signature" for
        // every file, because Electron ships them signed with its own identity.
        await execFile("codesign", args);
      } catch (e) {
        throw new Error(`codesign failed for ${file}: ${e.stderr ?? e}`);
      }
    },
    { retries: 3, interval: 5000, backoff: 5000 },
  );
}
