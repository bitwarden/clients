import { spawn } from "child_process";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

import { type BuildConfig, type BuildTask, BuildError } from "./scripts/build-config.mts";
import NapiBuildTask from "./desktop_native/napi/scripts/build-napi.mts";
import { Logger } from "./scripts/build-support.mts";

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));

/// What `webpack` on PATH runs: webpack's own bin, which hands off to webpack-cli. Resolved
/// rather than named as a path so that it follows the dependency instead of assuming where npm
/// happened to install it.
const require = createRequire(import.meta.url);
const WEBPACK_BIN = path.resolve(require.resolve("webpack/bin/webpack.js"));

const WEBPACK_CONFIG = path.resolve(SOURCE_DIR, "webpack.config.js");

/// The three configurations webpack.config.js returns, by the name each one carries.
const CONFIG_NAMES = ["main", "renderer", "preload"];

interface Compilation {
  name: string;
  /// Null when the child was killed by a signal rather than exiting.
  code: number | null;
  output: string;
}

const WebpackBuildTask: BuildTask = {
  targetName: "WebpackApplication",
  sourceDir: SOURCE_DIR,
  dependencies: [NapiBuildTask],
  async validate(config: BuildConfig): Promise<void> {
    const validationErrors: BuildError[] = [];
    if (!config.profile) {
      validationErrors.push(new BuildError("Profile is not set"));
    }

    if (!config.channel) {
      validationErrors.push(new BuildError("Channel is not set"));
    }

    if (!config.toolchains.node.bin) {
      validationErrors.push(new BuildError("Node binary not found"));
    }

    if (validationErrors.length > 0) {
      throw new AggregateError(
        validationErrors,
        `Build configuration of ${this.targetName} failed validation`,
      );
    }
  },
  async configure(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {},
  async build(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    const env = buildEnv(config, outputDir);
    const nodeBin = config.toolchains.node.bin;
    const compilations = await Promise.all(
      CONFIG_NAMES.map((name) => compile(nodeBin, name, env).then(report)),
    );

    const failed = compilations.filter((compilation) => compilation.code !== 0);
    if (failed.length > 0) {
      throw new BuildError(
        `webpack failed for ${failed.map((compilation) => compilation.name).join(", ")}.`,
      );
    }
  },
};

function buildEnv(config: BuildConfig, outputDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: config.profile === "debug" ? "development" : "production",
    OUTPUT_PATH: outputDir,
    ...(config.channel === "beta" ? { CHANNEL: "beta" } : {}),
  };
}

function compile(nodeBin: string, name: string, env: NodeJS.ProcessEnv): Promise<Compilation> {
  return new Promise((resolve, reject) => {
    // We're not using runCommand here because we want to run these in parallel,
    // but the output would be interleaved if we did that.
    const child = spawn(nodeBin, [WEBPACK_BIN, "--config", WEBPACK_CONFIG, "--config-name", name], {
      cwd: SOURCE_DIR,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let captured: Buffer[] = [];
    const collect = (chunk: Buffer) => {
      captured.push(chunk);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);

    child.on("error", (error) => {
      reject(new BuildError(`Could not run webpack for ${name}: ${error.message}`));
    });
    child.on("close", (code) => {
      const output = Buffer.concat(captured).toString("utf-8");
      resolve({ name, code, output });
    });
  });
}

function report(compilation: Compilation): Compilation {
  const { name, code, output } = compilation;
  console.log(`\n--- ${name} ---`);
  process.stdout.write(output.endsWith("\n") || output === "" ? output : `${output}\n`);
  if (code !== 0) {
    Logger.error(`${name} exited with ${code == null ? "a signal" : `code ${code}`}.`);
    Logger.error(output);
  } else {
    Logger.log(output);
  }
  return compilation;
}

export default WebpackBuildTask;
