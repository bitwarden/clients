import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import {
  BitSvg,
  NoCredentialsIcon,
  ReportExposedPasswords,
  UnlockedIcon,
} from "@bitwarden/assets/svg";
import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import {
  RiskCategory,
  VaultHealthReportItem,
  VaultHealthReportView,
} from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { ChangeLoginPasswordService } from "@bitwarden/common/vault/abstractions/change-login-password.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { PasswordRepromptService } from "@bitwarden/vault";

import { HealthRiskCategoryDetailComponent } from "./health-risk-category-detail.component";

@Component({
  selector: "popup-page",
  template: `<ng-content></ng-content>`,
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

/** The real vault icon needs domain settings, config and environment services to resolve favicons. */
@Component({
  selector: "app-vault-icon",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// FIXME(https://bitwarden.atlassian.net/browse/PM-28231): Use Component suffix
// eslint-disable-next-line @angular-eslint/component-class-suffix
class MockAppVaultIcon {
  readonly cipher = input<CipherView | undefined>(undefined);
}

/** The route param, and the content the page is expected to render for it. */
const categories = [
  {
    category: RiskCategory.Exposed,
    titleKey: "exposedPasswordsTitle",
    descriptionKey: "exposedPasswordsDescription",
    emptyKey: "exposedPasswordsEmpty",
    icon: ReportExposedPasswords,
  },
  {
    category: RiskCategory.Weak,
    titleKey: "weakPasswordsTitle",
    descriptionKey: "weakPasswordsDescription",
    emptyKey: "weakPasswordsEmpty",
    icon: UnlockedIcon,
  },
  {
    category: RiskCategory.Reused,
    titleKey: "reusedPasswordsTitle",
    descriptionKey: "reusedPasswordsDescription",
    emptyKey: "reusedPasswordsEmpty",
    icon: NoCredentialsIcon,
  },
] as const;

describe("HealthRiskCategoryDetailComponent", () => {
  const userId = Utils.newGuid() as UserId;

  let fixture: ComponentFixture<HealthRiskCategoryDetailComponent>;
  let params$: BehaviorSubject<Params>;
  let report$: BehaviorSubject<VaultHealthReportView | null>;
  let reportService: MockProxy<VaultHealthReportService>;
  let router: MockProxy<Router>;
  let changeLoginPasswordService: MockProxy<ChangeLoginPasswordService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  /**
   * `login.uri` is a getter over `login.uris`, so fixtures have to be real views — an object
   * literal cast to `CipherView` would exercise a shape production never produces.
   */
  function buildLogin(args: {
    id: string;
    name?: string;
    username?: string;
    uris?: string[];
  }): CipherView {
    const cipher = new CipherView();
    cipher.id = args.id;
    cipher.name = args.name ?? args.id;
    cipher.type = CipherType.Login;
    cipher.login.username = args.username ?? `${args.id}@example.com`;
    cipher.login.uris = (args.uris ?? []).map((uri) => {
      const loginUri = new LoginUriView();
      loginUri.uri = uri;
      return loginUri;
    });
    return cipher;
  }

  /**
   * Publishes a report placing the given logins in one category's bucket. The
   * page reads only the bucket its route names, so items land in exactly one.
   */
  function setReport(category: RiskCategory, ciphers: CipherView[]) {
    const items = ciphers.map(
      (cipher) =>
        new VaultHealthReportItem(
          cipher,
          new CipherHealthView({
            cipherId: cipher.id,
            hasExposedPassword: category === RiskCategory.Exposed,
            hasWeakPassword: category === RiskCategory.Weak,
            hasReusedPassword: category === RiskCategory.Reused,
            exposedCount: category === RiskCategory.Exposed ? 3 : 0,
            reuseCount: category === RiskCategory.Reused ? 2 : 0,
          }),
        ),
    );

    report$.next(
      new VaultHealthReportView({
        totalCount: items.length,
        atRiskCount: items.length,
        categoryItems: { exposed: [], weak: [], reused: [], [category]: items },
      }),
    );
  }

  /** Creates the component and flushes the microtasks that resolve the report stream. */
  async function initComponent() {
    fixture = TestBed.createComponent(HealthRiskCategoryDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** The localized title handed to the page header. */
  function pageTitle(): string | undefined {
    return fixture.debugElement.query(By.css("popup-header")).componentInstance.pageTitle();
  }

  /** All rendered text. The i18n mock echoes keys, so keys are matched directly. */
  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll("bit-item"));
  }

  function rowButton(index: number): HTMLButtonElement {
    return rows()[index].querySelector("button[bit-item-content]")!;
  }

  /** The row's change password CTA, or `undefined` when the row does not render one. */
  function changePasswordButton(index: number): HTMLButtonElement | undefined {
    return Array.from(
      rows()[index].querySelectorAll<HTMLButtonElement>("bit-item-action button"),
    ).find((button) => button.textContent?.includes("changePassword"));
  }

  /** The count rendered alongside the section header. */
  function itemCount(): string | undefined {
    return fixture.nativeElement.querySelector("bit-section-header span[slot=end]")?.textContent;
  }

  /** The icon bound to the empty state, read off the component input rather than the rendered SVG. */
  function noItemsIcon(): BitSvg | undefined {
    return fixture.debugElement.query(By.css("bit-no-items"))?.componentInstance.icon();
  }

  beforeEach(async () => {
    params$ = new BehaviorSubject<Params>({ category: RiskCategory.Exposed });

    report$ = new BehaviorSubject<VaultHealthReportView | null>(null);
    reportService = mock<VaultHealthReportService>();
    reportService.getVaultHealthReport$.mockReturnValue(report$);
    setReport(RiskCategory.Exposed, [
      buildLogin({ id: "cipher-1", name: "Item 1", uris: ["https://example.com"] }),
    ]);

    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    changeLoginPasswordService = mock<ChangeLoginPasswordService>();
    changeLoginPasswordService.getChangePasswordUrl.mockResolvedValue(
      "https://example.com/settings/password",
    );

    passwordRepromptService = mock<PasswordRepromptService>();
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);

    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.launchUri.mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [HealthRiskCategoryDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { params: params$ } },
        { provide: Router, useValue: router },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: userId } as Account) },
        },
        { provide: VaultHealthReportService, useValue: reportService },
        { provide: ChangeLoginPasswordService, useValue: changeLoginPasswordService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
      ],
    })
      .overrideComponent(HealthRiskCategoryDetailComponent, {
        remove: {
          imports: [
            PopupPageComponent,
            PopupHeaderComponent,
            PopOutComponent,
            CurrentAccountComponent,
            AppVaultIconComponent,
          ],
        },
        add: {
          imports: [
            MockPopupPageComponent,
            MockPopupHeaderComponent,
            MockPopOutComponent,
            MockCurrentAccountComponent,
            MockAppVaultIcon,
          ],
        },
      })
      .compileComponents();
  });

  describe("category content", () => {
    it.each(categories.map((c) => [c.category, c.titleKey] as const))(
      "renders the %s title in the page header",
      async (category, titleKey) => {
        params$.next({ category });

        await initComponent();

        expect(pageTitle()).toBe(titleKey);
      },
    );

    it.each(categories.map((c) => [c.category, c.descriptionKey] as const))(
      "renders the %s description when the category has items",
      async (category, descriptionKey) => {
        params$.next({ category });
        setReport(category, [buildLogin({ id: "cipher-1" })]);

        await initComponent();

        expect(text()).toContain(descriptionKey);
      },
    );

    it.each(categories.map((c) => [c.category, c.emptyKey] as const))(
      "renders the %s empty copy when the category has no items",
      async (category, emptyKey) => {
        params$.next({ category });
        setReport(category, []);

        await initComponent();

        expect(text()).toContain(emptyKey);
      },
    );

    it.each(categories.map((c) => c.category))(
      "shows only the %s bucket, not the logins at risk in other categories",
      async (category) => {
        // Highest-risk-wins means each login sits in exactly one bucket, so a
        // category page must not pick up the report's other two.
        params$.next({ category });
        setReport(category, [buildLogin({ id: "in-category", name: "In category" })]);
        const otherCategory = categories.find((c) => c.category !== category)!.category;
        const report = report$.value!;
        report.categoryItems[otherCategory] = [
          new VaultHealthReportItem(
            buildLogin({ id: "other", name: "Other category" }),
            new CipherHealthView({
              cipherId: "other",
              hasExposedPassword: false,
              hasWeakPassword: true,
              hasReusedPassword: false,
              exposedCount: 0,
              reuseCount: 0,
            }),
          ),
        ];

        await initComponent();

        expect(rows()).toHaveLength(1);
        expect(text()).toContain("In category");
        expect(text()).not.toContain("Other category");
      },
    );

    it("swaps the title, description and empty icon when the category changes", async () => {
      params$.next({ category: RiskCategory.Exposed });
      await initComponent();
      expect(pageTitle()).toBe("exposedPasswordsTitle");
      expect(text()).toContain("exposedPasswordsDescription");

      setReport(RiskCategory.Reused, [buildLogin({ id: "cipher-1" })]);
      params$.next({ category: RiskCategory.Reused });
      fixture.detectChanges();

      expect(pageTitle()).toBe("reusedPasswordsTitle");
      expect(text()).toContain("reusedPasswordsDescription");
      expect(text()).not.toContain("exposedPasswordsDescription");

      setReport(RiskCategory.Reused, []);
      fixture.detectChanges();

      expect(noItemsIcon()).toBe(NoCredentialsIcon);
    });
  });

  it("reads the report for the active account", async () => {
    await initComponent();

    expect(reportService.getVaultHealthReport$).toHaveBeenCalledWith(userId);
  });

  describe("without a report", () => {
    beforeEach(() => {
      report$.next(null);
    });

    it("routes back to the health overview", async () => {
      await initComponent();

      expect(router.navigate).toHaveBeenCalledWith(["/tabs/health"]);
    });
  });

  describe("item list", () => {
    it("renders a row per item", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1", name: "Item 1" }),
        buildLogin({ id: "cipher-2", name: "Item 2" }),
      ]);

      await initComponent();

      expect(rows()).toHaveLength(2);
      expect(text()).toContain("Item 1");
      expect(text()).toContain("Item 2");
    });

    it("renders each item's username", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1", username: "person@example.com" }),
      ]);

      await initComponent();

      expect(text()).toContain("person@example.com");
    });

    it("renders the item count alongside the section header", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1" }),
        buildLogin({ id: "cipher-2" }),
        buildLogin({ id: "cipher-3" }),
      ]);

      await initComponent();

      expect(itemCount()).toContain("3");
    });
  });

  describe("viewing an item", () => {
    it("routes to the cipher when a row is clicked", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1" }),
        buildLogin({ id: "cipher-2" }),
        buildLogin({ id: "cipher-3" }),
      ]);
      await initComponent();

      rowButton(1).click();
      await fixture.whenStable();

      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(["/view-cipher"], {
        queryParams: { cipherId: "cipher-2", type: CipherType.Login },
      });
    });

    it("checks the master password reprompt for the clicked cipher", async () => {
      await initComponent();

      rowButton(0).click();
      await fixture.whenStable();

      expect(passwordRepromptService.passwordRepromptCheck).toHaveBeenCalledWith(
        expect.objectContaining({ id: "cipher-1" }),
      );
    });

    it("does not route when the master password reprompt is not satisfied", async () => {
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);
      await initComponent();

      rowButton(0).click();
      await fixture.whenStable();

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe("change password", () => {
    it("renders the change password button for an item with a URI", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1", uris: ["https://example.com"] }),
      ]);

      await initComponent();

      expect(changePasswordButton(0)).toBeDefined();
    });

    it("does not render the change password button for an item without a URI", async () => {
      setReport(RiskCategory.Exposed, [buildLogin({ id: "cipher-1", uris: [] })]);

      await initComponent();

      expect(rows()).toHaveLength(1);
      expect(changePasswordButton(0)).toBeUndefined();
    });

    it("opens the change password URL for the clicked item using platform utils service", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1", uris: ["https://example.com"] }),
        buildLogin({ id: "cipher-2", uris: ["https://another.example.com"] }),
      ]);
      changeLoginPasswordService.getChangePasswordUrl.mockResolvedValue(
        "https://another.example.com/password",
      );
      await initComponent();

      changePasswordButton(1)!.click();
      await fixture.whenStable();

      expect(changeLoginPasswordService.getChangePasswordUrl).toHaveBeenCalledWith(
        expect.objectContaining({ id: "cipher-2" }),
      );
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://another.example.com/password",
      );
    });
  });
});
