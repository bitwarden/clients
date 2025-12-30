/* eslint-disable @typescript-eslint/no-var-requires */
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const process = require("process");

// Map of the Node arch equivalents for the rust target triplets, used to move the file to the correct location
const rustTargetsMap = {
    "i686-pc-windows-msvc":       { nodeArch: 'ia32',  platform: 'win32'  },
    "x86_64-pc-windows-msvc":     { nodeArch: 'x64',   platform: 'win32'  },
    "aarch64-pc-windows-msvc":    { nodeArch: 'arm64', platform: 'win32'  },
    "x86_64-apple-darwin":        { nodeArch: 'x64',   platform: 'darwin' },
    "aarch64-apple-darwin":       { nodeArch: 'arm64', platform: 'darwin' },
    'x86_64-unknown-linux-gnu':   { nodeArch: 'x64',   platform: 'linux'  },
    'aarch64-unknown-linux-gnu':  { nodeArch: 'arm64', platform: 'linux'  },
}

// Ensure the dist directory exists
fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });

const args = process.argv.slice(2); // Get arguments passed to the script
const mode = args.includes("--release") ? "release" : "debug";
const isRelease = mode === "release";
const targetArg = args.find(arg => arg.startsWith("--target="));
const target = targetArg ? targetArg.split("=")[1] : null;

let crossPlatform = process.argv.length > 2 && process.argv[2] === "cross-platform";

function buildNapiModule(target, release = true) {
    const targetArg = target ? `--target=${target}` : "";
    const releaseArg = release ? "--release" : "";
    const crossCompileArg = target ? "--cross-compile" : "";
    child_process.execSync(`npm run build -- ${crossCompileArg} ${releaseArg} ${targetArg}`, { stdio: 'inherit', cwd: path.join(__dirname, "napi") });
}

/**
 * Build a Rust binary with Cargo.
 * 
 * If {@link target} is specified, cross-compilation helpers are used to build if necessary, and the resulting
 * binary is copied to the `dist` folder.
 * @param {string} bin Name of cargo binary package in `desktop_native` workspace.
 * @param {string?} target Rust compiler target, e.g. `aarch64-pc-windows-msvc`.
 * @param {boolean} release Whether to build in release mode.
 */
function cargoBuild(bin, target, release) {
    const xwin = target && target.includes('windows') && process.platform !== "win32" ? "xwin" : "";
    const targetArg = target ? `--target=${target}` : "";
    const releaseArg = release ? "--release" : "";
    child_process.execSync(`cargo ${xwin} build --bin ${bin} ${releaseArg} ${targetArg}`, {stdio: 'inherit', cwd: __dirname});
    if (target) {
        // Copy the resulting binary to the dist folder
        const targetFolder = isRelease ? "release" : "debug";
        const { nodeArch, platform } = rustTargetsMap[target];
        const ext = platform === "win32" ? ".exe" : "";
        fs.copyFileSync(path.join(__dirname, "target", target, targetFolder, `${bin}${ext}`), path.join(__dirname, "dist", `${bin}.${platform}-${nodeArch}${ext}`));
    }
}

function buildProxyBin(target, release = true) {
    cargoBuild("desktop_proxy", target, release)
}

function buildImporterBinaries(target, release = true) {
    // These binaries are only built for Windows, so we can skip them on other platforms
    if (process.platform === "win32" || (target && target.includes('windows'))) {
        cargoBuild("bitwarden_chromium_import_helper", target, release)
    }
}

function buildProcessIsolation() {
    if (process.platform !== "linux") {
        return;
    }

    child_process.execSync(`cargo build --release`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, "process_isolation")
    });

    console.log("Copying process isolation library to dist folder");
    fs.copyFileSync(path.join(__dirname, "target", "release", "libprocess_isolation.so"), path.join(__dirname, "dist", `libprocess_isolation.so`));
}

function installTarget(target) {
    child_process.execSync(`rustup target add ${target}`, { stdio: 'inherit', cwd: __dirname });
    // Install cargo-xwin for cross-platform builds targeting Windows
    if (target.includes('windows') && process.platform !== 'win32') {
        child_process.execSync("cargo install --version 0.20.2 --locked cargo-xwin", { stdio: 'inherit', cwd: __dirname });
    }
}

if (!crossPlatform && !target) {
    console.log(`Building native modules in ${mode} mode for the native architecture`);
    buildNapiModule(false, mode === "release");
    buildProxyBin(false, mode === "release");
    buildImporterBinaries(false, mode === "release");
    buildProcessIsolation();
    return;
}

if (target) {
    console.log(`Building for target: ${target} in ${mode} mode`);
    installTarget(target);
    buildNapiModule(target, isRelease);
    buildProxyBin(target, isRelease);
    buildImporterBinaries(target, isRelease);
    buildProcessIsolation();
    return;
}

// Filter the targets based on the current platform, and build for each of them
let platformTargets = Object.entries(rustTargetsMap).filter(([_, { platform: p }]) => p === process.platform);
console.log("Cross building native modules for the targets: ", platformTargets.map(([target, _]) => target).join(", "));

// When building for Linux, we need to set some environment variables to allow cross-compilation
if (process.platform === "linux") {
    process.env["PKG_CONFIG_ALLOW_CROSS"] = "1";
    process.env["PKG_CONFIG_ALL_STATIC"] = "1";
}

platformTargets.forEach(([target, _]) => {
    installTarget(target);
    buildNapiModule(target, isRelease);
    buildProxyBin(target, isRelease);
    buildImporterBinaries(target, isRelease);
    buildProcessIsolation();
});
