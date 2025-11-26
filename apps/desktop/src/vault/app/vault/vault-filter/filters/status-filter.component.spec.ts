import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultFilter } from "@bitwarden/angular/vault/vault-filter/models/vault-filter.model";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { StatusFilterComponent } from "./status-filter.component";

describe("StatusFilterComponent", () => {
  let component: StatusFilterComponent;
  let fixture: ComponentFixture<StatusFilterComponent>;
  let cipherArchiveService: jest.Mocked<CipherArchiveService>;
  let accountService: FakeAccountService;

  const mockUserId = Utils.newGuid() as UserId;
  const event = new Event("click");

  beforeEach(async () => {
    accountService = mockAccountServiceWith(mockUserId);
    cipherArchiveService = mock<CipherArchiveService>();

    await TestBed.configureTestingModule({
      declarations: [StatusFilterComponent],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: CipherArchiveService, useValue: cipherArchiveService },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
      imports: [JslibModule, PremiumBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusFilterComponent);
    component = fixture.componentInstance;
    component.activeFilter = new VaultFilter();
    fixture.detectChanges();
  });

  describe("handleArchiveFilter", () => {
    const applyFilter = jest.fn();
    let promptForPremiumSpy: jest.SpyInstance;

    beforeEach(() => {
      applyFilter.mockClear();
      component["applyFilter"] = applyFilter;

      promptForPremiumSpy = jest.spyOn(component["premiumBadgeComponent"]()!, "promptForPremium");
    });

    it("should apply archive filter when userCanArchive returns true", async () => {
      cipherArchiveService.userCanArchive$.mockReturnValue(of(true));
      cipherArchiveService.archivedCiphers$.mockReturnValue(of([]));

      await component["handleArchiveFilter"](event);

      expect(applyFilter).toHaveBeenCalledWith("archive");
      expect(promptForPremiumSpy).not.toHaveBeenCalled();
    });

    it("should apply archive filter when userCanArchive returns false but hasArchivedCiphers is true", async () => {
      const mockCipher = new CipherView();
      mockCipher.id = "test-id";

      cipherArchiveService.userCanArchive$.mockReturnValue(of(false));
      cipherArchiveService.archivedCiphers$.mockReturnValue(of([mockCipher]));

      await component["handleArchiveFilter"](event);

      expect(applyFilter).toHaveBeenCalledWith("archive");
      expect(promptForPremiumSpy).not.toHaveBeenCalled();
    });

    it("should prompt for premium when userCanArchive returns false and hasArchivedCiphers is false", async () => {
      cipherArchiveService.userCanArchive$.mockReturnValue(of(false));
      cipherArchiveService.archivedCiphers$.mockReturnValue(of([]));

      await component["handleArchiveFilter"](event);

      expect(applyFilter).not.toHaveBeenCalled();
      expect(promptForPremiumSpy).toHaveBeenCalled();
    });
  });
});
