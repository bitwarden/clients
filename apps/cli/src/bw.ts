import "core-js/proposals/explicit-resource-management";

import { program } from "commander";

import { OssServeConfigurator } from "./oss-serve-configurator";
import { registerOssPrograms } from "./register-oss-programs";
import { ServeProgram } from "./serve.program";
import { ServiceContainer } from "./service-container/service-container";

async function main() {
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
