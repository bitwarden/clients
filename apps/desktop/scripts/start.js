/* eslint-disable @typescript-eslint/no-require-imports */
const { exec } = require("node:child_process");

const concurrently = require("concurrently");
const rimraf = require("rimraf");

const BUILD_MAGNIFY = "nx run desktop:build-magnify";
const BUILD_MAGNIFY_PRELOAD = "nx run desktop:build-magnify-preload";
const BUILD_MAGNIFY_DEV_CONFIG_FLAG = "--configuration=development";

const args = process.argv.splice(2);

rimraf.sync("build");

function buildMagnify() {
  const command = [BUILD_MAGNIFY, BUILD_MAGNIFY_DEV_CONFIG_FLAG];

  return new Promise((resolve, reject) => {
    exec(command.join(" "), (err, output) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error("Could not build Magnify: ", err);
        reject(err);
        return;
      }

      // eslint-disable-next-line no-console
      console.log("Magnify built successfully: \n", output);
      resolve();
    });
  });
}

function buildMagnifyPreload() {
  const command = [BUILD_MAGNIFY_PRELOAD, BUILD_MAGNIFY_DEV_CONFIG_FLAG];

  return new Promise((resolve, reject) => {
    exec(command.join(" "), (err, output) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error("Could not build Magnify preload: ", err);
        reject(err);
        return;
      }

      // eslint-disable-next-line no-console
      console.log("Magnify preload built successfully: \n", output);
      resolve();
    });
  });
}

Promise.all([buildMagnify(), buildMagnifyPreload()])
  .then(() => {
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
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Could not start: ", err);
    process.exit(1);
  });
