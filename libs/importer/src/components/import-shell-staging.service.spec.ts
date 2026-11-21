import { TestBed } from "@angular/core/testing";

import { ImportResult } from "../models/import-result";

import { ImportShellStagingService } from "./import-shell-staging.service";

describe("ImportShellStagingService", () => {
  it("clears what was staged when the injector providing it is destroyed", () => {
    TestBed.configureTestingModule({ providers: [ImportShellStagingService] });
    const sut = TestBed.inject(ImportShellStagingService);
    sut.stage({ kind: "parsed", importType: "bitwarden", result: new ImportResult() });

    TestBed.resetTestingModule();

    expect(sut.current()).toBeUndefined();
  });

  it("zeroes an import returned to the file step that nobody took when it is destroyed", () => {
    TestBed.configureTestingModule({ providers: [ImportShellStagingService] });
    const sut = TestBed.inject(ImportShellStagingService);
    const bytes = Uint8Array.from([1, 2]);
    sut.returnToFileStep({
      format: "keepasskdbx",
      file: { name: "db.kdbx", bytes },
      password: "pw",
      keyFile: null,
      error: { field: "file", messageKey: "importFileStructureInvalid" },
    });

    TestBed.resetTestingModule();

    expect(Array.from(bytes)).toEqual([0, 0]);
    expect(sut.takeFileStepReturn()).toBeUndefined();
  });
});
