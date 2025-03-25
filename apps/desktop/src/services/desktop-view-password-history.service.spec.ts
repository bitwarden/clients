import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { DesktopViewPasswordHistoryService } from "./desktop-view-password-history.service";

describe("DesktopViewPasswordHistoryService", () => {
  let service: DesktopViewPasswordHistoryService;
  let router: MockProxy<Router>;

  beforeEach(async () => {
    router = mock<Router>();
    await TestBed.configureTestingModule({
      providers: [DesktopViewPasswordHistoryService, { provide: Router, useValue: router }],
    }).compileComponents();

    service = TestBed.inject(DesktopViewPasswordHistoryService);
  });

  describe("viewPasswordHistory", () => {
    it("navigates to the password history screen", async () => {
      await service.viewPasswordHistory({ id: "cipher-id" } as CipherView);
      expect(router.navigate).toHaveBeenCalledWith(["/cipher-password-history"], {
        queryParams: { cipherId: "cipher-id" },
      });
    });
  });
});
