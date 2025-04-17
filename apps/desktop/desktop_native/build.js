/* eslint-disable @typescript-eslint/no-var-requires */
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const process = require("process");
const args = process.argv.slice(2); // Get arguments passed to the script
const mode = args.includes("--release") ? "release" : "debug";
const targetArg = args.find(arg => arg.startsWith("--target="));
const target = targetArg ? targetArg.split("=")[1] : null;

let crossPlatform = process.argv.length > 2 && process.argv[2] === "cross-platform";

function buildNapiModule(target, release = true) {
    const targetArg = target ? `--target ${target}` : "";
    const releaseArg = release ? "--release" : "";
    return child_process.execSync(`npm run build -- ${releaseArg} ${targetArg}`, { stdio: 'inherit', cwd: path.join(__dirname, "napi") });
}

function buildProxyBin(target, release = true) {
    const targetArg = target ? `--target ${target}` : "";
    const releaseArg = release ? "--release" : "";
    return child_process.execSync(`cargo build --bin desktop_proxy ${releaseArg} ${targetArg}`, {stdio: 'inherit', cwd: path.join(__dirname, "proxy")});
}

if (!crossPlatform && !target) {
    console.log(`Building native modules in ${mode} mode for the native architecture`);
    buildNapiModule(false, mode === "release");
    buildProxyBin(false, mode === "release");
    return;
}

if (target) {
    console.log(`Building for target: ${target} in ${mode} mode`);
    buildNapiModule(target, mode === "release");
    buildProxyBin(target, mode === "release");
    return;
}

// Note that targets contains pairs of [rust target, node arch]
// We do this to move the output binaries to a location that can
// be easily accessed from electron-builder using ${os} and ${arch}
let targets = [];
switch (process.platform) {
    case "win32":
        targets = [
            ["i686-pc-windows-msvc", 'ia32'],
            ["x86_64-pc-windows-msvc", 'x64'],
            ["aarch64-pc-windows-msvc", 'arm64']
        ];
    break;

    case "darwin":
        targets = [
            ["x86_64-apple-darwin", 'x64'],
            ["aarch64-apple-darwin", 'arm64']
        ];
    break;

    default:
        targets = [
            ['x86_64-unknown-linux-musl', 'x64'],
            ['aarch64-unknown-linux-musl', 'arm64']
        ];

        process.env["PKG_CONFIG_ALLOW_CROSS"] = "1";
        process.env["PKG_CONFIG_ALL_STATIC"] = "1";
    break;
}

console.log("Cross building native modules for the targets: ", targets.map(([target, _]) => target).join(", "));

fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });

targets.forEach(([target, nodeArch]) => {
    buildNapiModule(target);
    buildProxyBin(target);

    const ext = process.platform === "win32" ? ".exe" : "";
    fs.copyFileSync(path.join(__dirname, "target", target, "release", `desktop_proxy${ext}`), path.join(__dirname, "dist", `desktop_proxy.${process.platform}-${nodeArch}${ext}`));
});
