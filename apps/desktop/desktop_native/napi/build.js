/* eslint-disable @typescript-eslint/no-var-requires */
const child_process = require("child_process");
const process = require("process");

let targets = [];
switch (process.platform) {
    case "win32":
        targets = ["i686-pc-windows-msvc", "x86_64-pc-windows-msvc", "aarch64-pc-windows-msvc"];
    break;

    case "darwin":
        targets = ["x86_64-apple-darwin", "aarch64-apple-darwin"];
    break;

    default:
        targets = ['x86_64-unknown-linux-musl'];
        process.env["PKG_CONFIG_ALLOW_CROSS"] = "1";
        process.env["PKG_CONFIG_ALL_STATIC"] = "1";
    break;
}

targets.forEach(target => {
    child_process.execSync(`npm run build -- --target ${target}`, {stdio: 'inherit'});
});
