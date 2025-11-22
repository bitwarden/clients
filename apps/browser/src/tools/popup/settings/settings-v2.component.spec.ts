import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { TestBed, waitForAsync } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, Subject } from "rxjs";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AutofillBrowserSettingsService } from "@bitwarden/browser/autofill/services/autofill-browser-settings.service";
import { BrowserApi } from "@bitwarden/browser/platform/browser/browser-api";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";
import { FakeGlobalStateProvider } from "@bitwarden/state-test-utils";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";

import { SettingsV2Component } from "./settings-v2.component";

@Component({
  selector: "app-current-account",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class CurrentAccountStubComponent {}

describe("SettingsV2Component", () => {
  let account$: BehaviorSubject<Account | null>;
  let mockAccountService: Partial<AccountService>;
  let mockBillingState: { hasPremiumFromAnySource$: jest.Mock };
  let mockNudges: {
    showNudgeBadge$: jest.Mock;
    dismissNudge: jest.Mock;
  };
  let mockAutofillSettings: {
    defaultBrowserAutofillDisabled$: Subject<boolean>;
    isBrowserAutofillSettingOverridden: jest.Mock<Promise<boolean>>;
  };
  let dialogService: MockProxy<DialogService>;
  let openSpy: jest.SpyInstance;

  beforeEach(waitForAsync(async () => {
    dialogService = mock<DialogService>();
    account$ = new BehaviorSubject<Account | null>(null);
    mockAccountService = {
      activeAccount$: account$ as unknown as AccountService["activeAccount$"],
    };

    mockBillingState = {
      hasPremiumFromAnySource$: jest.fn().mockReturnValue(of(false)),
    };

    mockNudges = {
      showNudgeBadge$: jest.fn().mockImplementation(() => of(false)),
      dismissNudge: jest.fn().mockResolvedValue(undefined),
    };

    mockAutofillSettings = {
      defaultBrowserAutofillDisabled$: new BehaviorSubject<boolean>(false),
      isBrowserAutofillSettingOverridden: jest.fn().mockResolvedValue(false),
    };

    jest.spyOn(BrowserApi, "getBrowserClientVendor").mockReturnValue("Chrome");

    const cfg = TestBed.configureTestingModule({
      imports: [SettingsV2Component, RouterTestingModule],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: BillingAccountProfileStateService, useValue: mockBillingState },
        { provide: NudgesService, useValue: mockNudges },
        { provide: AutofillBrowserSettingsService, useValue: mockAutofillSettings },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: { t: jest.fn((key: string) => key) } },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: AvatarService, useValue: mock<AvatarService>() },
        { provide: AuthService, useValue: mock<AuthService>() },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    TestBed.overrideComponent(SettingsV2Component, {
      add: {
        imports: [CurrentAccountStubComponent],
        providers: [{ provide: DialogService, useValue: dialogService }],
      },
      remove: {
        imports: [CurrentAccountComponent],
      },
    });

    await cfg.compileComponents();
  }));

  afterEach(() => {
    jest.resetAllMocks();
  });

  function pushActiveAccount(id = "user-123"): Account {
    const acct = { id } as Account;
    account$.next(acct);
    return acct;
  }

  it("shows the premium spotlight when user does NOT have premium", async () => {
    mockBillingState.hasPremiumFromAnySource$.mockReturnValue(of(false));
    pushActiveAccount();

    const fixture = TestBed.createComponent(SettingsV2Component);
    fixture.detectChanges();
    await fixture.whenStable();

    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector("bit-spotlight")).toBeTruthy();
  });

  it("hides the premium spotlight when user HAS premium", async () => {
    mockBillingState.hasPremiumFromAnySource$.mockReturnValue(of(true));
    pushActiveAccount();

    const fixture = TestBed.createComponent(SettingsV2Component);
    fixture.detectChanges();
    await fixture.whenStable();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector("bit-spotlight")).toBeFalsy();
  });

  it("openUpgradeDialog calls PremiumUpgradeDialogComponent.open with the DialogService", async () => {
    openSpy = jest.spyOn(PremiumUpgradeDialogComponent, "open").mockImplementation();
    mockBillingState.hasPremiumFromAnySource$.mockReturnValue(of(false));
    pushActiveAccount();

    const fixture = TestBed.createComponent(SettingsV2Component);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component["openUpgradeDialog"]();
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(dialogService);
  });

  it("isBrowserAutofillSettingOverridden$ emits the value from the AutofillBrowserSettingsService", async () => {
    pushActiveAccount();

    mockAutofillSettings.isBrowserAutofillSettingOverridden.mockResolvedValue(true);

    const fixture = TestBed.createComponent(SettingsV2Component);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const value = await firstValueFrom(component["isBrowserAutofillSettingOverridden$"]);
    expect(value).toBe(true);

    mockAutofillSettings.isBrowserAutofillSettingOverridden.mockResolvedValue(false);

    const fixture2 = TestBed.createComponent(SettingsV2Component);
    const component2 = fixture2.componentInstance;
    fixture2.detectChanges();
    await fixture2.whenStable();

    const value2 = await firstValueFrom(component2["isBrowserAutofillSettingOverridden$"]);
    expect(value2).toBe(false);
  });

  it("showAutofillBadge$ emits true when default autofill is NOT disabled and nudge is true", async () => {
    pushActiveAccount();

    mockNudges.showNudgeBadge$.mockImplementation((type: NudgeType) =>
      of(type === NudgeType.AutofillNudge),
    );

    const fixture = TestBed.createComponent(SettingsV2Component);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    mockAutofillSettings.defaultBrowserAutofillDisabled$.next(false);

    const value = await firstValueFrom(component.showAutofillBadge$);
    expect(value).toBe(true);
  });

  it("showAutofillBadge$ emits false when default autofill IS disabled even if nudge is true", async () => {
    pushActiveAccount();

    mockNudges.showNudgeBadge$.mockImplementation((type: NudgeType) =>
      of(type === NudgeType.AutofillNudge),
    );

    const fixture = TestBed.createComponent(SettingsV2Component);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    mockAutofillSettings.defaultBrowserAutofillDisabled$.next(true);

    const value = await firstValueFrom(component.showAutofillBadge$);
    expect(value).toBe(false);
  });

  it("dismissBadge dismisses when showVaultBadge$ emits true", async () => {
    const acct = pushActiveAccount();

    mockNudges.showNudgeBadge$.mockImplementation((type: NudgeType) => {
      return of(type === NudgeType.EmptyVaultNudge);
    });

    const fixture = TestBed.createComponent(SettingsV2Component);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    await component.dismissBadge(NudgeType.EmptyVaultNudge);

    expect(mockNudges.dismissNudge).toHaveBeenCalledTimes(1);
    expect(mockNudges.dismissNudge).toHaveBeenCalledWith(NudgeType.EmptyVaultNudge, acct.id, true);
  });

  it("dismissBadge does nothing when showVaultBadge$ emits false", async () => {
    pushActiveAccount();

    mockNudges.showNudgeBadge$.mockReturnValue(of(false));

    const fixture = TestBed.createComponent(SettingsV2Component);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    await component.dismissBadge(NudgeType.EmptyVaultNudge);

    expect(mockNudges.dismissNudge).not.toHaveBeenCalled();
  });

  it("showDownloadBitwardenNudge$ proxies to nudges service for the active account", async () => {
    const acct = pushActiveAccount("user-xyz");

    mockNudges.showNudgeBadge$.mockImplementation((type: NudgeType) =>
      of(type === NudgeType.DownloadBitwarden),
    );

    const fixture = TestBed.createComponent(SettingsV2Component);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const val = await firstValueFrom(component.showDownloadBitwardenNudge$);
    expect(val).toBe(true);
    expect(mockNudges.showNudgeBadge$).toHaveBeenCalledWith(NudgeType.DownloadBitwarden, acct.id);
  });
});
