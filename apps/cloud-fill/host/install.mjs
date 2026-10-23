#!/usr/bin/env node
// Registers the native messaging host for the Cloud Fill extension.
//   node install.mjs --extension-id <id> [--browser chrome|chromium|brave|edge]
//                    [--manifest-dir <dir>] [--home <dir>]
//   node install.mjs --uninstall [--browser ...] [--manifest-dir <dir>] [--home <dir>]
// Copies the host and the command line trigger into the home directory (default ~/.cloud-fill),
// writes a wrapper that pins the current node binary, and writes the host manifest, which allows
// only the given extension id to start the host.
import { chmod, copyFile, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST_NAME = "com.bitwarden.cloudfill";
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

function flag(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const MANIFEST_DIRS = {
  chrome: "Library/Application Support/Google/Chrome/NativeMessagingHosts",
  chromium: "Library/Application Support/Chromium/NativeMessagingHosts",
  brave: "Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts",
  edge: "Library/Application Support/Microsoft Edge/NativeMessagingHosts",
};

const browser = flag("--browser") ?? "chrome";
const manifestDir =
  flag("--manifest-dir") ?? join(homedir(), MANIFEST_DIRS[browser] ?? MANIFEST_DIRS.chrome);
const home = flag("--home") ?? join(homedir(), ".cloud-fill");
const manifestPath = join(manifestDir, `${HOST_NAME}.json`);

if (args.includes("--uninstall")) {
  await rm(manifestPath, { force: true });
  await rm(home, { recursive: true, force: true });
  console.log(`removed ${manifestPath} and ${home}`);
  process.exit(0);
}

const extensionId = flag("--extension-id");
if (!/^[a-p]{32}$/.test(extensionId ?? "")) {
  console.error("--extension-id <32 character extension id> is required");
  process.exit(2);
}

const bin = join(home, "bin");
await mkdir(bin, { recursive: true, mode: 0o700 });
await chmod(home, 0o700);
await copyFile(join(here, "cloud-fill-host.mjs"), join(bin, "cloud-fill-host.mjs"));
await copyFile(join(here, "cloud-fill.mjs"), join(bin, "cloud-fill.mjs"));

const node = await realpath(process.execPath);
const wrapper = join(bin, "cloud-fill-host.sh");
await writeFile(
  wrapper,
  `#!/bin/sh\nCLOUD_FILL_HOME="${home}" exec "${node}" "${join(bin, "cloud-fill-host.mjs")}"\n`,
);
await chmod(wrapper, 0o755);

await mkdir(manifestDir, { recursive: true });
await writeFile(
  manifestPath,
  JSON.stringify(
    {
      name: HOST_NAME,
      description: "Bitwarden Cloud Fill host",
      path: wrapper,
      type: "stdio",
      allowed_origins: [`chrome-extension://${extensionId}/`],
    },
    null,
    2,
  ),
);
console.log(`host manifest: ${manifestPath}`);
console.log(`trigger: CLOUD_FILL_HOME="${home}" ${node} ${join(bin, "cloud-fill.mjs")} fill`);
