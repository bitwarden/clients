import { ChangeDetectionStrategy, Component, DebugElement, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { NudgesService } from "@bitwarden/angular/vault";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { VaultSettingsV2Component } from "./vault-settings-v2.component";

@Component({
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopupHeaderComponent {
  readonly pageTitle = input<string>();
  readonly showBackButton = input<boolean>();
}

@Component({
  selector: "popup-page",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopupPageComponent {}

@Component({
  selector: "app-pop-out",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopOutComponent {
  readonly show = input(true);
}

describe("VaultSettingsV2Component", () => {
  let component: VaultSettingsV2Component;
  let fixture: ComponentFixture<VaultSettingsV2Component>;
  let router: Router;
  let mockCipherArchiveService: jest.Mocked<CipherArchiveService>;

  const mockActiveAccount$ = new BehaviorSubject<{ id: string }>({
    id: "user-id",
  });
  const mockUserCanArchive$ = new BehaviorSubject<boolean>(false);
  const mockHasArchiveFlagEnabled$ = new BehaviorSubject<boolean>(true);
  const mockArchivedCiphers$ = new BehaviorSubject<CipherView[]>([]);
  const mockShowNudgeBadge$ = new BehaviorSubject<boolean>(false);

  const queryByTestId = (testId: string): DebugElement | null => {
    return fixture.debugElement.query(By.css(`[data-test-id="${testId}"]`));
  };

  const setArchiveState = (
    canArchive: boolean,
    archivedItems: CipherView[] = [],
    flagEnabled = true,
  ) => {
    mockUserCanArchive$.next(canArchive);
    mockArchivedCiphers$.next(archivedItems);
    mockHasArchiveFlagEnabled$.next(flagEnabled);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    mockCipherArchiveService = mock<CipherArchiveService>({
      userCanArchive$: jest.fn().mockReturnValue(mockUserCanArchive$),
      hasArchiveFlagEnabled$: jest.fn().mockReturnValue(mockHasArchiveFlagEnabled$),
      archivedCiphers$: jest.fn().mockReturnValue(mockArchivedCiphers$),
    });

    await TestBed.configureTestingModule({
      imports: [VaultSettingsV2Component],
      providers: [
        provideRouter([
          { path: "archive", component: VaultSettingsV2Component },
          { path: "premium", component: VaultSettingsV2Component },
        ]),
        { provide: SyncService, useValue: mock<SyncService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: CipherArchiveService, useValue: mockCipherArchiveService },
        {
          provide: NudgesService,
          useValue: { showNudgeBadge$: jest.fn().mockReturnValue(mockShowNudgeBadge$) },
        },

        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
        {
          provide: AccountService,
          useValue: { activeAccount$: mockActiveAccount$ },
        },
      ],
    })
      .overrideComponent(VaultSettingsV2Component, {
        remove: {
          imports: [PopupHeaderComponent, PopupPageComponent, PopOutComponent],
        },
        add: {
          imports: [MockPopupHeaderComponent, MockPopupPageComponent, MockPopOutComponent],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VaultSettingsV2Component);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    jest.spyOn(router, "navigate");
  });

  describe("archive link", () => {
    it("shows direct archive link when user can archive", () => {
      setArchiveState(true);

      const archiveLink = queryByTestId("archive-link");

      expect(archiveLink.nativeElement.getAttribute("routerLink")).toBe("/archive");
    });

    it("routes to archive when user has archived items but cannot archive", async () => {
      setArchiveState(false, [{ id: "cipher1" } as CipherView]);

      const premiumArchiveLink = queryByTestId("premium-archive-link");

      premiumArchiveLink.nativeElement.click();
      await fixture.whenStable();

      expect(router.navigate).toHaveBeenCalledWith(["/archive"]);
    });

    it("prompts for premium when user cannot archive and has no archived items", async () => {
      setArchiveState(false, []);
      const badge = component["premiumBadgeComponent"]();
      jest.spyOn(badge, "promptForPremium");

      const premiumArchiveLink = queryByTestId("premium-archive-link");

      premiumArchiveLink.nativeElement.click();
      await fixture.whenStable();

      expect(badge.promptForPremium).toHaveBeenCalled();
    });
  });

  describe("archive visibility", () => {
    it("displays archive link when user can archive", () => {
      setArchiveState(true);

      const archiveLink = queryByTestId("archive-link");

      expect(archiveLink).toBeTruthy();
      expect(component["userCanArchive"]()).toBe(true);
    });

    it("hides archive link when feature flag is disabled", () => {
      setArchiveState(false, [], false);

      const archiveLink = queryByTestId("archive-link");
      const premiumArchiveLink = queryByTestId("premium-archive-link");

      expect(archiveLink).toBeNull();
      expect(premiumArchiveLink).toBeNull();
      expect(component["showArchiveItem"]()).toBe(false);
    });

    it("shows premium badge when user has no archived items and cannot archive", () => {
      setArchiveState(false, []);

      expect(component["premiumBadgeComponent"]()).toBeTruthy();
      expect(component["userHasArchivedItems"]()).toBe(false);
    });

    it("hides premium badge when user has archived items", () => {
      setArchiveState(false, [{ id: "cipher1" } as CipherView]);

      expect(component["premiumBadgeComponent"]()).toBeUndefined();
      expect(component["userHasArchivedItems"]()).toBe(true);
    });
  });
});
