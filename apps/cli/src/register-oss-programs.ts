import { Program } from "./program";
import { ServiceContainer } from "./service-container/service-container";
import { SendProgram } from "./tools/send/send.program";
import { VaultProgram } from "./vault.program";

/**
 * All OSS licensed programs should be registered here.
 * @example
 * const myProgram = new myProgram(serviceContainer);
 * myProgram.register();
 * @param serviceContainer A class that instantiates services and makes them available for dependency injection
 */
export async function registerOssPrograms(serviceContainer: ServiceContainer) {
  const program = new Program(serviceContainer);
  await program.register();

  const vaultProgram = new VaultProgram(serviceContainer);
  vaultProgram.register();

  const sendProgram = new SendProgram(serviceContainer);
  sendProgram.register();
}
