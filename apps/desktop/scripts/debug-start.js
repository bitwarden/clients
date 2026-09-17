/* eslint-disable @typescript-eslint/no-require-imports */

////
// Same watch + Electron pipeline as start.js, but state is isolated in `.debug`
// so it does not interfere with the host system's bitwarden desktop installation.
//
//   .debug/desktop-profile/           app data (vault, settings, logs)
//   .debug/.bitwarden-ssh-agent.sock  SSH agent socket
//   .debug/s.<name>                   IPC sockets
//
// Set NO_BUILD=1 to launch the existing ./build as-is, without the native build, the webpack
// watchers, or the wipe that precedes them.
////

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const concurrently = require("concurrently");
// Absolute path to the Electron binary, so it can be `exec`d directly (see the Elec command).
const electronBinary = require("electron");
const rimraf = require("rimraf");

const args = process.argv.splice(2);

const DEBUG_DIR = path.resolve(__dirname, "../../..", ".debug");

process.env.BITWARDEN_APPDATA_DIR = path.join(DEBUG_DIR, "desktop-profile");
process.env.BITWARDEN_SSH_AUTH_SOCK = path.join(DEBUG_DIR, ".bitwarden-ssh-agent.sock");
process.env.BITWARDEN_IPC_SOCKET_DIR = DEBUG_DIR;

process.env.NODE_ENV = "development";

const INSPECT_FLAG = "--inspect=5858";

// `npm run electron` in this checkout runs the very same Electron binary (electron/cli.js just
// spawns `require("electron")`) with the same debug ports, so neither the binary path nor a port
// can tell the two sessions apart. This marker is what killStrayClients matches on. The main
// process only ever scans argv for known flags, so an extra one is inert.
const DEBUG_MARKER = "--bitwarden-debug-run";

const WEBPACK = path.resolve(__dirname, "../../../node_modules/.bin/webpack");

const NO_BUILD = process.env.NO_BUILD === "1" || process.env.NO_BUILD === "true";
// What the watchers produce, and what Electron is launched against.
const BUILD_ENTRYPOINTS = ["./build/main.js", "./build/index.html", "./build/app/main.js"];

// `exec` replaces the shell with the child, so kill signals reach the child itself instead of a
// wrapper that leaves an orphan behind. cmd.exe has no equivalent, but concurrently reaps the
// whole tree there via `taskkill /F /T`.
const EXEC = process.platform === "win32" ? "" : "exec ";

function watchCommand(configName) {
  return `${EXEC}"${WEBPACK}" --config webpack.config.js --config-name ${configName} --watch`;
}

function killStrayClients() {
  try {
    // Match on the marker, not just the binary: a plain `npm run electron` session runs the
    // same binary against the real app data dir and must be left alone.
    execFileSync("pkill", ["-9", "-f", `${electronBinary}.*${DEBUG_MARKER}`]);
  } catch {
    // pkill exits non-zero when nothing matched, and does not exist on Windows.
  }
}

killStrayClients();
process.on("exit", killStrayClients);

const electronCommand = `${EXEC}"${electronBinary}" --no-sandbox ${INSPECT_FLAG} --remote-debugging-port=9222 ${DEBUG_MARKER} ${args.join(
  " ",
)} ./build`;

const buildCommands = [
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
];

if (NO_BUILD) {
  const missing = BUILD_ENTRYPOINTS.filter((entrypoint) => !fs.existsSync(entrypoint));
  if (missing.length > 0) {
    throw new Error(
      `NO_BUILD is set but ${missing.join(", ")} missing. Run without NO_BUILD once.`,
    );
  }
} else {
  // The watchers rebuild from scratch, so anything left here is stale by definition.
  rimraf.sync("build");
}

const { commands } = concurrently(
  [
    ...(NO_BUILD ? [] : buildCommands),
    {
      name: "Elec",
      // Without the watchers there is nothing to wait for; the build was checked above.
      command: NO_BUILD
        ? electronCommand
        : `npx wait-on ${BUILD_ENTRYPOINTS.join(" ")} && ${electronCommand}`,
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
