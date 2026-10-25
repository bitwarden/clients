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
});
