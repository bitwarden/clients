import { ChangeDetectionStrategy, Component, signal, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { BitTableV2Component, defineTable, TableDef } from "@bitwarden/components";

import { CopyCipherFieldService } from "../../services/copy-cipher-field.service";

import { VaultItemsTableActionsColumnComponent } from "./vault-items-table-actions-column.component";
import { VaultItemsTableCopyPresentation } from "./vault-items-table-copy-presentation";
import { VaultItemsTableRowAction } from "./vault-items-table-row-action";
import { VaultItemsTableColumn } from "./vault-items-table.component";

type TestEvent = { type: string; item: CipherView };

/**
 * The column registers with its table by DI, so it needs a real `bit-table-v2` around it to
 * render at all. This host supplies one.
 */
@Component({
  template: `
    <bit-table-v2 [tableDef]="table">
      <vault-items-table-actions-column
        [table]="table"
        [rowActions]="rowActions()"
        [copyPresentation]="copyPresentation()"
        (action)="emitted = emitted.concat([$event])"
      />
    </bit-table-v2>
  `,
  imports: [BitTableV2Component, VaultItemsTableActionsColumnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly ciphers = signal<CipherView[]>([]);
  readonly table: TableDef<CipherView, VaultItemsTableColumn> = defineTable<
    CipherView,
    VaultItemsTableColumn
  >(this.ciphers);
  readonly rowActions = signal<VaultItemsTableRowAction<CipherView, TestEvent>[]>([]);
  readonly copyPresentation = signal<VaultItemsTableCopyPresentation>("collapsed");
  emitted: TestEvent[] = [];

  /**
   * The column's host element matches none of `bit-table-v2`'s `ng-content` selectors, so it is
   * instantiated (registering its `bit-column`, whose cell template the table then stamps into
   * its own rows) but never attached to the DOM. A view query is the only way to reach it.
   */
  readonly actionsColumn = viewChild.required(VaultItemsTableActionsColumnComponent);
}

function loginCipher(overrides: Partial<CipherView> = {}): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.name = "Amazon";
  cipher.type = CipherType.Login;
  cipher.login.username = "derek@example.com";
  Object.assign(cipher, overrides);
  return cipher;
}

function withUri(uri: string): CipherView {
  const cipher = loginCipher();
  const loginUri = new LoginUriView();
  loginUri.uri = uri;
  cipher.login.uris = [loginUri];
  return cipher;
}

describe("VaultItemsTableActionsColumnComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let cipherService: CipherService;
  let platformUtilsService: PlatformUtilsService;
  let premiumUpgradePromptService: PremiumUpgradePromptService;

  beforeEach(async () => {
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as Account);

    const environmentService = mock<EnvironmentService>();
    environmentService.environment$ = of({
      getIconsUrl: () => "https://icons.example.com",
    } as never);

    const domainSettingsService = mock<DomainSettingsService>();
    domainSettingsService.showFavicons$ = of(false);

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    cipherService = mock<CipherService>();
    platformUtilsService = mock<PlatformUtilsService>();
    premiumUpgradePromptService = mock<PremiumUpgradePromptService>();

    // Drives `*appNotPremium` inside the Upgrade badge — a free user, so the badge renders.
    const billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccountService, useValue: accountService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: DomainSettingsService, useValue: domainSettingsService },
        { provide: ConfigService, useValue: configService },
        { provide: CipherService, useValue: cipherService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: CopyCipherFieldService, useValue: mock<CopyCipherFieldService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PremiumUpgradePromptService, useValue: premiumUpgradePromptService },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  /** The column instance, for exercising its protected surface directly. */
  function column(): VaultItemsTableActionsColumnComponent<CipherView, TestEvent> {
    // The column isn't instantiated until the host renders.
    fixture.detectChanges();
    return host.actionsColumn();
  }

  /** Overflow menu triggers, one per rendered row. */
  function menuTriggers(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll("[bitIconButton='bwi-ellipsis-v']"));
  }

  /**
   * Opens a row's overflow menu and returns its items. `bit-menu` renders into a CDK overlay
   * attached outside the fixture, so the items only exist once opened and must be queried from
   * the document.
   */
  function openMenu(rowIndex: number): HTMLButtonElement[] {
    menuTriggers()[rowIndex].click();
    fixture.detectChanges();
    return Array.from(document.querySelectorAll("[bitMenuItem]"));
  }

  describe("the event factory contract", () => {
    it("emits exactly the event the action's factory built, and builds none itself", () => {
      const cipher = loginCipher();
      const built: TestEvent = { type: "editCipher", item: cipher };
      const factory = jest.fn().mockReturnValue(built);

      host.ciphers.set([cipher]);
      host.rowActions.set([
        { id: "edit", label: "Edit", icon: "bwi-pencil-square", event: factory },
      ]);
      fixture.detectChanges();

      openMenu(0)[0].click();

      expect(factory).toHaveBeenCalledWith(cipher);
      // Reference equality: the column passes the factory's object through untouched.
      expect(host.emitted).toEqual([built]);
      expect(host.emitted[0]).toBe(built);
    });

    it("gives each row's factory that row's own item", () => {
      host.ciphers.set([
        loginCipher({ id: "a", name: "Amazon" }),
        loginCipher({ id: "b", name: "Apple" }),
      ]);
      host.rowActions.set([
        {
          id: "edit",
          label: "Edit",
          icon: "bwi-pencil-square",
          event: (item) => ({ type: "editCipher", item }),
        },
      ]);
      fixture.detectChanges();

      openMenu(1)[0].click();

      expect(host.emitted.map((event) => event.item.id)).toEqual(["b"]);
    });
  });

  describe("per-row action visibility", () => {
    it("hides an action whose show predicate rejects the row", () => {
      const organizationOwned = loginCipher({ id: "a", organizationId: "org-1" as never });
      const personal = loginCipher({ id: "b", organizationId: undefined });

      host.ciphers.set([organizationOwned, personal]);
      host.rowActions.set([
        {
          id: "events",
          label: "Event logs",
          icon: "bwi-file-text",
          event: (item) => ({ type: "viewEvents", item }),
          show: (item) => item.organizationId != null,
        },
      ]);
      fixture.detectChanges();

      expect(column()["visibleActions"](organizationOwned)).toHaveLength(1);
      expect(column()["visibleActions"](personal)).toHaveLength(0);
    });

    it("shows actions with no predicate", () => {
      const cipher = loginCipher();
      host.rowActions.set([
        {
          id: "edit",
          label: "Edit",
          icon: "bwi-pencil-square",
          event: (item) => ({ type: "editCipher", item }),
        },
      ]);
      fixture.detectChanges();

      expect(column()["visibleActions"](cipher)).toHaveLength(1);
    });

    it("renders no overflow trigger when a row has no visible actions", () => {
      host.ciphers.set([loginCipher()]);
      host.rowActions.set([
        {
          id: "edit",
          label: "Edit",
          icon: "bwi-pencil-square",
          event: (item) => ({ type: "editCipher", item }),
          show: () => false,
        },
      ]);
      fixture.detectChanges();

      expect(menuTriggers()).toHaveLength(0);
    });
  });

  describe("premium-gated actions", () => {
    const archive: VaultItemsTableRowAction<CipherView, TestEvent> = {
      id: "archive",
      label: "Archive",
      icon: "bwi-archive",
      premiumGated: () => true,
      event: (item) => ({ type: "archive", item }),
    };

    it("prompts for premium instead of emitting the action's event", async () => {
      host.ciphers.set([loginCipher()]);
      host.rowActions.set([archive]);
      fixture.detectChanges();

      openMenu(0)[0].click();
      await fixture.whenStable();

      expect(premiumUpgradePromptService.promptForPremium).toHaveBeenCalled();
      expect(host.emitted).toEqual([]);
    });

    it("badges the menu item so a free user sees why it is gated", () => {
      host.ciphers.set([loginCipher()]);
      host.rowActions.set([archive]);
      fixture.detectChanges();

      const menuItem = openMenu(0)[0];

      expect(menuItem.querySelector("app-premium-badge")).not.toBeNull();
      // The badge is a button of its own, so the menu item hides it from assistive tech.
      expect(menuItem.querySelector("[aria-hidden]")).not.toBeNull();
    });

    it("leaves an ungated action emitting, with no badge", () => {
      const cipher = loginCipher();
      host.ciphers.set([cipher]);
      host.rowActions.set([{ ...archive, premiumGated: () => false }]);
      fixture.detectChanges();

      const menuItem = openMenu(0)[0];
      menuItem.click();

      expect(menuItem.querySelector("app-premium-badge")).toBeNull();
      expect(host.emitted).toEqual([{ type: "archive", item: cipher }]);
      expect(premiumUpgradePromptService.promptForPremium).not.toHaveBeenCalled();
    });
  });

  describe("the launch button", () => {
    it("offers Launch for a cipher with a launchable uri", () => {
      host.ciphers.set([withUri("https://example.com")]);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector("[bitIconButton='bwi-external-link']"),
      ).not.toBeNull();
    });

    it("omits Launch when the cipher has no uri", () => {
      host.ciphers.set([loginCipher()]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("[bitIconButton='bwi-external-link']")).toBeNull();
    });
  });

  describe("copy presentation", () => {
    /** Copy buttons for the row, excluding Launch and the overflow trigger. */
    function copyButtons(): HTMLButtonElement[] {
      const host = fixture.nativeElement.querySelector("vault-item-copy-actions");
      return host ? Array.from(host.querySelectorAll("button")) : [];
    }

    it("collapses to a single button when a login has several copyable fields", () => {
      const cipher = loginCipher();
      cipher.login.password = "pw";
      cipher.login.totp = "otpauth://totp/x";
      host.ciphers.set([cipher]);
      host.copyPresentation.set("collapsed");
      fixture.detectChanges();

      expect(copyButtons()).toHaveLength(1);
    });

    it("gives each copyable field its own button when expanded", () => {
      const cipher = loginCipher();
      cipher.login.password = "pw";
      cipher.login.totp = "otpauth://totp/x";
      host.ciphers.set([cipher]);
      host.copyPresentation.set("expanded");
      fixture.detectChanges();

      // username, password, TOTP
      expect(copyButtons()).toHaveLength(3);
    });

    it("widens the column for the expanded set so the overflow trigger stays aligned", () => {
      host.copyPresentation.set("collapsed");
      expect(column()["columnWidth"]()).toBe("160px");

      host.copyPresentation.set("expanded");
      expect(column()["columnWidth"]()).toBe("240px");
    });
  });

  describe("launching", () => {
    it("records the launch before opening, so last-launched ordering stays accurate", async () => {
      const cipher = withUri("https://example.com");

      await column()["launch"](cipher);

      expect(cipherService.updateLastLaunchedDate).toHaveBeenCalledWith("cipher-1", "user-1");
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith("https://example.com");
    });

    it("does nothing for a cipher with no launch uri", async () => {
      await column()["launch"](loginCipher());

      expect(platformUtilsService.launchUri).not.toHaveBeenCalled();
      expect(cipherService.updateLastLaunchedDate).not.toHaveBeenCalled();
    });
  });
});
