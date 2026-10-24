/* eslint-disable no-console */

/// Build the app source: the Electron main process, the preload script, and the Angular
/// renderer.
///
/// webpack writes all three into one directory, which is what electron-builder packages as the
/// app. That directory is named by the configuration, so this points webpack at it rather than
/// letting it default to apps/desktop/build.
///
/// This runs webpack itself instead of `npm run build`, which was a script running
/// `concurrently` running three more scripts running `cross-env` running webpack. What those
/// layers were for is here directly: the mode and the output path go into each child's
/// environment, and the three configurations run at once.
///
/// One process per configuration, rather than webpack's own MultiCompiler, because the three
/// compilations are CPU-bound and JavaScript is single-threaded: measured on this tree, one
/// process took 28s and 4.3 GB where three took 18s and 3.6 GB apiece.
///
/// Usage:
///   bw-task build app --build-dir build-mac

import { spawn } from "child_process";
import { createRequire } from "module";
import path from "path";

import { type BuildConfig, BuildError } from "./build-config.mts";
import { loadBuildConfig, parseBuildArgs, projectDir, runScript } from "./build-support.mts";

/// What `webpack` on PATH runs: webpack's own bin, which hands off to webpack-cli. Resolved
/// rather than named as a path so that it follows the dependency instead of assuming where npm
/// happened to install it.
const require = createRequire(import.meta.url);
const WEBPACK_BIN = require.resolve("webpack/bin/webpack.js");

const WEBPACK_CONFIG = "webpack.config.js";

/// The three configurations webpack.config.js returns, by the name each one carries.
const CONFIG_NAMES = ["main", "renderer", "preload"];

interface Compilation {
  name: string;
  /// Null when the child was killed by a signal rather than exiting.
  code: number | null;
  output: string;
}

runScript(async () => {
  const args = parseBuildArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: bw-task build app --build-dir <dir>");
    return;
  }
  await build(loadBuildConfig(args.buildDir));
});

async function build(config: BuildConfig): Promise<void> {
  console.log(
    `Building the app source (${config.channel}, ${config.profile}) into ` +
      `${config.directories.appSource}`,
  );
  console.log(`Running webpack for ${CONFIG_NAMES.join(", ")}`);

  const env = buildEnv(config);
  const compilations = await Promise.all(
    CONFIG_NAMES.map((name) => compile(name, env).then(report)),
  );

  const failed = compilations.filter((compilation) => compilation.code !== 0);
  if (failed.length > 0) {
    throw new BuildError(
      `webpack failed for ${failed.map((compilation) => compilation.name).join(", ")}.`,
    );
  }
}

function buildEnv(config: BuildConfig): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // webpack.base.js reads this and uses it verbatim as webpack's `mode`, which is why it is
    // webpack's spelling of the profile rather than the configuration's.
    NODE_ENV: config.profile === "debug" ? "development" : "production",
    OUTPUT_PATH: path.resolve(projectDir, config.directories.appSource),
    // Read by apps/desktop/config/config.js, which is what makes a beta build point at beta
    // update channels and use the beta icons. Packaging cannot fix this after the fact, so a
    // beta configuration has to be built as beta.
    ...(config.channel === "beta" ? { CHANNEL: "beta" } : {}),
  };
}

/// Output is collected rather than inherited, so that three compilations running at once do
/// not interleave their reports into something unreadable. Each one is printed whole, as soon
/// as it finishes.
function compile(name: string, env: NodeJS.ProcessEnv): Promise<Compilation> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [WEBPACK_BIN, "--config", WEBPACK_CONFIG, "--config-name", name],
      { cwd: projectDir, env, stdio: ["ignore", "pipe", "pipe"] },
    );

    let output = "";
    const collect = (chunk: string) => {
      output += chunk;
    };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", collect);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", collect);

    child.on("error", (error) => {
      reject(new BuildError(`Could not run webpack for ${name}: ${error.message}`));
    });
    child.on("close", (code) => {
      resolve({ name, code, output });
    });
  });
}

function report(compilation: Compilation): Compilation {
  const { name, code, output } = compilation;
  console.log(`\n--- ${name} ---`);
  process.stdout.write(output.endsWith("\n") || output === "" ? output : `${output}\n`);
  if (code !== 0) {
    console.error(`${name} exited with ${code == null ? "a signal" : `code ${code}`}.`);
  }
  return compilation;
}
