import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, ReplaySubject } from "rxjs";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import {
  BitSvg,
  NoCredentialsIcon,
  ReportExposedPasswords,
  UnlockedIcon,
} from "@bitwarden/assets/svg";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { ChangeLoginPasswordService } from "@bitwarden/common/vault/abstractions/change-login-password.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { DialogRef, DialogService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { HealthDeleteAtRiskItemDialogComponent } from "./health-delete-at-risk-item-dialog.component";
import { HealthRiskCategoryDetailComponent } from "./health-risk-category-detail.component";

// eslint-disable-next-line no-console
const originalError = console.error;

// eslint-disable-next-line no-console
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === "object" &&
    (args[0] as Error).message.includes("Could not parse CSS stylesheet")
  ) {
    // Opening the menu's overlay container in tests causes stylesheets to be parsed, which can
    // lead to JSDOM unable to parse CSS errors. These can be ignored safely.
    return;
  }
  originalError(...args);
};

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
    category: "exposed-passwords",
    titleKey: "exposedPasswordsTitle",
    descriptionKey: "exposedPasswordsDescription",
    emptyKey: "exposedPasswordsEmpty",
    icon: ReportExposedPasswords,
  },
  {
    category: "weak-passwords",
    titleKey: "weakPasswordsTitle",
    descriptionKey: "weakPasswordsDescription",
    emptyKey: "weakPasswordsEmpty",
    icon: UnlockedIcon,
  },
  {
    category: "reused-passwords",
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
  let activeAccount$: ReplaySubject<Account | null>;
  let ciphers$: BehaviorSubject<CipherView[]>;
  let router: MockProxy<Router>;
  let cipherService: MockProxy<CipherService>;
  let changeLoginPasswordService: MockProxy<ChangeLoginPasswordService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let dialogService: MockProxy<DialogService>;
  let windowOpen: jest.SpyInstance;

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

  /** Creates the component and flushes the microtasks that resolve the cipher stream. */
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

  /**
   * The row's ellipsis trigger. Matched on `bitIconButton` — the menu trigger is bound as a
   * property, so `bitMenuTriggerFor` never reaches the DOM.
   */
  function moreOptionsButton(index: number): HTMLButtonElement | null {
    return rows()[index].querySelector("button[bitIconButton]");
  }

  /**
   * The open menu panel. The menu's content is projected through an `ng-template` into a CDK
   * overlay, so it lives outside the fixture and is only in the DOM while the menu is open.
   */
  function menuPanel(): HTMLElement | null {
    return document.querySelector(".bit-menu-panel");
  }

  /** An entry in the open menu, matched on its rendered text. */
  function menuItem(label: string): HTMLButtonElement | undefined {
    return Array.from(menuPanel()?.querySelectorAll<HTMLButtonElement>("[bitMenuItem]") ?? []).find(
      (button) => button.textContent?.includes(label),
    );
  }

  /** Opens the ellipsis menu on the given row. */
  function openMenu(index: number) {
    moreOptionsButton(index)!.click();
    fixture.detectChanges();
  }

  /** The count rendered alongside the section header. */
  function itemCount(): string | undefined {
    return fixture.nativeElement.querySelector("bit-section-header span[slot=end]")?.textContent;
  }

  function noItems(): HTMLElement | null {
    return fixture.nativeElement.querySelector("bit-no-items");
  }

  /** The icon bound to the empty state, read off the component input rather than the rendered SVG. */
  function noItemsIcon(): BitSvg | undefined {
    return fixture.debugElement.query(By.css("bit-no-items"))?.componentInstance.icon();
  }

  beforeEach(async () => {
    params$ = new BehaviorSubject<Params>({ category: "exposed-passwords" });

    activeAccount$ = new ReplaySubject<Account | null>(1);
    activeAccount$.next({ id: userId } as Account);

    ciphers$ = new BehaviorSubject<CipherView[]>([
      buildLogin({ id: "cipher-1", name: "Item 1", uris: ["https://example.com"] }),
    ]);

    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    cipherService = mock<CipherService>();
    cipherService.cipherViews$.mockReturnValue(ciphers$);

    changeLoginPasswordService = mock<ChangeLoginPasswordService>();
    changeLoginPasswordService.getChangePasswordUrl.mockResolvedValue(
      "https://example.com/settings/password",
    );

    passwordRepromptService = mock<PasswordRepromptService>();
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);

    // `onDeleteItem` only awaits `open()`, so a minimal `DialogRef`-shaped return is enough.
    dialogService = mock<DialogService>();
    dialogService.open.mockReturnValue({ closed: of(undefined) } as DialogRef<unknown>);

    windowOpen = jest.spyOn(window, "open").mockImplementation(() => null);

    await TestBed.configureTestingModule({
      imports: [HealthRiskCategoryDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { params: params$ } },
        { provide: Router, useValue: router },
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: CipherService, useValue: cipherService },
        { provide: ChangeLoginPasswordService, useValue: changeLoginPasswordService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
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

  afterEach(() => {
    windowOpen.mockRestore();
    // Overlays are attached to the document body, so they outlive the fixture unless removed.
    document.querySelectorAll(".cdk-overlay-container").forEach((overlay) => overlay.remove());
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

        await initComponent();

        expect(text()).toContain(descriptionKey);
      },
    );

    it.each(categories.map((c) => [c.category, c.emptyKey] as const))(
      "renders the %s empty copy when the category has no items",
      async (category, emptyKey) => {
        params$.next({ category });
        ciphers$.next([]);

        await initComponent();

        expect(text()).toContain(emptyKey);
      },
    );

    it("does not render content for another category", async () => {
      params$.next({ category: "weak-passwords" });

      await initComponent();

      expect(text()).not.toContain("exposedPasswords");
      expect(text()).not.toContain("reusedPasswords");
    });

    // The page title is an interpolated attribute, so an unmapped category coerces to a blank
    // string rather than falling back to any default copy.
    it("renders no content keys for an unrecognized category", async () => {
      params$.next({ category: "not-a-category" });

      await initComponent();

      expect(pageTitle()).toBe("");
      expect(text()).not.toContain("Description");
    });

    it("renders no content keys when the route has no category", async () => {
      params$.next({});

      await initComponent();

      expect(pageTitle()).toBe("");
    });

    it("swaps the title, description and empty icon when the category changes", async () => {
      params$.next({ category: "exposed-passwords" });
      await initComponent();
      expect(pageTitle()).toBe("exposedPasswordsTitle");
      expect(text()).toContain("exposedPasswordsDescription");

      params$.next({ category: "reused-passwords" });
      fixture.detectChanges();

      expect(pageTitle()).toBe("reusedPasswordsTitle");
      expect(text()).toContain("reusedPasswordsDescription");
      expect(text()).not.toContain("exposedPasswordsDescription");

      ciphers$.next([]);
      fixture.detectChanges();

      expect(noItemsIcon()).toBe(NoCredentialsIcon);
    });
  });

  describe("item list", () => {
    it("renders a row per item", async () => {
      ciphers$.next([
        buildLogin({ id: "cipher-1", name: "Item 1" }),
        buildLogin({ id: "cipher-2", name: "Item 2" }),
      ]);

      await initComponent();

      expect(rows()).toHaveLength(2);
      expect(text()).toContain("Item 1");
      expect(text()).toContain("Item 2");
    });

    it("renders each item's username", async () => {
      ciphers$.next([buildLogin({ id: "cipher-1", username: "person@example.com" })]);

      await initComponent();

      expect(text()).toContain("person@example.com");
    });

    it("renders the item count alongside the section header", async () => {
      ciphers$.next([
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
      ciphers$.next([
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
      ciphers$.next([buildLogin({ id: "cipher-1", uris: ["https://example.com"] })]);

      await initComponent();

      expect(changePasswordButton(0)).toBeDefined();
    });

    it("does not render the change password button for an item without a URI", async () => {
      ciphers$.next([buildLogin({ id: "cipher-1", uris: [] })]);

      await initComponent();

      expect(rows()).toHaveLength(1);
      expect(changePasswordButton(0)).toBeUndefined();
    });

    it("opens the change password URL for the clicked item in a new window", async () => {
      ciphers$.next([
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
      expect(windowOpen).toHaveBeenCalledWith("https://another.example.com/password", "_blank");
    });
  });

  describe("ellipsis menu", () => {
    it("renders an ellipsis menu trigger on every row", async () => {
      ciphers$.next([buildLogin({ id: "cipher-1" }), buildLogin({ id: "cipher-2" })]);

      await initComponent();

      expect(moreOptionsButton(0)).not.toBeNull();
      expect(moreOptionsButton(1)).not.toBeNull();
      expect(moreOptionsButton(0)!.getAttribute("aria-label")).toBe(
        "moreOptionsLabelNoPlaceholder",
      );
    });

    it("renders the delete item entry in the ellipsis menu", async () => {
      await initComponent();

      openMenu(0);

      expect(menuPanel()).not.toBeNull();
      expect(menuItem("deleteItem")).toBeDefined();
    });

    it("opens the delete dialog when the menu entry is clicked", async () => {
      await initComponent();
      openMenu(0);

      menuItem("deleteItem")!.click();
      await fixture.whenStable();

      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expect(dialogService.open).toHaveBeenCalledWith(
        HealthDeleteAtRiskItemDialogComponent,
        expect.anything(),
      );
    });

    // The risk flags on the passed view are placeholders today, so only the item's identity and
    // the category are asserted — the hierarchy they drive is covered in the dialog's own spec.
    it("passes the clicked item and the current category to the dialog", async () => {
      params$.next({ category: "weak-passwords" });
      ciphers$.next([
        buildLogin({ id: "cipher-1" }),
        buildLogin({ id: "cipher-2" }),
        buildLogin({ id: "cipher-3" }),
      ]);
      await initComponent();
      openMenu(1);

      menuItem("deleteItem")!.click();
      await fixture.whenStable();

      expect(dialogService.open).toHaveBeenCalledWith(
        HealthDeleteAtRiskItemDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({
            currentCategory: "weak-passwords",
            item: expect.objectContaining({ cipherId: "cipher-2" }),
          }),
        }),
      );
    });
  });

  describe("empty state", () => {
    beforeEach(() => {
      ciphers$.next([]);
    });

    it.each(categories.map((c) => [c.category, c.icon] as const))(
      "renders the %s empty state icon",
      async (category, icon) => {
        params$.next({ category });

        await initComponent();

        expect(noItems()).not.toBeNull();
        expect(noItemsIcon()).toBe(icon);
      },
    );

    it("renders the shared empty state title", async () => {
      await initComponent();

      expect(text()).toContain("youreAllSet");
    });

    it("replaces the item list and count with the empty state", async () => {
      await initComponent();

      expect(rows()).toHaveLength(0);
      expect(itemCount()).toBeUndefined();
      expect(text()).not.toContain("exposedPasswordsDescription");
    });
  });
});
