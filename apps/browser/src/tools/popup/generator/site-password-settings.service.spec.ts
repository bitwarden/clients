import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CredentialGeneratorService } from "@bitwarden/generator-core";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { sitePasswordSettings } from "../../password-rules/site-password-settings";

import { SitePasswordSettingsService } from "./site-password-settings.service";

jest.mock("../../password-rules/site-password-settings");

describe("SitePasswordSettingsService", () => {
  let service: SitePasswordSettingsService;
  let generatorService: MockProxy<CredentialGeneratorService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    generatorService = mock<CredentialGeneratorService>();
    logService = mock<LogService>();
    TestBed.configureTestingModule({
      providers: [
        SitePasswordSettingsService,
        { provide: CredentialGeneratorService, useValue: generatorService },
        { provide: LogService, useValue: logService },
      ],
    });
    service = TestBed.inject(SitePasswordSettingsService);

    jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(true);
    jest
      .spyOn(BrowserApi, "getTabFromCurrentWindow")
      .mockResolvedValue({ url: "https://example.com/signup" } as chrome.tabs.Tab);
  });

  afterEach(() => jest.restoreAllMocks());

  it("looks up the current tab's website", async () => {
    const site = { website: "example.com", settings: { length: 8 } };
    jest.mocked(sitePasswordSettings).mockResolvedValue(site);

    expect(await service.currentTab()).toBe(site);
    expect(sitePasswordSettings).toHaveBeenCalledWith(
      "https://example.com/signup",
      generatorService,
    );
  });

  it("returns null outside the toolbar popup without reading the tab", async () => {
    jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(false);

    expect(await service.currentTab()).toBeNull();
    expect(BrowserApi.getTabFromCurrentWindow).not.toHaveBeenCalled();
  });

  it("returns null and logs when the lookup fails", async () => {
    const error = new Error("no tab");
    jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockRejectedValue(error);

    expect(await service.currentTab()).toBeNull();
    expect(logService.error).toHaveBeenCalledWith(error);
  });
});
