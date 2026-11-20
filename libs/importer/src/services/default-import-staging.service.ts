import { BehaviorSubject, Observable } from "rxjs";

import {
  ImportStagingServiceAbstraction,
  StagedImport,
} from "./import-staging.service.abstraction";

export class DefaultImportStagingService implements ImportStagingServiceAbstraction {
  private readonly stagedSubject = new BehaviorSubject<StagedImport | undefined>(undefined);

  readonly staged$: Observable<StagedImport | undefined> = this.stagedSubject.asObservable();

  current(): StagedImport | undefined {
    return this.stagedSubject.value;
  }

  stage(staged: StagedImport): void {
    this.clear();
    this.stagedSubject.next(staged);
  }

  clear(): void {
    const staged = this.stagedSubject.value;
    if (staged?.kind === "sdk") {
      staged.file.fill(0);
      if (staged.credentials.kind === "passwordWithKeyFile") {
        staged.credentials.keyFile?.fill(0);
      }
    }
    this.stagedSubject.next(undefined);
  }
}
