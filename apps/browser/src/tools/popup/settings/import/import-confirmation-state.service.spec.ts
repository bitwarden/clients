import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";

import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { GlobalStateProvider } from "@bitwarden/state";

import {
  ImportConfirmationState,
  ImportConfirmationStateService,
} from "./import-confirmation-state.service";

describe("ImportConfirmationStateService", () => {
  const result: ImportConfirmationState = {
    summary: { total: 3, rows: [{ icon: "globe", labelKey: "typeLogin", count: 3 }] },
    importedFile: { name: "export.csv" },
  };

  let service: ImportConfirmationStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() }],
    });
    service = TestBed.inject(ImportConfirmationStateService);
  });

  it("has nothing for this tab or the popup to start with", async () => {
    expect(service.current()).toBeUndefined();
    expect(await firstValueFrom(service.pending$)).toBeNull();
  });

  it("keeps a result for this tab and for the popup", async () => {
    await service.set(result);

    expect(service.current()).toEqual(result);
    expect(await firstValueFrom(service.pending$)).toEqual(result);
  });

  it("drops only this tab's copy on clear, so the popup still has its result to show", async () => {
    await service.set(result);

    service.clear();

    expect(service.current()).toBeUndefined();
    expect(await firstValueFrom(service.pending$)).toEqual(result);
  });

  it("drops the popup's copy on clearPending, and leaves this tab's", async () => {
    await service.set(result);

    await service.clearPending();

    expect(await firstValueFrom(service.pending$)).toBeNull();
    expect(service.current()).toEqual(result);
  });
});
