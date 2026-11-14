import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/process-reload";

/**
 * The {@link ProcessReloadServiceAbstraction} implementation for the Electron main process.
 * The implementation is no-op.
 */
export class MainProcessReloadService extends ProcessReloadServiceAbstraction {
  async reloadProcess(): Promise<void> {}
}
