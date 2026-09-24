import { spawn } from "child_process";
import {
  copyFileSync,
  type Dirent,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

import { type BuildConfig, type BuildTask, BuildError } from "./scripts/build-config.mts";
import NapiBuildTask from "./desktop_native/napi/scripts/build-napi.mts";
import { Logger, processDepFile } from "./scripts/build-support.mts";

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(SOURCE_DIR, "src");

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
  async configure(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    const isDev = config.profile === "debug";
    const isBeta = config.channel === "beta";

    // Incrementally copy static assets that CopyWebpackPlugin would otherwise
    // re-read on every warm build. Only files newer than their destination are
    // copied; unchanged files are skipped entirely.
    copyIfNewer(path.join(ASSETS_DIR, "package.json"), path.join(outputDir, "package.json"));
    copyDirIfNewer(path.join(ASSETS_DIR, "locales"), path.join(outputDir, "locales"));
    copyImages(isDev, isBeta, outputDir);

    // Write a thin config wrapper that forwards to webpack.config.js, strips
    // CopyWebpackPlugin (assets are already handled above), injects the
    // filesystem cache, and records a dep file for each config so that build()
    // can skip a compilation when its inputs haven't changed.
    // Webpack's CLI has no flag for cache options, so we generate this file
    // here and pass it as --config in build().
    const cacheDir = path.join(privateDir, "webpack-cache");
    // The primary output file for each webpack config, used as the dep file target.
    const depsByConfig = JSON.stringify({
      main: {
        outputFile: path.join(outputDir, "main.js"),
        depsPath: path.join(privateDir, "webpack-main.d"),
      },
      renderer: {
        outputFile: path.join(outputDir, "app", "main.js"),
        depsPath: path.join(privateDir, "webpack-renderer.d"),
      },
      preload: {
        outputFile: path.join(outputDir, "preload.js"),
        depsPath: path.join(privateDir, "webpack-preload.d"),
      },
    });
    const wrapper = `\
"use strict";
const { statSync, writeFileSync } = require('fs');
const base = require(${JSON.stringify(WEBPACK_CONFIG)});
const DEPS_BY_CONFIG = ${depsByConfig};
module.exports = function(env, argv) {
  return base(env, argv).map((c) => {
    const ct = DEPS_BY_CONFIG[c.name];
    return {
      ...c,
      plugins: [
        ...(c.plugins ?? []).filter((p) => p?.constructor?.name !== "CopyWebpackPlugin"),
        {
          apply(compiler) {
            compiler.hooks.done.tap('WriteDeps', (stats) => {
              if (!ct || stats.hasErrors()) return;
              const paths = [...stats.compilation.fileDependencies]
                .filter(p => { try { return statSync(p).isFile(); } catch { return false; } })
                .sort();
              if (paths.length > 0) {
                writeFileSync(ct.depsPath, ct.outputFile + ': ' + paths.join(' ') + '\\n', 'utf-8');
              }
            });
          }
        },
      ],
      cache: {
        type: "filesystem",
        name: c.name,
        cacheDirectory: ${JSON.stringify(cacheDir)},
        buildDependencies: { config: [${JSON.stringify(WEBPACK_CONFIG)}] },
      },
    };
  });
};
`;
    writeFileSync(path.join(privateDir, "webpack.config.js"), wrapper, "utf-8");
  },
  async build(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    const env = buildEnv(config, outputDir);
    const nodeBin = config.toolchains.node.bin;
    const wrappedConfig = path.join(privateDir, "webpack.config.js");

    // Check each config's dep file to skip compilations whose inputs haven't changed.
    const staleNames = CONFIG_NAMES.filter((name) => {
      const depsPath = path.join(privateDir, `webpack-${name}.d`);
      if (!existsSync(depsPath)) return true;
      try {
        return processDepFile(depsPath).isStale;
      } catch {
        return true;
      }
    });

    for (const name of CONFIG_NAMES) {
      if (!staleNames.includes(name)) {
        console.log(`\n--- ${name} ---`);
        console.log(`webpack up to date, skipping.`);
      }
    }

    if (staleNames.length === 0) return;

    const compilations = await Promise.all(
      staleNames.map((name) => compile(nodeBin, name, env, wrappedConfig).then(report)),
    );

    const failed = compilations.filter((compilation) => compilation.code !== 0);
    if (failed.length > 0) {
      throw new BuildError(
        `webpack failed for ${failed.map((compilation) => compilation.name).join(", ")}.`,
      );
    }

    // Touch the primary output file for each successful compilation so that
    // its mtime reflects this build, even when webpack's compareBeforeEmit
    // skipped writing an unchanged bundle (which would leave a stale mtime).
    const outputFiles: Record<string, string> = {
      main: path.join(outputDir, "main.js"),
      renderer: path.join(outputDir, "app", "main.js"),
      preload: path.join(outputDir, "preload.js"),
    };
    const now = new Date();
    for (const { name, code } of compilations) {
      if (code === 0) {
        const outFile = outputFiles[name];
        if (outFile && existsSync(outFile)) {
          utimesSync(outFile, now, now);
        }
      }
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

/// Copies src to dest if src is newer than dest (or dest does not exist).
function copyIfNewer(src: string, dest: string): void {
  let srcMtime: number;
  try {
    srcMtime = statSync(src).mtimeMs;
  } catch {
    return; // source missing — nothing to do
  }
  try {
    if (statSync(dest).mtimeMs >= srcMtime) return;
  } catch {
    // dest does not exist — fall through to copy
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

/// Recursively copies all files under srcDir to destDir, skipping files that
/// are already up to date.
function copyDirIfNewer(srcDir: string, destDir: string): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirIfNewer(src, dest);
    } else if (entry.isFile()) {
      copyIfNewer(src, dest);
    }
  }
}

/// Copies src/images to outputDir/images, applying the same channel- and
/// profile-specific filtering that CopyWebpackPlugin uses in webpack.base.js:
///   - *_beta.{png,ico}: beta only, copied with "_beta" stripped from the name
///   - *_dev.png:        debug only, copied as-is
///   - everything else:  always copied
function copyImages(isDev: boolean, isBeta: boolean, outputDir: string): void {
  const srcDir = path.join(ASSETS_DIR, "images");
  const destDir = path.join(outputDir, "images");
  let entries: Dirent[];
  try {
    entries = readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const { name } = entry;
    const src = path.join(srcDir, name);
    if (/_beta\.(png|ico)$/.test(name)) {
      if (isBeta) {
        copyIfNewer(src, path.join(destDir, name.replace("_beta", "")));
      }
    } else if (/_dev\.png$/.test(name)) {
      if (isDev) {
        copyIfNewer(src, path.join(destDir, name));
      }
    } else {
      copyIfNewer(src, path.join(destDir, name));
    }
  }
}

function compile(
  nodeBin: string,
  name: string,
  env: NodeJS.ProcessEnv,
  webpackConfig: string,
): Promise<Compilation> {
  return new Promise((resolve, reject) => {
    // We're not using runCommand here because we want to run these in parallel,
    // but the output would be interleaved if we did that.
    const child = spawn(nodeBin, [WEBPACK_BIN, "--config", webpackConfig, "--config-name", name], {
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
  }
  return compilation;
}

export default WebpackBuildTask;
