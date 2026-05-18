import "core-js/proposals/explicit-resource-management";

import { program } from "commander";

import { OssServeConfigurator } from "./oss-serve-configurator";
import { registerOssPrograms } from "./register-oss-programs";
import { ServeProgram } from "./serve.program";
import { ServiceContainer } from "./service-container/service-container";

export function applyEarlyProcessEnvFlags(argv: string[]) {
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    switch (arg) {
      case "--pretty":
        process.env.BW_PRETTY = "true";
        break;
      case "--raw":
        process.env.BW_RAW = "true";
        break;
      case "--response":
        process.env.BW_RESPONSE = "true";
        break;
      case "--cleanexit":
        process.env.BW_CLEANEXIT = "true";
        break;
      case "--quiet":
        process.env.BW_QUIET = "true";
        break;
      case "--nointeraction":
        process.env.BW_NOINTERACTION = "true";
        break;
      case "--session":
        if (index + 1 < argv.length) {
          process.env.BW_SESSION = argv[index + 1];
          index++;
        }
        break;
      default:
        if (arg.startsWith("--session=")) {
          process.env.BW_SESSION = arg.slice("--session=".length);
        }
        break;
    }
  }
}

export async function main() {
  applyEarlyProcessEnvFlags(process.argv.slice(2));

  const serviceContainer = new ServiceContainer();
  await serviceContainer.init();

  await registerOssPrograms(serviceContainer);

  // ServeProgram is registered separately so it can be overridden by bit-cli
  const serveConfigurator = new OssServeConfigurator(serviceContainer);
  new ServeProgram(serviceContainer, serveConfigurator).register();

  program.parse(process.argv);
}

// Node does not support top-level await statements until ES2022, esnext, etc which we don't use yet
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
