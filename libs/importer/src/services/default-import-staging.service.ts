import { BehaviorSubject, Observable } from "rxjs";

import {
  FileStepReturn,
  ImportStagingServiceAbstraction,
  StagedImport,
} from "./import-staging.service.abstraction";

export class DefaultImportStagingService implements ImportStagingServiceAbstraction {
  private readonly stagedSubject = new BehaviorSubject<StagedImport | undefined>(undefined);
  private fileStepReturn: FileStepReturn | undefined;

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

  returnToFileStep(state: FileStepReturn): void {
    this.discardFileStepReturn();
    this.fileStepReturn = state;
  }

  takeFileStepReturn(): FileStepReturn | undefined {
    const state = this.fileStepReturn;
    this.fileStepReturn = undefined;
    return state;
  }

  discardFileStepReturn(): void {
    this.fileStepReturn?.file.bytes.fill(0);
    this.fileStepReturn?.keyFile?.bytes.fill(0);
    this.fileStepReturn = undefined;
  }
}
