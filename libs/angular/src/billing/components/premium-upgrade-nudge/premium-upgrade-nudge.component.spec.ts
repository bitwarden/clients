import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable, of, Subject, throwError } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { PremiumUpgradeNudgeOptions } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { ButtonComponent, DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";

import { SYSTEM_THEME_OBSERVABLE } from "../../../services/injection-tokens";

import {
  PremiumUpgradeNudgeComponent,
  PremiumUpgradeNudgeDialogData,
} from "./premium-upgrade-nudge.component";

const premiumTier = (annualPrice?: number): PersonalSubscriptionPricingTier => ({
  id: PersonalSubscriptionPricingTierIds.Premium,
  name: "Premium",
  description: "Premium",
  availableCadences: [SubscriptionCadenceIds.Annually],
  passwordManager: {
    type: "standalone",
    annualPrice,
    annualPricePerAdditionalStorageGB: 4,
    providedStorageGB: 1,
    features: [],
  },
});

const familiesTier: PersonalSubscriptionPricingTier = {
  id: PersonalSubscriptionPricingTierIds.Families,
  name: "Families",
  description: "Families",
  availableCadences: [SubscriptionCadenceIds.Annually],
  passwordManager: {
    type: "packaged",
    users: 6,
    annualPrice: 40,
    annualPricePerAdditionalStorageGB: 4,
    providedStorageGB: 1,
    features: [],
  },
};

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: unknown) => void;
};

const deferred = (): Deferred => {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("PremiumUpgradeNudgeComponent", () => {
  let fixture: ComponentFixture<PremiumUpgradeNudgeComponent>;
  let dialogRef: MockProxy<DialogRef>;
  let subscriptionPricingService: MockProxy<SubscriptionPricingServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let validationService: MockProxy<ValidationService>;
  let selectedTheme$: BehaviorSubject<Theme>;
  let systemTheme$: BehaviorSubject<Theme>;
  let pending: Deferred;
  let upgrade: jest.Mock<Promise<void>, []>;

  const baseOptions: PremiumUpgradeNudgeOptions = {
    titleKey: "nudgeTitle",
    descriptionKey: "nudgeDescription",
  };

  const setup = async ({
    options = baseOptions,
    clientType = ClientType.Web,
    tiers$ = of([familiesTier, premiumTier(120)]),
    disableClose = false,
  }: {
    options?: PremiumUpgradeNudgeOptions;
    clientType?: ClientType;
    tiers$?: Observable<PersonalSubscriptionPricingTier[]>;
    disableClose?: boolean;
  } = {}) => {
    dialogRef = mock<DialogRef>({ isDrawer: false, disableClose });
    subscriptionPricingService = mock<SubscriptionPricingServiceAbstraction>();
    subscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(tiers$);
    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getClientType.mockReturnValue(clientType);
    validationService = mock<ValidationService>();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);
    const themeStateService = mock<ThemeStateService>();
    Object.defineProperty(themeStateService, "selectedTheme$", { value: selectedTheme$ });

    pending = deferred();
    upgrade = jest.fn(() => pending.promise);
    const data: PremiumUpgradeNudgeDialogData = { options, upgrade };

    await TestBed.configureTestingModule({
      imports: [PremiumUpgradeNudgeComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: dialogRef },
        { provide: SubscriptionPricingServiceAbstraction, useValue: subscriptionPricingService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ValidationService, useValue: validationService },
        { provide: I18nService, useValue: i18nService },
        { provide: ThemeStateService, useValue: themeStateService },
        { provide: SYSTEM_THEME_OBSERVABLE, useValue: systemTheme$ },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PremiumUpgradeNudgeComponent);
    fixture.detectChanges();
  };

  const query = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);
  const text = (): string => fixture.nativeElement.textContent;
  const priceLine = () => query("[data-testid='premium-upgrade-nudge-price']");
  const upgradeButton = () => query("#premium-upgrade-nudge_button_upgrade") as HTMLButtonElement;
  const dismissButton = () => query("#premium-upgrade-nudge_button_dismiss") as HTMLButtonElement;
  const upgradeButtonComponent = (): ButtonComponent =>
    fixture.debugElement
      .queryAll(By.directive(ButtonComponent))
      .find((el) => el.nativeElement.id === "premium-upgrade-nudge_button_upgrade")!
      .injector.get(ButtonComponent);

  beforeEach(() => {
    selectedTheme$ = new BehaviorSubject<Theme>(ThemeTypes.Light);
    systemTheme$ = new BehaviorSubject<Theme>(ThemeTypes.Light);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("renders the title, description and Premium badge", async () => {
    await setup();

    expect(query("[data-testid='bit-dialog-title']")?.textContent).toContain("nudgeTitle");
    expect(text()).toContain("nudgeDescription");
    expect(query("[bitBadge]")?.textContent?.trim()).toBe("premium");
  });

  describe("unlocked feature list", () => {
    it("renders no list when unlockedFeatureKeys is undefined", async () => {
      await setup();

      expect(query("ul")).toBeNull();
    });

    it("renders no list when unlockedFeatureKeys is empty", async () => {
      await setup({ options: { ...baseOptions, unlockedFeatureKeys: [] } });

      expect(query("ul")).toBeNull();
    });

    it("renders one item per key in order", async () => {
      await setup({
        options: { ...baseOptions, unlockedFeatureKeys: ["first", "second", "third"] },
      });

      const items = Array.from(fixture.nativeElement.querySelectorAll("li")).map((li) =>
        (li as HTMLElement).textContent?.trim(),
      );
      expect(items).toEqual(["first", "second", "third"]);
    });
  });

  describe("image", () => {
    const imageOptions = { ...baseOptions, imagePath: "/images/premium/totp.light.png" };
    const image = () => query("img") as HTMLImageElement | null;

    it("renders no image when imagePath is unset", async () => {
      await setup();

      expect(image()).toBeNull();
    });

    it("renders the light image in the light theme", async () => {
      await setup({ options: imageOptions });

      expect(image()?.getAttribute("src")).toBe("/images/premium/totp.light.png");
    });

    it("swaps to the dark sibling when the theme changes to dark and back", async () => {
      await setup({ options: imageOptions });

      selectedTheme$.next(ThemeTypes.Dark);
      fixture.detectChanges();
      expect(image()?.getAttribute("src")).toBe("/images/premium/totp.dark.png");

      selectedTheme$.next(ThemeTypes.Light);
      fixture.detectChanges();
      expect(image()?.getAttribute("src")).toBe("/images/premium/totp.light.png");
    });

    it("renders the dark image when the system theme is dark", async () => {
      selectedTheme$.next(ThemeTypes.System);
      systemTheme$.next(ThemeTypes.Dark);
      await setup({ options: imageOptions });

      expect(image()?.getAttribute("src")).toBe("/images/premium/totp.dark.png");
    });
  });

  describe("price line", () => {
    it("shows the monthly Premium price", async () => {
      await setup();

      expect(priceLine()?.textContent).toContain("$10.00");
      expect(priceLine()?.textContent).toMatch(/\/ month\b/);
      expect(priceLine()?.textContent).toContain("cancelAnytime");
    });

    it("appears when pricing arrives after the first render", async () => {
      const tiers$ = new Subject<PersonalSubscriptionPricingTier[]>();
      await setup({ tiers$ });

      expect(priceLine()).toBeNull();

      tiers$.next([familiesTier, premiumTier(120)]);
      fixture.detectChanges();

      expect(priceLine()?.textContent).toContain("$10.00");
    });

    it("is hidden when the Premium tier has no annual price", async () => {
      await setup({ clientType: ClientType.Browser, tiers$: of([premiumTier(undefined)]) });

      expect(priceLine()).toBeNull();
      expect(text()).not.toContain("cancelAnytime");
      expect(text()).not.toContain("secureCheckoutViaStripe");
    });

    it("is hidden when the Premium tier is missing", async () => {
      await setup({ tiers$: of([familiesTier]) });

      expect(priceLine()).toBeNull();
    });

    it("is hidden when pricing fails, without closing the dialog or blocking upgrade", async () => {
      await setup({ tiers$: throwError(() => new Error("pricing failed")) });

      expect(priceLine()).toBeNull();
      expect(dialogRef.close).not.toHaveBeenCalled();

      upgradeButton().click();
      expect(upgrade).toHaveBeenCalledTimes(1);

      pending.resolve();
      await flush();
      expect(dialogRef.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("upgrade", () => {
    it("runs the handler once while loading and closes after it resolves", async () => {
      await setup();

      upgradeButton().click();
      upgradeButton().click();
      fixture.detectChanges();

      expect(upgrade).toHaveBeenCalledTimes(1);
      expect(upgradeButtonComponent().loading()).toBe(true);
      expect(dialogRef.close).not.toHaveBeenCalled();

      pending.resolve();
      await flush();

      expect(dialogRef.close).toHaveBeenCalledTimes(1);
      expect(upgradeButtonComponent().loading()).toBe(false);
    });

    it("stays open, surfaces the error and leaves the loading state when the handler rejects", async () => {
      await setup();
      const error = new Error("checkout failed");

      upgradeButton().click();
      pending.reject(error);
      await flush();
      fixture.detectChanges();

      expect(validationService.showError).toHaveBeenCalledWith(error);
      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(upgradeButtonComponent().loading()).toBe(false);
    });

    it.each([
      ["Close", ClientType.Web],
      ["Not now", ClientType.Browser],
    ])("%s still closes the dialog while the handler is pending", async (_, clientType) => {
      await setup({ clientType });

      upgradeButton().click();
      fixture.detectChanges();

      expect(dismissButton().getAttribute("aria-disabled")).not.toBe("true");

      dismissButton().click();

      expect(dialogRef.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("dismiss", () => {
    it.each([
      ["Close", ClientType.Web],
      ["Not now", ClientType.Browser],
    ])("%s closes the dialog without running the handler", async (_, clientType) => {
      await setup({ clientType });

      dismissButton().click();

      expect(dialogRef.close).toHaveBeenCalledTimes(1);
      expect(upgrade).not.toHaveBeenCalled();
    });

    it("still closes when the dialog was opened with disableClose", async () => {
      await setup({ clientType: ClientType.Browser, disableClose: true });

      expect(dismissButton().disabled).toBe(false);
      expect(dismissButton().getAttribute("aria-disabled")).not.toBe("true");

      dismissButton().click();

      expect(dialogRef.close).toHaveBeenCalledTimes(1);
      expect(upgrade).not.toHaveBeenCalled();
    });
  });

  describe("layout by client type", () => {
    it("renders the extension sheet with Not now, Stripe subtext and external-link icon", async () => {
      await setup({ clientType: ClientType.Browser });

      expect(dismissButton().textContent?.trim()).toBe("notNow");
      expect(priceLine()?.textContent).toContain("secureCheckoutViaStripe");
      expect(upgradeButton().querySelector(".bwi-external-link")).not.toBeNull();
      expect(query("footer")).toBeNull();
    });

    it("renders the web modal with Close in the footer and no external checkout cues", async () => {
      await setup({ clientType: ClientType.Web });

      expect(query("footer #premium-upgrade-nudge_button_dismiss")?.textContent?.trim()).toBe(
        "close",
      );
      expect(query("footer #premium-upgrade-nudge_button_upgrade")).not.toBeNull();
      expect(text()).not.toContain("secureCheckoutViaStripe");
      expect(upgradeButton().querySelector(".bwi-external-link")).toBeNull();
    });

    it("renders the desktop modal with Close in the footer plus external checkout cues", async () => {
      await setup({ clientType: ClientType.Desktop });

      expect(query("footer #premium-upgrade-nudge_button_dismiss")?.textContent?.trim()).toBe(
        "close",
      );
      expect(priceLine()?.textContent).toContain("secureCheckoutViaStripe");
      expect(upgradeButton().querySelector(".bwi-external-link")).not.toBeNull();
    });
  });

  describe("open", () => {
    it("passes the config through to the dialog service unchanged", () => {
      const dialogService = mock<DialogService>();
      const config = {
        data: { options: baseOptions, upgrade: jest.fn() },
        disableClose: true,
      };

      PremiumUpgradeNudgeComponent.open(dialogService, config);

      expect(dialogService.open).toHaveBeenCalledWith(PremiumUpgradeNudgeComponent, config);
      expect(dialogService.open.mock.calls[0][1]).toBe(config);
      expect(config).not.toHaveProperty("positionStrategy");
    });
  });
});
