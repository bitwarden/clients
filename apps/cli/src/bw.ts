import "core-js/proposals/explicit-resource-management";

import { program } from "commander";

import { OssServeConfigurator } from "./oss-serve-configurator";
import { registerOssPrograms } from "./register-oss-programs";
import { ServeProgram } from "./serve.program";
import { ServiceContainer } from "./service-container/service-container";

async function main() {
  const serviceContainer = new ServiceContainer();
  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    serviceContainer.dispose();
  };

  // Some existing command guards call process.exit(), which does not unwind
  // through finally. Ensure Desktop IPC is also closed on those paths.
  process.once("exit", dispose);

  try {
    await serviceContainer.init();

    await registerOssPrograms(serviceContainer);

    // ServeProgram is registered separately so it can be overridden by bit-cli
    const serveConfigurator = new OssServeConfigurator(serviceContainer);
    new ServeProgram(serviceContainer, serveConfigurator).register();

    await program.parseAsync(process.argv);
  } finally {
    process.removeListener("exit", dispose);
    dispose();
  }
}

// Node does not support top-level await statements until ES2022, esnext, etc which we don't use yet
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
