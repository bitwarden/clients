export abstract class ProcessReloadServiceAbstraction {
  abstract startProcessReload(): Promise<void>;
  abstract cancelProcessReload(): void;
}
