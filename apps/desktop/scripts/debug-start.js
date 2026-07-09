/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

const concurrently = require("concurrently");
const rimraf = require("rimraf");

const args = process.argv.splice(2);

const debugDir = path.resolve(__dirname, "../../..", ".debug");

process.env.BITWARDEN_APPDATA_DIR = path.join(debugDir, "electron-data-dir");
process.env.BITWARDEN_SSH_AUTH_SOCK = path.join(debugDir, ".bitwarden-ssh-agent.sock");
process.env.BITWARDEN_CHROME_PROFILE_DIR = path.join(debugDir, "chrome-profile");
process.env.BITWARDEN_IPC_SOCKET_DIR = debugDir;
process.env.USE_AUTOMATION_BIOMETRICS = "true";

rimraf.sync("build");

concurrently(
  [
    {
      name: "Main",
      command: "npm run build:main:watch",
      prefixColor: "yellow",
    },
    {
      name: "Prel",
      command: "npm run build:preload:watch",
      prefixColor: "magenta",
    },
    {
      name: "Rend",
      command: "npm run build:renderer:watch",
      prefixColor: "cyan",
    },
    {
      name: "Elec",
      command: `npx wait-on ./build/main.js ./build/index.html ./build/app/main.js && npx electron --no-sandbox --inspect=5858 --remote-debugging-port=9222 ${args.join(
        " ",
      )} ./build --watch`,
      prefixColor: "green",
    },
  ],
  {
    prefix: "name",
    outputStream: process.stdout,
    killOthersOn: ["success", "failure"],
  },
);
