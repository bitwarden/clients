import { TestBed } from "@angular/core/testing";

import { ClientType } from "@bitwarden/common/enums";

import { DesktopSsoComponentService } from "./desktop-sso-component.service";

describe("DesktopSsoComponentService", () => {
  let service: DesktopSsoComponentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesktopSsoComponentService],
    });

    service = TestBed.inject(DesktopSsoComponentService);
  });

  it("sets clientId to desktop", () => {
    expect(service.clientId).toBe(ClientType.Desktop);
  });
});
