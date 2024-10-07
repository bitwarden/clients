import { TestBed } from "@angular/core/testing";

import { DefaultLoginComponentService } from "@bitwarden/auth/angular";

import { flagEnabled } from "../../../platform/flags";

import { ExtensionLoginComponentService } from "./extension-login-component.service";

jest.mock("../../../platform/flags", () => ({
  flagEnabled: jest.fn(),
}));

describe("ExtensionLoginComponentService", () => {
  let service: ExtensionLoginComponentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ExtensionLoginComponentService,
        { provide: DefaultLoginComponentService, useClass: ExtensionLoginComponentService },
      ],
    });
    service = TestBed.inject(ExtensionLoginComponentService);
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  it("returns true if showPasswordless flag is enabled", () => {
    (flagEnabled as jest.Mock).mockReturnValue(true);
    expect(service.isLoginViaAuthRequestSupported()).toBe(true);
  });

  it("returns false if showPasswordless flag is disabled", () => {
    (flagEnabled as jest.Mock).mockReturnValue(false);
    expect(service.isLoginViaAuthRequestSupported()).toBeFalsy();
  });
});
