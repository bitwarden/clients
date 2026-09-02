export abstract class ProcessReloadServiceAbstraction {
  abstract reloadProcess(): Promise<void>;
}
