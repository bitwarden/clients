import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from "@angular/router";
import { mock } from "jest-mock-extended";

import { devFlagEnabled } from "../../../platform/flags";

import { autofillToolsDevFlagGuard } from "./autofill-tools.guard";

jest.mock("../../../platform/flags", () => ({
  ...jest.requireActual("../../../platform/flags"),
  devFlagEnabled: jest.fn(),
}));

const mockDevFlagEnabled = devFlagEnabled as jest.Mock;

describe("autofillToolsDevFlagGuard", () => {
  const router = mock<Router>();
  const urlTree = {} as UrlTree;

  beforeEach(() => {
    jest.clearAllMocks();
    router.createUrlTree.mockReturnValue(urlTree);
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }],
    });
  });

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      autofillToolsDevFlagGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it("allows activation when the fillAssistDevTools dev flag is enabled", () => {
    mockDevFlagEnabled.mockReturnValue(true);

    expect(runGuard()).toBe(true);
    expect(mockDevFlagEnabled).toHaveBeenCalledWith("fillAssistDevTools");
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it("redirects to the vault when the dev flag is disabled", () => {
    mockDevFlagEnabled.mockReturnValue(false);

    expect(runGuard()).toBe(urlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(["/tabs/vault"]);
  });
});
