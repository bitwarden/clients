import "core-js/proposals/explicit-resource-management";

import { program } from "commander";

import { applyEarlyProcessEnvFlags } from "@bitwarden/cli/bw";
import { registerOssPrograms } from "@bitwarden/cli/register-oss-programs";
import { ServeProgram } from "@bitwarden/cli/serve.program";

import { BitServeConfigurator } from "./bit-serve-configurator";
import { registerBitPrograms } from "./register-bit-programs";
import { ServiceContainer } from "./service-container";

async function main() {
  applyEarlyProcessEnvFlags(process.argv.slice(2));

  const serviceContainer = new ServiceContainer();
  await serviceContainer.init();

  await registerOssPrograms(serviceContainer);
  await registerBitPrograms(serviceContainer);

  const serveConfigurator = new BitServeConfigurator(serviceContainer);
  new ServeProgram(serviceContainer, serveConfigurator).register();

  program.parse(process.argv);
}

// Node does not support top-level await statements until ES2022, esnext, etc which we don't use yet
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
