import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";

/**
 * CLI implementation of ProcessReloadServiceAbstraction.
 * This is NOOP since there is no effective way to process reload the CLI.
 */
export class CliProcessReloadService extends ProcessReloadServiceAbstraction {
  async startProcessReload(): Promise<void> {}
  async cancelProcessReload(): Promise<void> {}
}
