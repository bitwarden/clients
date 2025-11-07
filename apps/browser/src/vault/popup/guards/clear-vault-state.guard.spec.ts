import { TestBed } from "@angular/core/testing";
import { RouterStateSnapshot } from "@angular/router";

import { VaultV2Component } from "../components/vault-v2/vault-v2.component";
import { VaultPopupItemsService } from "../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../services/vault-popup-list-filters.service";

import { clearVaultStateGuard } from "./clear-vault-state.guard";

describe("clearVaultStateGuard", () => {
  let applyFilterSpy: jest.Mock;
  let resetFilterFormSpy: jest.Mock;

  beforeEach(() => {
    applyFilterSpy = jest.fn();
    resetFilterFormSpy = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: VaultPopupItemsService,
          useValue: { applyFilter: applyFilterSpy },
        },
        {
          provide: VaultPopupListFiltersService,
          useValue: { resetFilterForm: resetFilterFormSpy },
        },
      ],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    "/view-cipher?cipherId=123",
    "/edit-cipher?cipherId=123",
    "/clone-cipher?cipherId=123",
    "/assign-collections?cipherId=123",
  ])("should not clear vault state when viewing or editing a cipher: %s", (url) => {
    const nextState = { url } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() =>
      clearVaultStateGuard({} as VaultV2Component, null, null, nextState),
    );

    expect(result).toBe(true);
    expect(applyFilterSpy).not.toHaveBeenCalled();
    expect(resetFilterFormSpy).not.toHaveBeenCalled();
  });

  it.each(["/settings", "/tabs/settings"])(
    "should clear vault state when navigating to non-cipher routes: %s",
    (url) => {
      const nextState = { url } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() =>
        clearVaultStateGuard({} as VaultV2Component, null, null, nextState),
      );

      expect(result).toBe(true);
      expect(applyFilterSpy).toHaveBeenCalledWith("");
      expect(resetFilterFormSpy).toHaveBeenCalled();
    },
  );

  it("should not clear vault state when not changing states", () => {
    const result = TestBed.runInInjectionContext(() =>
      clearVaultStateGuard({} as VaultV2Component, null, null, null),
    );

    expect(result).toBe(true);
    expect(applyFilterSpy).not.toHaveBeenCalled();
    expect(resetFilterFormSpy).not.toHaveBeenCalled();
  });
});
