/* eslint-disable @typescript-eslint/no-require-imports */
const concurrently = require("concurrently");
const rimraf = require("rimraf");

const args = process.argv.splice(2);

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
      command: `npx wait-on ./build/main.js && npx electron ${process.env.SANDBOX_BUILD ? "" : "--no-sandbox "}--inspect=5858 ${args.join(
        " ",
      )} ./build --watch`,
      prefixColor: "green",
    },
  ],
  {
    prefix: "name",
    outputStream: process.stdout,
    killOthers: ["success", "failure"],
  },
);
