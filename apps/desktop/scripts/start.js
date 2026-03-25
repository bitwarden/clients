/* eslint-disable @typescript-eslint/no-require-imports */
const { exec } = require("node:child_process");

const concurrently = require("concurrently");
const rimraf = require("rimraf");

const args = process.argv.splice(2);

rimraf.sync("build");

exec("nx run desktop:build-magnify --configuration=development", (err, output) => {
  if (err) {
    // eslint-disable-next-line no-console
    console.error("Could not build Magnify: ", err);
    return;
  }

  // eslint-disable-next-line no-console
  console.log("Magnify built successfully: \n", output);
});

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
      command: `npx wait-on ./build/main.js && npx electron --no-sandbox --inspect=5858 ${args.join(
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
