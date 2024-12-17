import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { WebSsoComponentService } from "./web-sso-component.service";

describe("WebSsoComponentService", () => {
  let service: WebSsoComponentService;
  let i18nService: MockProxy<I18nService>;

  beforeEach(() => {
    i18nService = mock<I18nService>();

    TestBed.configureTestingModule({
      providers: [WebSsoComponentService, { provide: I18nService, useValue: i18nService }],
    });
    service = TestBed.inject(WebSsoComponentService);
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("setDocumentCookies", () => {
    it("sets ssoHandOffMessage cookie with translated message", () => {
      const mockMessage = "Test SSO Message";
      i18nService.t.mockReturnValue(mockMessage);

      service.setDocumentCookies?.();

      expect(document.cookie).toContain(`ssoHandOffMessage=${mockMessage}`);
      expect(i18nService.t).toHaveBeenCalledWith("ssoHandOff");
    });
  });
});
