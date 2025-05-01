import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BrowserViewPasswordHistoryService } from "./browser-view-password-history.service";

describe("BrowserViewPasswordHistoryService", () => {
  let service: BrowserViewPasswordHistoryService;
  let router: MockProxy<Router>;

  beforeEach(async () => {
    router = mock<Router>();
    await TestBed.configureTestingModule({
      providers: [BrowserViewPasswordHistoryService, { provide: Router, useValue: router }],
    }).compileComponents();

    service = TestBed.inject(BrowserViewPasswordHistoryService);
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
