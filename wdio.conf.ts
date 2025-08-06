import { config as dotenv } from "dotenv";
dotenv();

const app = process.env.APP || "web";

export const config: WebdriverIO.Config = {
  runner: "local",
  specs: [`./test/wdio/${app}/**/*.spec.ts`],
  maxInstances: 1,
  logLevel: "info",
  framework: "mocha",
  autoCompileOpts: {
    tsNodeOpts: {
      transpileOnly: true,
      project: "./wdio/tsconfig.json",
    },
  },
  reporters: [
    "spec",
    ["junit", {
      outputDir: "./",
      outputFileFormat: function(options) {
        return `wdio-junit-results.xml`;
      }
    }]
  ],
  services: [],
  capabilities: [],
};

switch (app) {
  case "web":
    config.services!.push(["chromedriver", {}]);
    config.capabilities = [
      {
        browserName: "chrome",
        "goog:chromeOptions": {
          args: ["--headless", "--disable-gpu"],
        },
      },
    ];
    config.baseUrl = process.env.WEB_URL || "http://localhost:8080";
    break;
  case "browser":
    config.services!.push(["chromedriver", {}]);
    config.capabilities = [
      {
        browserName: "chrome",
        "goog:chromeOptions": {
          args: ["--disable-gpu", `--load-extension=${process.env.EXTENSION_PATH}`],
        },
      },
    ];
    config.baseUrl = "chrome-extension://";
    break;
  case "desktop":
    config.services!.push(["electron", { appPath: process.env.DESKTOP_PATH }]);
    config.capabilities = [{ browserName: "chrome" }];
    break;
  case "cli":
    config.capabilities = [{ browserName: "chrome" }];
    break;
}
