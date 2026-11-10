import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, NEVER, of } from "rxjs";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  PASSKEY_OPPORTUNITIES_IDLE,
  PasskeyOpportunitiesState,
  PasskeyOpportunity,
  VaultHealthReportStatus,
} from "@bitwarden/common/dirt/vault-health/models";
import { PasskeyOpportunityService } from "@bitwarden/common/dirt/vault-health/services";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CompactModeService, ScrollLayoutHostDirective } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { HealthScanningComponent } from "./components/health-scanning/health-scanning.component";
import { HealthPasskeyDetailComponent } from "./health-passkey-detail.component";
import { HealthPasskeyScanService } from "./services/health-passkey-scan.service";

/** Mirrors the real page's scroll host, which the virtual scroll viewport measures. */
@Component({
  selector: "popup-page",
  template: `<div bitScrollLayoutHost><ng-content></ng-content></div>`,
  imports: [ScrollLayoutHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopupPageComponent {}

@Component({
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopupHeaderComponent {
  readonly pageTitle = input<string | undefined>(undefined);
  readonly showBackButton = input<string | boolean | undefined>(undefined);
}

@Component({
  selector: "app-pop-out",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopOutComponent {}

@Component({
  selector: "app-current-account",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockCurrentAccountComponent {}

@Component({
  selector: "dirt-health-scanning",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockHealthScanningComponent {}

/** The real vault icon needs domain settings, config and environment services to resolve favicons. */
@Component({
  selector: "app-vault-icon",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// eslint-disable-next-line @angular-eslint/component-class-suffix
class MockAppVaultIcon {
  readonly cipher = input<CipherView | undefined>(undefined);
}

describe("HealthPasskeyDetailComponent", () => {
  const userId = "user-1" as UserId;

  let fixture: ComponentFixture<HealthPasskeyDetailComponent>;
  let state$: BehaviorSubject<PasskeyOpportunitiesState>;
  let cipherViews$: BehaviorSubject<CipherView[]>;
  let compactEnabled$: BehaviorSubject<boolean>;
  let scanService: MockProxy<HealthPasskeyScanService>;
  let router: MockProxy<Router>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  function login(id: string, name = id): CipherView {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.name = name;
    cipher.type = CipherType.Login;
    cipher.login.username = `${id}@example.com`;
    return cipher;
  }

  function opportunity(
    id: string,
    overrides: Partial<PasskeyOpportunity> = {},
  ): PasskeyOpportunity {
    return {
      id,
      supportsPasskeyLogin: true,
      supportsPasskeyMfa: false,
      instructions: `https://${id}.example/passkeys`,
      ...overrides,
    };
  }

  function publish(
    opportunities: PasskeyOpportunity[] | null,
    status: VaultHealthReportStatus = VaultHealthReportStatus.Success,
  ) {
    state$.next({ status, opportunities });
  }

  async function settle() {
    // The virtual scroll viewport defers its own init by a microtask.
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function init() {
    fixture = TestBed.createComponent(HealthPasskeyDetailComponent);
    fixture.detectChanges();
    await settle();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll("bit-item"));
  }

  function instructionsButton(index: number): HTMLButtonElement | null {
    return rows()[index].querySelector("button[bitButton]");
  }

  beforeEach(async () => {
    state$ = new BehaviorSubject<PasskeyOpportunitiesState>(PASSKEY_OPPORTUNITIES_IDLE);
    const opportunityService = mock<PasskeyOpportunityService>();
    opportunityService.getPasskeyOpportunities$.mockReturnValue(state$);

    cipherViews$ = new BehaviorSubject<CipherView[]>([login("a", "Alpha"), login("b", "Bravo")]);
    const cipherService = mock<CipherService>();
    cipherService.cipherViews$.mockReturnValue(cipherViews$);

    scanService = mock<HealthPasskeyScanService>();
    scanService.keepPasskeysCurrent$.mockReturnValue(NEVER);

    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    passwordRepromptService = mock<PasswordRepromptService>();
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);
    platformUtilsService = mock<PlatformUtilsService>();

    compactEnabled$ = new BehaviorSubject(false);
    const compactModeService = mock<CompactModeService>();
    compactModeService.enabled$ = compactEnabled$;

    await TestBed.configureTestingModule({
      imports: [HealthPasskeyDetailComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: AccountService, useValue: { activeAccount$: of({ id: userId } as Account) } },
        { provide: PasskeyOpportunityService, useValue: opportunityService },
        { provide: HealthPasskeyScanService, useValue: scanService },
        { provide: CipherService, useValue: cipherService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: CompactModeService, useValue: compactModeService },
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: unknown[]) =>
              [key, ...args.filter((a) => a != null && a !== "")].join(" "),
          },
        },
      ],
    })
      .overrideComponent(HealthPasskeyDetailComponent, {
        remove: {
          imports: [
            PopupPageComponent,
            PopupHeaderComponent,
            PopOutComponent,
            CurrentAccountComponent,
            AppVaultIconComponent,
            HealthScanningComponent,
          ],
        },
        add: {
          imports: [
            MockPopupPageComponent,
            MockPopupHeaderComponent,
            MockPopOutComponent,
            MockCurrentAccountComponent,
            MockAppVaultIcon,
            MockHealthScanningComponent,
          ],
        },
      })
      .compileComponents();
  });

  it("titles the page", async () => {
    await init();

    const header = fixture.debugElement.query(By.directive(MockPopupHeaderComponent));
    expect(header.componentInstance.pageTitle()).toBe("passkeyOpportunitiesTitle");
  });

  it("keeps the check running for the active user while open", async () => {
    await init();

    expect(scanService.keepPasskeysCurrent$).toHaveBeenCalledWith(userId);
  });

  it.each([VaultHealthReportStatus.Idle, VaultHealthReportStatus.Loading])(
    "shows progress, not the empty state, before a result (%s)",
    async (status) => {
      publish(null, status);
      await init();

      expect(fixture.nativeElement.querySelector("dirt-health-scanning")).not.toBeNull();
      expect(text()).not.toContain("passkeyOpportunitiesEmpty");
    },
  );

  describe("when the first check failed", () => {
    beforeEach(async () => {
      publish(null, VaultHealthReportStatus.Error);
      await init();
    });

    it("shows the failure as an alert", () => {
      expect(fixture.nativeElement.querySelector("[role=alert]")).not.toBeNull();
      expect(text()).toContain("passkeyOpportunitiesFailed");
    });

    it("retries with a fresh directory when asked", () => {
      fixture.nativeElement.querySelector("#health-passkey-detail_button_retry").click();

      expect(scanService.retry).toHaveBeenCalledWith(userId);
    });
  });

  it("keeps an earlier list on screen when a later check failed", async () => {
    publish([opportunity("a")], VaultHealthReportStatus.Error);
    await init();

    expect(rows()).toHaveLength(1);
    expect(fixture.nativeElement.querySelector("[role=alert]")).toBeNull();
  });

  it("shows the empty state when no login can use a passkey", async () => {
    publish([]);
    await init();

    expect(text()).toContain("youreAllSet");
    expect(text()).toContain("passkeyOpportunitiesEmpty");
    expect(rows()).toHaveLength(0);
  });

  describe("with opportunities", () => {
    beforeEach(async () => {
      publish([
        opportunity("a", { supportsPasskeyLogin: true, supportsPasskeyMfa: true }),
        opportunity("b", {
          supportsPasskeyLogin: false,
          supportsPasskeyMfa: true,
          instructions: undefined,
        }),
        opportunity("deleted-since-check"),
      ]);
      await init();
    });

    it("renders a row per opportunity whose login still exists, with its count", () => {
      expect(rows()).toHaveLength(2);
      expect(rows()[0].textContent).toContain("Alpha");
      expect(rows()[0].textContent).toContain("a@example.com");
      expect(
        fixture.nativeElement.querySelector("bit-section-header span[slot=end]").textContent,
      ).toContain("2");
    });

    it("shows what each site supports passkeys for, with screen reader context", () => {
      const badges = (index: number) =>
        Array.from(rows()[index].querySelectorAll("[bitBadge]")).map((b) => b.textContent!.trim());

      expect(badges(0)).toEqual(["logIn", "twoStepLogin"]);
      expect(badges(1)).toEqual(["twoStepLogin"]);
      expect(rows()[0].querySelector(".tw-sr-only")!.textContent).toContain("passkeySupportedFor");
    });

    it("offers the site's instructions only when there are some", () => {
      expect(instructionsButton(0)).not.toBeNull();
      expect(instructionsButton(1)).toBeNull();
    });

    it("labels the instructions button with the item it is for", () => {
      expect(instructionsButton(0)!.getAttribute("aria-label")).toBe("setUpPasskeyFor Alpha");
    });

    it("opens the instructions with platform utils", () => {
      instructionsButton(0)!.click();

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith("https://a.example/passkeys");
    });

    it("views the item after the master password reprompt", async () => {
      rows()[0].querySelector<HTMLButtonElement>("button[bit-item-content]")!.click();
      await settle();

      expect(passwordRepromptService.passwordRepromptCheck).toHaveBeenCalledWith(
        expect.objectContaining({ id: "a" }),
      );
      expect(router.navigate).toHaveBeenCalledWith(["/view-cipher"], {
        queryParams: { cipherId: "a", type: CipherType.Login },
      });
    });

    it("does not view the item when the reprompt is not satisfied", async () => {
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);

      rows()[0].querySelector<HTMLButtonElement>("button[bit-item-content]")!.click();
      await settle();

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("drops a row once its login is deleted from the vault", async () => {
      cipherViews$.next([login("b", "Bravo")]);
      await settle();

      expect(rows()).toHaveLength(1);
      expect(rows()[0].textContent).toContain("Bravo");
    });
  });

  it("uses the compact row height in compact mode", async () => {
    compactEnabled$.next(true);
    publish([opportunity("a")]);
    await init();

    const viewport = fixture.debugElement.query(By.css("cdk-virtual-scroll-viewport"));
    expect(viewport.injector.get(HealthPasskeyDetailComponent)["rowSize"]()).toBe(53);
  });
});
