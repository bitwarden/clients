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

/**
 * Execute a command.
 * @param {string} bin Executable to run.
 * @param {string[]} args Arguments for executable.
 * @param {string} [workingDirectory] Path to working directory, relative to the script directory. Defaults to the script directory.
 * @param {string} [useShell] Whether to use a shell to execute the command. Defaults to false.
 */
function runCommand(bin, args, workingDirectory = "", useShell = false) {
    const options = { stdio: 'inherit', cwd: path.resolve(__dirname, workingDirectory), shell: useShell }
    console.debug("Running command:", bin, args, options)
    child_process.execFileSync(bin, args, options)
}

function buildNapiModule(target, release = true) {
    const targetArg = target ? `--target=${target}` : "";
    const releaseArg = release ? "--release" : "";
    const crossCompileArg = effectivePlatform(target) !== process.platform ? "--cross-compile" : "";
    runCommand("npm", ["run", "build", "--", crossCompileArg, releaseArg, targetArg].filter(s => s != ''), "./napi", true);
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
    const targetArg = target ? `--target=${target}` : "";
    const releaseArg = release ? "--release" : "";
    const args = ["build", "--bin", bin, releaseArg, targetArg]
    // Use cross-compilation helper if necessary
    if (effectivePlatform(target) === "win32" && process.platform !== "win32") {
        args.unshift("xwin")
    }
    runCommand("cargo", args.filter(s => s != ''))

    // Infer the architecture and platform if not passed explicitly
    let nodeArch, platform;
    if (target) {
        nodeArch = rustTargetsMap[target].nodeArch;
        platform = rustTargetsMap[target].platform;
    }
    else {
        nodeArch = process.arch;
        platform = process.platform;
    }

    // Copy the resulting binary to the dist folder
    const profileFolder = isRelease ? "release" : "debug";
    const ext = platform === "win32" ? ".exe" : "";
    const src = path.join(__dirname, "target", target ? target : "", profileFolder, `${bin}${ext}`)
    const dst = path.join(__dirname, "dist", `${bin}.${platform}-${nodeArch}${ext}`)
    console.log(`Copying ${src} to ${dst}`);
    fs.copyFileSync(src, dst);
}

function buildProxyBin(target, release = true) {
    cargoBuild("desktop_proxy", target, release)
}

function buildImporterBinaries(target, release = true) {
    // These binaries are only built for Windows, so we can skip them on other platforms
    if (effectivePlatform(target) == "win32") {
        cargoBuild("bitwarden_chromium_import_helper", target, release)
    }
}

function buildShellExtension(target, release = true) {
    // The shell extension DLL is only built for Windows
    if (effectivePlatform(target) !== "win32") {
        return;
    }

    const targetArg = target ? `--target=${target}` : "";
    const releaseArg = release ? "--release" : "";
    const args = ["build", "--package", "windows_shell_extension", releaseArg, targetArg].filter(s => s != "");

    // Use cross-compilation helper if necessary
    if (process.platform !== "win32") {
        args.unshift("xwin");
    }

    runCommand("cargo", args);

    // Copy the resulting DLL to the dist folder
    const profileFolder = release ? "release" : "debug";
    const src = path.join(__dirname, "target", target ? target : "", profileFolder, "bitwarden_windows_shell_extension.dll");
    const dst = path.join(__dirname, "dist", "bitwarden_windows_shell_extension.dll");
    console.log(`Copying ${src} to ${dst}`);
    fs.copyFileSync(src, dst);
}

function buildSparsePackage(target) {
    // The sparse MSIX package is only needed on Windows
    if (effectivePlatform(target) !== "win32") {
        return;
    }

    // Map target to MSIX architecture name
    let arch;
    if (target) {
        const nodeArch = rustTargetsMap[target].nodeArch;
        arch = nodeArch === "ia32" ? "x86" : nodeArch;
    } else {
        arch = process.arch === "ia32" ? "x86" : process.arch;
    }

    // Read version from the desktop package.json and append .0 for the four-part MSIX version
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "package.json"), "utf8"));
    const version = packageJson.version + ".0";

    // For local/dev builds use a self-signed placeholder publisher; CI overrides via environment variable
    const publisher = process.env.SPARSE_PACKAGE_PUBLISHER || "CN=Bitwarden, O=Bitwarden Inc., L=Santa Barbara, S=California, C=US";

    const scriptPath = path.join(__dirname, "..", "scripts", "build-sparse-package.ps1");

    console.log(`Building sparse MSIX package (arch=${arch}, version=${version})`);
    runCommand("powershell", ["-ExecutionPolicy", "Bypass", "-File", scriptPath, "-Arch", arch, "-Version", version, "-Publisher", publisher]);
}

function buildProcessIsolation() {
    if (process.platform !== "linux") {
        return;
    }

    runCommand("cargo", ["build", "--package", "process_isolation", "--release"]);

    console.log("Copying process isolation library to dist folder");
    fs.copyFileSync(path.join(__dirname, "target", "release", "libprocess_isolation.so"), path.join(__dirname, "dist", `libprocess_isolation.so`));
}

function installTarget(target) {
    runCommand("rustup", ["target", "add", target]);
    // Install cargo-xwin for cross-platform builds targeting Windows
    if (target.includes('windows') && process.platform !== 'win32') {
        runCommand("cargo", ["install", "--version", "0.20.2", "--locked", "cargo-xwin"]);
        // install tools needed for packaging Appx, only supported on macOS for now.
        if (process.platform === "darwin") {
            runCommand("brew", ["install", "iinuwa/msix-packaging-tap/msix-packaging", "osslsigncode"]);
        }
    }
}

function effectivePlatform(target) {
    if (target) {
        return rustTargetsMap[target].platform
    }
    return process.platform
}

if (!crossPlatform && !target) {
    console.log(`Building native modules in ${mode} mode for the native architecture`);
    buildNapiModule(false, mode === "release");
    buildProxyBin(false, mode === "release");
    buildImporterBinaries(false, mode === "release");
    buildShellExtension(false, mode === "release");
    buildSparsePackage(false);
    buildProcessIsolation();
    return;
}

if (target) {
    console.log(`Building for target: ${target} in ${mode} mode`);
    installTarget(target);
    buildNapiModule(target, isRelease);
    buildProxyBin(target, isRelease);
    buildImporterBinaries(target, isRelease);
    buildShellExtension(target, isRelease);
    buildSparsePackage(target);
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
    buildShellExtension(target, isRelease);
    buildSparsePackage(target);
    buildProcessIsolation();
});
