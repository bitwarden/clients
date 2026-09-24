#!/usr/bin/env node

/// Build the macOS autofill library that will be used in the macOS autofill
/// extension to connect to the desktop app IPC channel.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, utimesSync, statSync, writeFileSync } from "fs";
import { glob } from 'fs/promises';
import path from "path";
import { fileURLToPath } from 'url';

import { type Architecture, type BuildConfig, BuildError, type BuildTask, type Profile } from "../../scripts/build-config.mts";
import { addDepFileEntry, Logger, processDepFile, runCommand, withExt, withStemSuffix } from "../../scripts/build-support.mts";
import { runCargoBuild, rustTargetsFor } from "../../scripts/build-support-rust.mts";
import { getConfigHash } from "../../scripts/build-config.mts";
import { execFileSync } from "child_process";

// Defined in ./uniffi.toml
const SWIFT_MODULE_NAME = "BitwardenMacosProvider";
const SWIFT_BINDINGS_RELATIVE = `Sources/${SWIFT_MODULE_NAME}`;

const FFI_CRATE = "autofill_provider";
const FFI_LIBRARY = "libautofill_provider.a";
const FFI_FRAMEWORK_NAME = SWIFT_MODULE_NAME + "FFI";
// Defined in ./uniffi.toml
const FFI_MODULE_NAME = "BitwardenMacosProviderFFI";
const FFI_FRAMEWORK_RELATIVE = `Frameworks/${FFI_FRAMEWORK_NAME}.xcframework`;
const FFI_CRATE_DIR = `desktop_native/${FFI_CRATE}`;

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Builds the Rust library for the requested architectures, combining into a universal library as needed.
 * @param cargoBin Path to cargo binary from build config.
 * @param privateDir Directory for temporary files during build.
 * @param profile Profile to use for compiling the static library.
 * @param architectures Architectures to compile. 
 * @returns A list of the compiled static library or libraries, if the build is a universal.
 */
async function buildFfi(cargoBin: string, privateDir: string, profile: Profile, architecture: Architecture): Promise<string[]> {
  const libraries = [];
  const rustTargets = rustTargetsFor("macos", architecture);
  for (const target of rustTargets) {
    Logger.log(`Building FFI library (${target})...`);
    const cargoResult = await runCargoBuild(cargoBin, FFI_CRATE, ["uniffi"], target, profile);

    if (!cargoResult.filenames) {
      throw new BuildError("Cargo did not output expected files");
    }

    Logger.debug({ filenames: cargoResult.filenames, depFiles: cargoResult.depFiles });
    const libPath = cargoResult.filenames.find(l => path.basename(l) == FFI_LIBRARY)!;
    // Copy the library, preserving the modification times.
    const stat = statSync(libPath);
    const libDest = path.resolve(privateDir, withStemSuffix(path.basename(libPath), `-${target}`));
    copyFileSync(libPath, libDest);
    utimesSync(libDest, stat.atime, stat.mtime);
    libraries.push(libDest);

    // Copy the related dependency file.
    const depFilePath = cargoResult.depFiles!.find(d => path.basename(d) == withExt(FFI_LIBRARY, ".d"))!;
    const depFile = readFileSync(depFilePath, { encoding: "utf-8" });
    const newDepFile = depFile.replace(libPath, libDest)
    const newDepFilePath = path.resolve(privateDir, withStemSuffix(withExt(path.basename(libPath), ".d"), `-${target}`));
    writeFileSync(newDepFilePath, newDepFile);
  }

  return libraries;
}

/**
 * Assembles the Rust static library into a Swift package for use in Xcode.
 * 
 * @param cargoBin Path to cargo binary from build config.
 * @param outputDir Build output directory.
 * @param privateDir Directory for temporary files during build.
 * @param libraries Paths to UniFFI static libraries.
 * @param libraryIdentifier Xcode LibraryIdentifier read from build config.
 */
async function buildSwiftPackage(cargoBin: string, outputDir: string, privateDir: string, libraries: string[], libraryIdentifier: string): Promise<void> {
  // NOTE: If any new output files are generated and added to the depfile, they also need to be added to
  // the outputFiles parameter of the preBuildScript in
  // apps/desktop/macos/project-autofill-extension.yml.
  const depFilePath = getDepFilePath(privateDir);
  const targetDependencies = libraries.concat([fileURLToPath(import.meta.url), path.resolve(SOURCE_DIR, "uniffi.toml")])

  // Combine static libraries into a universal library, if necessary.
  const libraryOutputPath = path.join(privateDir, FFI_LIBRARY);
  if (libraries.length > 1) {
    Logger.log(`Creating universal library\n  from: ${libraries}\n  to:   ${libraryOutputPath}`)
    await runCommand("lipo", ["-create", ...libraries, "-output", libraryOutputPath], { timing: true });
  }
  else {
    Logger.log(`Copying autofill provider library...\n  from: ${libraries[0]}\n  to:   ${libraryOutputPath}`);
    copyFileSync(libraries[0], libraryOutputPath);
  }

  // Generate the Swift bindings for the native library with UniFFI.
  // uniffi reads the interface out of metadata the crate embeds in the compiled library, which
  // is why this runs against a build output rather than the source.
  const bindingsDir = path.join(privateDir, "bindings");
  Logger.log("Generating Swift bindings");
  await runCommand(
    cargoBin,
    [
      "run",
      "--bin",
      "uniffi-bindgen",
      "--features",
      "uniffi/cli",
      "generate",
      // Use the non-universal library to generate bindings.
      libraries[0],
      "--library",
      "--language",
      "swift",
      "--no-format",
      "--out-dir",
      bindingsDir,
    ],
    { cwd: FFI_CRATE_DIR },
  );

  const headersDir = path.join(privateDir, "Headers");
  mkdirSync(headersDir, { recursive: true });
  collectBindings(bindingsDir, headersDir, outputDir);

  // Create the Framework to hold the static libraries and headers.
  const xcframework = path.join(outputDir, FFI_FRAMEWORK_RELATIVE);
  // xcodebuild refuses to overwrite an existing xcframework, and a stale one left behind by a
  // failed run would otherwise be what the Xcode build links.
  rmSync(xcframework, { recursive: true, force: true });

  // Execute xcodebuild
  await runCommand("xcodebuild", [
    "-create-xcframework",
    "-library",
    libraryOutputPath,
    "-headers",
    headersDir,
    "-output",
    xcframework,
  ], { timing: true });
  const ffiFrameworkDir = path.join(outputDir, FFI_FRAMEWORK_RELATIVE);
  addDepFileEntry(depFilePath, path.join(ffiFrameworkDir, libraryIdentifier, "Headers", `${FFI_MODULE_NAME}.h`), targetDependencies);
  addDepFileEntry(depFilePath, path.join(ffiFrameworkDir, libraryIdentifier, "Headers", "module.modulemap"), targetDependencies);
  addDepFileEntry(depFilePath, path.join(ffiFrameworkDir, libraryIdentifier, FFI_LIBRARY), targetDependencies);
  addDepFileEntry(depFilePath, path.join(ffiFrameworkDir, "Info.plist"), targetDependencies);
  addDepFileEntry(depFilePath, path.join(outputDir, SWIFT_BINDINGS_RELATIVE, `${SWIFT_MODULE_NAME}.swift`), targetDependencies);
}

/**
 * Organizes the Swift bindings, headers and modulemap into the structure of a
 * Swift package.
 */
function collectBindings(bindingsDir: string, headersDir: string, outputDir: string): void {
  const swiftDir = path.join(outputDir, SWIFT_BINDINGS_RELATIVE);
  mkdirSync(swiftDir, { recursive: true });

  const generated = readdirSync(bindingsDir);
  const withExtension = (extension: string) =>
    generated.filter((file) => path.extname(file) === extension);

  for (const file of withExtension(".swift")) {
    renameSync(path.join(bindingsDir, file), path.join(swiftDir, file));
  }
  for (const file of withExtension(".h")) {
    renameSync(path.join(bindingsDir, file), path.join(headersDir, file));
  }

  const moduleMaps = withExtension(".modulemap");
  if (moduleMaps.length === 0) {
    throw new BuildError(`uniffi generated no module map in ${bindingsDir}.`);
  }
  writeFileSync(
    path.join(headersDir, "module.modulemap"),
    moduleMaps.map((file) => readFileSync(path.join(bindingsDir, file), "utf8")).join(""),
  );
}

const BitwardenMacosProviderBuildTask: BuildTask = {
  targetName: "BitwardenMacosProvider",
  sourceDir: SOURCE_DIR,
  dependencies: [],
  async validate(config: BuildConfig): Promise<void> {
    const validationErrors = [];
    if (process.platform !== "darwin") {
      validationErrors.push(new BuildError(
        `The autofill extension needs Xcode; it cannot be built on ${process.platform}.`,
      ));
    }

    if (!config.profile) {
      validationErrors.push(new BuildError("Build profile not specified"));
    }

    if (!config.architecture) {
      validationErrors.push(new BuildError("Architecture not specified"));
    }

    if (config.architecture == "ia32") {
      validationErrors.push(new BuildError("32-bit macOS builds are not supported."));
    }

    if (!config.toolchains.cargo.bin) {
      validationErrors.push(new BuildError("Cargo binary not specified"));
    }

    if (!config.derived.macos?.libraryIdentifier) {
      validationErrors.push(new BuildError("Xcode library identifier not specified"));
    }

    if (validationErrors.length > 0) {
      throw new AggregateError(validationErrors, `Build configuration of ${this.targetName} failed validation`);
    }
  },

  async configure(config: BuildConfig, outputDir: string, _privateDir: string) {
    // Create a placeholder Swift source file before the first build so that the
    // xcodegen bootstrap for the autofill extension can succeed.
    const placeholderFilePath = path.join(outputDir, SWIFT_BINDINGS_RELATIVE, `${SWIFT_MODULE_NAME}.swift`);
    if (!existsSync(placeholderFilePath)) {
      mkdirSync(path.dirname(placeholderFilePath), { recursive: true });
      writeFileSync(placeholderFilePath, "");
    }
  },

  async build(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    this.validate(config);

    const configHash = getConfigHash(config);
    const configHashFile = path.join(privateDir, "config.hash");
    let hasConfigChanged = false;
    try {
      const existingHash = readFileSync(configHashFile, { encoding: "utf-8"});
      if (existingHash != configHash) {
        Logger.warn("Configuration has changed.")
        hasConfigChanged = true;
        writeFileSync(configHashFile, configHash);
      }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        writeFileSync(configHashFile, configHash);
      } else {
        throw error;
      }
    }

    // Delete the dep files if the configuration has changed.
    if (hasConfigChanged) {
      for await (const filename of glob(`${privateDir}/*.d`)) {
        rmSync(filename);
      }
    }

    // extract the information we need from config in one place for easier review later.
    const { profile, architecture, toolchains: { cargo: { bin: cargoBin } }, derived: { macos } } = config;

    const rustTargets = rustTargetsFor("macos", architecture);
    const isStaticLibStale = 
      rustTargets.some((target) => {
        const depFilePath = withStemSuffix(withExt(path.join(privateDir, FFI_LIBRARY), ".d"), `-${target}`);
        if (!existsSync(depFilePath)) {
          return true;
        };
        return processDepFile(depFilePath).isStale;
    });

    // We should add an incremental compilation check here if possible: cargo
    // overhead wastes 800-1000ms when nothing has changed. Small, but noticable
    // in a tight development loop.
    let libraries;
    if (isStaticLibStale) {
      libraries = await buildFfi(cargoBin, privateDir, profile, architecture)
    } else {
      Logger.debug("UniFFI library is up to date, no compilation needed");
      libraries = rustTargets.map(target => path.join(privateDir, withStemSuffix(FFI_LIBRARY, `-${target}`)));
    }

    const swiftPackageDepFile = getDepFilePath(privateDir);
    const isSwiftPackageStale = !existsSync(swiftPackageDepFile) || processDepFile(swiftPackageDepFile).isStale;
    if (isSwiftPackageStale) {
      await buildSwiftPackage(cargoBin, outputDir, privateDir, libraries, macos!.libraryIdentifier);
    } else {
      Logger.debug("Swift package is up to date, no compilation needed");
    }
  }
}

export default BitwardenMacosProviderBuildTask;

function getDepFilePath(privateDir: string) {
  return path.join(privateDir, `${SWIFT_MODULE_NAME}.d`);
}

async function main() {
  const { Command, Option } = await import('commander');
  
  // Define a program that can take either:
  // - a build directory
  // - a config file
  // - CLI parameters
  const collectValues = (value: string, arr: string[]) => (arr ?? []).concat([value]);
  const program = new Command();
  program
    .name('build-macos-autofill-lib')
    .description('CLI to build autofill provider Swift package for macOS');
  
  program
    .usage("[-C <path> | --config-file <path> | options]")
    .addOption(
      new Option('-C, --build-dir <path>', 'Path to the build directory')
      .conflicts('configFile')
    )
    .addOption(
      new Option('--config-file <path>', 'Path to the configuration file')
    )
    .option('--profile <profile>', 'Profile to compile library with')
    .option('--architecture <architecture>', 'Architectures to compile for (may be specified multiple times)', collectValues)
    .addHelpText('after', `
Examples:
  $ ${program.name()} -C ./build
  $ ${program.name()} --config-file ./build-config.json
  $ ${program.name()} --profile <debug|release> --architecture <architecture> [--architecture <architecture>]*`)
    .action(async (options) => {
      if (!options.buildDir && !options.configFile && !(options.profile && options.architecture && options.architecture.length > 0)) {
        program.error('Error: You must provide either -C/--build-dir, --config-file, or --profile and --architecture.');
      }

      let buildConfig, outputDir, privateDir;
      if (options.buildDir) {
        const buildDir = path.resolve(options.buildDir);
        const buildConfigFile = readFileSync(path.join(buildDir, "build-config.json"), "utf-8");
        buildConfig = JSON.parse(buildConfigFile);
        if (path.resolve(buildConfig.buildDir) != path.resolve(options.buildDir)) {
          program.error('Error: configuration.buildDir and supplied build dir do not match');
        }
        outputDir = path.resolve(path.join(buildConfig.buildDir, "apps/desktop", FFI_CRATE_DIR, SWIFT_MODULE_NAME));
        privateDir = path.resolve(path.join(buildConfig.buildDir, "apps/desktop", FFI_CRATE_DIR, `${SWIFT_MODULE_NAME}.p`));
      }
      else if (options.configFile) {
        const buildConfigFile = readFileSync(path.resolve(options.configFile), "utf-8");
        buildConfig = JSON.parse(buildConfigFile);

        outputDir = path.resolve(path.join(buildConfig.buildDir, "apps/desktop", FFI_CRATE_DIR, SWIFT_MODULE_NAME));
        privateDir = path.resolve(path.join(buildConfig.buildDir, "apps/desktop", FFI_CRATE_DIR, `${SWIFT_MODULE_NAME}.p`));
      }
      else {
        if (!options.profile || !options.architecture || options.architecture.length === 0) {
          program.error("Both --profile and --architecture must be specified if using CLI arguments.")
        }
        
        const cargoBin = execFileSync("which", ["cargo"]).toString().trim();
        buildConfig = {
          buildDir: path.join(SOURCE_DIR, "build"),
          profile: options.profile,
          architecture: options.architecture,
          toolchains: {
            cargo: {
              bin: cargoBin
            }
          }
        } as BuildConfig;
        outputDir = path.resolve(process.env.OUTPUT_DIR || path.join(buildConfig.buildDir, SWIFT_MODULE_NAME));
        privateDir = path.resolve(process.env.PRIVATE_DIR || path.join(buildConfig.buildDir, `${SWIFT_MODULE_NAME}.p`));
      }

      mkdirSync(outputDir, { recursive: true })
      mkdirSync(privateDir, { recursive: true })
      await BitwardenMacosProviderBuildTask.build(buildConfig, outputDir, privateDir);
    });
  program.parse();
}

// Check if the current file path matches the entry point path
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
