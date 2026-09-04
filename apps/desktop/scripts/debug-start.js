/* eslint-disable @typescript-eslint/no-require-imports */

////
// Same watch + Electron pipeline as start.js, but state is isolated in `.debug`
// so it does not interfere with the host system's bitwarden desktop installation.
//
//   .debug/desktop-profile/           app data (vault, settings, logs)
//   .debug/chrome-profile/            native messaging manifest for the debug browser
//   .debug/.bitwarden-ssh-agent.sock  SSH agent socket
//   .debug/s.<name>                   IPC sockets
////

const { execFileSync } = require("child_process");
const path = require("path");

const concurrently = require("concurrently");
// Absolute path to the Electron binary, so it can be `exec`d directly (see the Elec command).
const electronBinary = require("electron");
const rimraf = require("rimraf");

const args = process.argv.splice(2);

const DEBUG_DIR = path.resolve(__dirname, "../../..", ".debug");

process.env.BITWARDEN_APPDATA_DIR = path.join(DEBUG_DIR, "desktop-profile");
process.env.BITWARDEN_CHROME_PROFILE_DIR = path.join(DEBUG_DIR, "chrome-profile");
process.env.BITWARDEN_SSH_AUTH_SOCK = path.join(DEBUG_DIR, ".bitwarden-ssh-agent.sock");
process.env.BITWARDEN_IPC_SOCKET_DIR = DEBUG_DIR;

process.env.NODE_ENV = "development";

const INSPECT_FLAG = "--inspect=5858";

const WEBPACK = path.resolve(__dirname, "../../../node_modules/.bin/webpack");

// `exec` replaces the shell with the child, so kill signals reach the child itself instead of a
// wrapper that leaves an orphan behind. cmd.exe has no equivalent, but concurrently reaps the
// whole tree there via `taskkill /F /T`.
const EXEC = process.platform === "win32" ? "" : "exec ";

function watchCommand(configName) {
  return `${EXEC}"${WEBPACK}" --config webpack.config.js --config-name ${configName} --watch`;
}

function killStrayClients() {
  try {
    // Match this checkout's Electron binary, so a plain `npm run electron` session running
    // against the real app data dir is left alone.
    execFileSync("pkill", ["-9", "-f", `${electronBinary}.*${INSPECT_FLAG}`]);
  } catch {
    // pkill exits non-zero when nothing matched, and does not exist on Windows.
  }
}

killStrayClients();
process.on("exit", killStrayClients);

rimraf.sync("build");

const { commands } = concurrently(
  [
    {
      name: "Main",
      command: `npm run build-native && ${watchCommand("main")}`,
      prefixColor: "yellow",
    },
    {
      name: "Prel",
      command: watchCommand("preload"),
      prefixColor: "magenta",
    },
    {
      name: "Rend",
      command: watchCommand("renderer"),
      prefixColor: "cyan",
    },
    {
      name: "Elec",
      command: `npx wait-on ./build/main.js ./build/index.html ./build/app/main.js && ${EXEC}"${electronBinary}" --no-sandbox ${INSPECT_FLAG} --remote-debugging-port=9222 ${args.join(
        " ",
      )} ./build`,
      prefixColor: "green",
    },
  ],
  {
    prefix: "name",
    outputStream: process.stdout,
    killOthersOn: ["success", "failure"],
    // Electron ignores SIGINT/SIGTERM here (tray + quit handlers keep it alive), which left an
    // orphan client running after Ctrl+C. Nothing in a debug run needs a graceful shutdown.
    killSignal: "SIGKILL",
  },
);

// Ctrl+C: reap the whole pipeline before leaving. Electron ignores the terminal's SIGINT, and the
// watchers only see it when they share the terminal's process group.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    commands.forEach((command) => command.kill("SIGKILL"));
    killStrayClients();
    process.exit(0);
  });
}
