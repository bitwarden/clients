import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogRef, DialogService } from "@bitwarden/components";

import {
  UnifiedUpgradeDialogResult,
  UnifiedUpgradeDialogStatus,
} from "../../unified-upgrade-dialog/unified-upgrade-dialog.component";

import { UpgradeNavButtonComponent } from "./upgrade-nav-button.component";

describe("UpgradeNavButtonComponent", () => {
  let component: UpgradeNavButtonComponent;
  let fixture: ComponentFixture<UpgradeNavButtonComponent>;
  let mockDialogService: MockProxy<DialogService>;
  let mockAccountService: MockProxy<AccountService>;
  let mockSyncService: MockProxy<SyncService>;
  let mockApiService: MockProxy<ApiService>;
  let mockRouter: MockProxy<Router>;
  let mockI18nService: MockProxy<I18nService>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;
  let activeAccount$: BehaviorSubject<Account | null>;

  const mockAccount: Account = {
    id: "user-id" as UserId,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
  };

  beforeEach(async () => {
    mockDialogService = mock<DialogService>();
    mockAccountService = mock<AccountService>();
    mockSyncService = mock<SyncService>();
    mockApiService = mock<ApiService>();
    mockRouter = mock<Router>();
    mockI18nService = mock<I18nService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();

    activeAccount$ = new BehaviorSubject<Account | null>(mockAccount);
    mockAccountService.activeAccount$ = activeAccount$;
    mockI18nService.t.mockImplementation((key) => key);
    mockPlatformUtilsService.isSelfHost.mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [UpgradeNavButtonComponent],
      providers: [
        { provide: DialogService, useValue: mockDialogService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: SyncService, useValue: mockSyncService },
        { provide: ApiService, useValue: mockApiService },
        { provide: Router, useValue: mockRouter },
        { provide: I18nService, useValue: mockI18nService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UpgradeNavButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("upgrade()", () => {
    describe("when self-hosted", () => {
      beforeEach(() => {
        mockPlatformUtilsService.isSelfHost.mockReturnValue(true);
      });

      it("should navigate to subscription page", async () => {
        await component.upgrade();

        expect(mockRouter.navigate).toHaveBeenCalledWith(["/settings/subscription/premium"]);
        expect(mockDialogService.open).not.toHaveBeenCalled();
      });
    });

    describe("when not self-hosted", () => {
      beforeEach(() => {
        mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      });

      it("should return early if no active account exists", async () => {
        activeAccount$.next(null);

        await component.upgrade();

        expect(mockDialogService.open).not.toHaveBeenCalled();
      });

      it("should open upgrade dialog with correct configuration", async () => {
        const mockDialogRef = mock<DialogRef<UnifiedUpgradeDialogResult>>();
        mockDialogRef.closed = of({ status: UnifiedUpgradeDialogStatus.Closed });
        mockDialogService.open.mockReturnValue(mockDialogRef);

        await component.upgrade();

        expect(mockDialogService.open).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: {
              account: mockAccount,
              planSelectionStepTitleOverride: "upgradeYourPlan",
              hideContinueWithoutUpgradingButton: true,
            },
          }),
        );
      });

      it("should full sync after upgrading to premium", async () => {
        const mockDialogRef = mock<DialogRef<UnifiedUpgradeDialogResult>>();
        mockDialogRef.closed = of({ status: UnifiedUpgradeDialogStatus.UpgradedToPremium });
        mockDialogService.open.mockReturnValue(mockDialogRef);

        await component.upgrade();

        expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
      });

      it("should navigate to organization vault after upgrading to families", async () => {
        const organizationId = "org-123";
        const mockDialogRef = mock<DialogRef<UnifiedUpgradeDialogResult>>();
        mockDialogRef.closed = of({
          status: UnifiedUpgradeDialogStatus.UpgradedToFamilies,
          organizationId,
        });
        mockDialogService.open.mockReturnValue(mockDialogRef);

        await component.upgrade();

        expect(mockRouter.navigate).toHaveBeenCalledWith([
          `/organizations/${organizationId}/vault`,
        ]);
      });

      it("should do nothing when dialog closes without upgrade", async () => {
        const mockDialogRef = mock<DialogRef<UnifiedUpgradeDialogResult>>();
        mockDialogRef.closed = of({ status: UnifiedUpgradeDialogStatus.Closed });
        mockDialogService.open.mockReturnValue(mockDialogRef);

        await component.upgrade();

        expect(mockApiService.refreshIdentityToken).not.toHaveBeenCalled();
        expect(mockSyncService.fullSync).not.toHaveBeenCalled();
        expect(mockRouter.navigate).not.toHaveBeenCalled();
      });
    });
  });
});
