/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

const concurrently = require("concurrently");
const rimraf = require("rimraf");
const args = process.argv.splice(2);
const outputPath = path.resolve(__dirname, "../../../dist/apps/desktop");

rimraf.sync(outputPath);
require("fs").mkdirSync(outputPath, { recursive: true });

concurrently(
  [
    {
      name: "Main",
      command: `cross-env NODE_ENV=development OUTPUT_PATH=${outputPath} webpack --config webpack.config.js --config-name main --watch`,
      prefixColor: "yellow",
    },
    {
      name: "Prel",
      command: `cross-env NODE_ENV=development OUTPUT_PATH=${outputPath} webpack --config webpack.config.js --config-name preload --watch`,
      prefixColor: "magenta",
    },
    {
      name: "Rend",
      command: `cross-env NODE_ENV=development OUTPUT_PATH=${outputPath} webpack --config webpack.config.js --config-name renderer --watch`,
      prefixColor: "cyan",
    },
    {
      name: "Elec",
      command: `npx wait-on ${outputPath}/main.js ${outputPath}/index.html && npx electron --no-sandbox --inspect=5858 ${args.join(
        " ",
      )} ${outputPath} --watch`,
      prefixColor: "green",
    },
  ],
  {
    prefix: "name",
    outputStream: process.stdout,
    killOthers: ["success", "failure"],
  },
);
