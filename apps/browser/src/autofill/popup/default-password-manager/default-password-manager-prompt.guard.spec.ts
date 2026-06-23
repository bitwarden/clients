import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { of } from "rxjs";

import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { AutofillBrowserSettingsService } from "../../services/autofill-browser-settings.service";

import { DefaultPasswordManagerPromptGuard } from "./default-password-manager-prompt.guard";
import { DefaultPasswordManagerPromptService } from "./default-password-manager-prompt.service";

describe("DefaultPasswordManagerPromptGuard", () => {
  const mockAutofillBrowserSettingsService = {
    isDefaultPasswordManagerPromptFlowComplete: jest.fn().mockResolvedValue(false),
  };
  const mockDefaultPasswordManagerPromptService = {
    isEnabled: jest.fn().mockResolvedValue(true),
    freshInstallEligible$: of(true),
    promptDismissed$: of(false),
    setPromptDismissed: jest.fn().mockResolvedValue(undefined),
  };
  const createUrlTree = jest.fn();

  beforeEach(() => {
    createUrlTree.mockClear();
    mockDefaultPasswordManagerPromptService.isEnabled.mockResolvedValue(true);
    mockAutofillBrowserSettingsService.isDefaultPasswordManagerPromptFlowComplete.mockResolvedValue(
      false,
    );
    mockDefaultPasswordManagerPromptService.setPromptDismissed.mockClear();
    jest.spyOn(BrowserApi, "getBrowserClientVendor").mockReturnValue(BrowserClientVendors.Chrome);

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        {
          provide: AutofillBrowserSettingsService,
          useValue: mockAutofillBrowserSettingsService,
        },
        {
          provide: DefaultPasswordManagerPromptService,
          useValue: mockDefaultPasswordManagerPromptService,
        },
      ],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return true when the feature flag is disabled", async () => {
    mockDefaultPasswordManagerPromptService.isEnabled.mockResolvedValue(false);

    const result = await TestBed.runInInjectionContext(
      async () => await DefaultPasswordManagerPromptGuard(),
    );
    expect(result).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it("should redirect to default-password-manager-prompt on fresh install", async () => {
    await TestBed.runInInjectionContext(async () => await DefaultPasswordManagerPromptGuard());
    expect(createUrlTree).toHaveBeenCalledWith(["/default-password-manager-prompt"]);
  });

  it("should return true when not a fresh install", async () => {
    TestBed.overrideProvider(DefaultPasswordManagerPromptService, {
      useValue: {
        isEnabled: jest.fn().mockResolvedValue(true),
        freshInstallEligible$: of(false),
        promptDismissed$: of(false),
        setPromptDismissed: jest.fn().mockResolvedValue(undefined),
      },
    });

    const result = await TestBed.runInInjectionContext(
      async () => await DefaultPasswordManagerPromptGuard(),
    );
    expect(result).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it("should dismiss and return true when the continue flow already completed", async () => {
    mockAutofillBrowserSettingsService.isDefaultPasswordManagerPromptFlowComplete.mockResolvedValue(
      true,
    );

    const result = await TestBed.runInInjectionContext(
      async () => await DefaultPasswordManagerPromptGuard(),
    );
    expect(result).toBe(true);
    expect(mockDefaultPasswordManagerPromptService.setPromptDismissed).toHaveBeenCalled();
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it("should return true when prompt is already dismissed", async () => {
    TestBed.overrideProvider(DefaultPasswordManagerPromptService, {
      useValue: {
        isEnabled: jest.fn().mockResolvedValue(true),
        freshInstallEligible$: of(true),
        promptDismissed$: of(true),
        setPromptDismissed: jest.fn().mockResolvedValue(undefined),
      },
    });

    const result = await TestBed.runInInjectionContext(
      async () => await DefaultPasswordManagerPromptGuard(),
    );
    expect(result).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it("should return true when default password manager prompt is not supported", async () => {
    jest.spyOn(BrowserApi, "getBrowserClientVendor").mockReturnValue(BrowserClientVendors.Unknown);

    const result = await TestBed.runInInjectionContext(
      async () => await DefaultPasswordManagerPromptGuard(),
    );
    expect(result).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });
});
