import { LiveAnnouncer } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  WritableSignal,
} from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, NEVER, of } from "rxjs";

import { SignalCacheOptions, ViewCacheService } from "@bitwarden/angular/platform/view-cache";
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
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { FilterOptionNode } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";

import { HealthPasskeysListComponent } from "./components/health-passkeys-list/health-passkeys-list.component";
import { HealthScanErrorComponent } from "./components/health-scan-error/health-scan-error.component";
import { HealthPasskeyDetailComponent } from "./health-passkey-detail.component";
import { HealthPasskeyScanService } from "./services/health-passkey-scan.service";
import { PasskeyGroup, PasskeyListFilters, PasskeyListRow } from "./services/passkey-list";
import { HEALTH_LIST_ANNOUNCE_DEBOUNCE_MS } from "./shared/health-list";

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
  selector: "dirt-health-scan-error",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockHealthScanErrorComponent {
  readonly titleKey = input<string>();
  readonly descriptionKey = input<string>();
  readonly retry = output<void>();
}

@Component({
  selector: "dirt-health-passkeys-list",
  template: `@for (row of rows(); track row.id) {
    <button type="button" [attr.data-health-list-row]="row.id">{{ row.name }}</button>
  }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockListComponent {
  readonly rows = input.required<readonly PasskeyListRow[]>();
  readonly loading = input(false);
  readonly filtersToRestore = input<Partial<PasskeyListFilters>>();
  readonly folderOptions = input<FilterOptionNode<string>[]>([]);
  readonly filtersChange = output<PasskeyListFilters>();
  readonly open = output<PasskeyListRow>();
  readonly setUp = output<PasskeyListRow>();
}

const userId = "user-id" as UserId;

function login(id: string, init: { username?: string; folderId?: string } = {}): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = id;
  cipher.type = CipherType.Login;
  cipher.folderId = init.folderId;
  cipher.login.username = init.username ?? `${id}@example.com`;
  return cipher;
}

function opportunity(id: string, init: Partial<PasskeyOpportunity> = {}): PasskeyOpportunity {
  return {
    id,
    supportsPasskeyLogin: true,
    supportsPasskeyMfa: false,
    instructions: `https://${id}.example/pk`,
    ...init,
  };
}

describe("HealthPasskeyDetailComponent", () => {
  let fixture: ComponentFixture<HealthPasskeyDetailComponent>;
  let state$: BehaviorSubject<PasskeyOpportunitiesState>;
  let ciphers$: BehaviorSubject<CipherView[]>;
  let scanService: MockProxy<HealthPasskeyScanService>;
  let router: MockProxy<Router>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let announce: jest.Mock;
  let cache: Map<string, WritableSignal<unknown>>;

  function publish(
    opportunities: PasskeyOpportunity[] | null,
    status: VaultHealthReportStatus = VaultHealthReportStatus.Success,
  ) {
    state$.next({ status, opportunities });
  }

  async function render() {
    fixture = TestBed.createComponent(HealthPasskeyDetailComponent);
    await settle();
  }

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function list(): MockListComponent | null {
    return fixture.debugElement.query(By.directive(MockListComponent))?.componentInstance ?? null;
  }

  function scanError(): MockHealthScanErrorComponent | null {
    return (
      fixture.debugElement.query(By.directive(MockHealthScanErrorComponent))?.componentInstance ??
      null
    );
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  beforeEach(async () => {
    state$ = new BehaviorSubject<PasskeyOpportunitiesState>(PASSKEY_OPPORTUNITIES_IDLE);
    const opportunityService = mock<PasskeyOpportunityService>();
    opportunityService.getPasskeyOpportunities$.mockReturnValue(state$);

    ciphers$ = new BehaviorSubject<CipherView[]>([
      login("amazon", { folderId: "work" }),
      login("dropbox"),
    ]);
    const cipherService = mock<CipherService>();
    cipherService.cipherViews$.mockReturnValue(ciphers$);

    const folderService = mock<FolderService>();
    const work = new FolderView();
    work.id = "work";
    work.name = "Work";
    const home = new FolderView();
    home.id = "home";
    home.name = "Home";
    folderService.folderViews$.mockReturnValue(of([work, home]));

    scanService = mock<HealthPasskeyScanService>();
    scanService.keepPasskeysCurrent$.mockReturnValue(NEVER);
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    passwordRepromptService = mock<PasswordRepromptService>();
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);
    platformUtilsService = mock<PlatformUtilsService>();
    announce = jest.fn();
    cache = new Map();

    await TestBed.configureTestingModule({
      imports: [HealthPasskeyDetailComponent],
      providers: [
        { provide: Router, useValue: router },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: userId } as Account) },
        },
        { provide: PasskeyOpportunityService, useValue: opportunityService },
        { provide: HealthPasskeyScanService, useValue: scanService },
        { provide: CipherService, useValue: cipherService },
        { provide: FolderService, useValue: folderService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: LiveAnnouncer, useValue: { announce } },
        {
          provide: ViewCacheService,
          useValue: {
            signal: (options: SignalCacheOptions<unknown>) => {
              const value = cache.get(options.key) ?? signal(options.initialValue);
              cache.set(options.key, value);
              return value;
            },
          },
        },
        {
          provide: I18nService,
          useValue: {
            collator: new Intl.Collator("en"),
            translationLocale: "en",
            t: (key: string, ...args: unknown[]) =>
              [key, ...args.filter((arg) => arg != null)].join(" "),
          },
        },
      ],
    })
      .overrideComponent(HealthPasskeyDetailComponent, {
        remove: {
          imports: [
            PopupHeaderComponent,
            PopOutComponent,
            CurrentAccountComponent,
            HealthPasskeysListComponent,
            HealthScanErrorComponent,
          ],
        },
        add: {
          imports: [
            MockPopupHeaderComponent,
            MockPopOutComponent,
            MockCurrentAccountComponent,
            MockListComponent,
            MockHealthScanErrorComponent,
          ],
        },
      })
      .compileComponents();
  });

  it("titles the page and keeps the check running for the active user", async () => {
    await render();

    const header = fixture.debugElement.query(By.directive(MockPopupHeaderComponent));
    expect(header.componentInstance.pageTitle()).toBe("passkeyOpportunitiesTitle");
    expect(scanService.keepPasskeysCurrent$).toHaveBeenCalledWith(userId);
  });

  it.each([VaultHealthReportStatus.Idle, VaultHealthReportStatus.Loading])(
    "shows skeleton rows and a screen reader status before a result (%s), not the vault scan",
    async (status) => {
      publish(null, status);
      await render();

      expect(list()!.loading()).toBe(true);
      expect(fixture.nativeElement.querySelector("[role=status]")?.textContent).toContain(
        "passkeyOpportunitiesChecking",
      );
      expect(fixture.nativeElement.querySelector("dirt-health-scanning")).toBeNull();
      expect(text()).toContain("passkeyOpportunitiesIntro");
    },
  );

  describe("when the first check failed", () => {
    beforeEach(async () => {
      publish(null, VaultHealthReportStatus.Error);
      await render();
    });

    it("shows the shared error state with the passkey copy", () => {
      expect(scanError()!.titleKey()).toBe("passkeyOpportunitiesFailed");
      expect(scanError()!.descriptionKey()).toBe("passkeyOpportunitiesFailedDesc");
      expect(list()).toBeNull();
    });

    it("retries for the active user", () => {
      scanError()!.retry.emit();

      expect(scanService.retry).toHaveBeenCalledWith(userId);
    });
  });

  it("keeps the last list when a later check fails", async () => {
    publish([opportunity("amazon")], VaultHealthReportStatus.Error);
    await render();

    expect(scanError()).toBeNull();
    expect(
      list()!
        .rows()
        .map((row) => row.id),
    ).toEqual(["amazon"]);
  });

  it("shows 'You're all set!' with no toolbar or intro when nothing is left", async () => {
    publish([]);
    await render();

    expect(text()).toContain("youreAllSet");
    expect(text()).toContain("passkeyOpportunitiesEmpty");
    expect(text()).not.toContain("passkeyOpportunitiesIntro");
    expect(list()).toBeNull();
  });

  it("joins opportunities to their logins, in groups, dropping any whose login is gone", async () => {
    publish([
      opportunity("amazon"),
      opportunity("dropbox", { supportsPasskeyLogin: false, supportsPasskeyMfa: true }),
      opportunity("deleted"),
    ]);
    await render();

    const rows = list()!.rows();
    expect(rows.map((row) => [row.id, row.group])).toEqual([
      ["amazon", PasskeyGroup.Login],
      ["dropbox", PasskeyGroup.TwoStep],
    ]);
    expect(list()!.loading()).toBe(false);
  });

  it("offers only the folders the listed logins are in", async () => {
    publish([opportunity("amazon"), opportunity("dropbox")]);
    await render();

    expect(list()!.folderOptions()).toEqual([{ value: "work", label: "Work" }]);
  });

  it("views the item after the master password reprompt", async () => {
    publish([opportunity("amazon")]);
    await render();

    list()!.open.emit(list()!.rows()[0]);
    await settle();

    expect(passwordRepromptService.passwordRepromptCheck).toHaveBeenCalledWith(
      expect.objectContaining({ id: "amazon" }),
    );
    expect(router.navigate).toHaveBeenCalledWith(["/view-cipher"], {
      queryParams: { cipherId: "amazon", type: CipherType.Login },
    });
  });

  it("does not view the item when the reprompt is not satisfied", async () => {
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);
    publish([opportunity("amazon")]);
    await render();

    list()!.open.emit(list()!.rows()[0]);
    await settle();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("opens the site's instructions when Set up is pressed", async () => {
    publish([opportunity("amazon")]);
    await render();

    list()!.setUp.emit(list()!.rows()[0]);

    expect(platformUtilsService.launchUri).toHaveBeenCalledWith("https://amazon.example/pk");
  });

  it("restores the saved search and saves changes to it", async () => {
    cache.set("health-passkeys-filters", signal({ search: "drop" }));
    publish([opportunity("amazon")]);
    await render();

    expect(list()!.filtersToRestore()).toEqual({ search: "drop" });

    list()!.filtersChange.emit({ search: "ama" });

    expect(cache.get("health-passkeys-filters")!()).toEqual({ search: "ama" });
  });

  describe("announcements", () => {
    /** Waits out the shared helper's debounce on real timers. */
    async function settleAnnouncements() {
      await settle();
      await new Promise((resolve) => setTimeout(resolve, HEALTH_LIST_ANNOUNCE_DEBOUNCE_MS + 50));
    }

    beforeEach(async () => {
      publish([opportunity("amazon"), opportunity("dropbox")]);
      await render();
    });

    it("announces how many results a search finds", async () => {
      list()!.filtersChange.emit({ search: "drop" });
      await settle();
      list()!.filtersChange.emit({ search: "a" });
      await settleAnnouncements();

      expect(announce).toHaveBeenCalledWith("searchResultsCount 2", "polite");
    });

    it("announces how many logins are left when one leaves the list", async () => {
      publish([opportunity("amazon")]);
      await settleAnnouncements();

      expect(announce).toHaveBeenCalledWith("passkeyOpportunitiesRemainingSingular", "polite");
    });
  });

  it("moves focus to the next row when the focused row leaves the list", async () => {
    ciphers$.next([login("amazon"), login("bing"), login("dropbox")]);
    publish([opportunity("amazon"), opportunity("bing"), opportunity("dropbox")]);
    await render();
    const bing = fixture.nativeElement.querySelector('[data-health-list-row="bing"]');
    bing.focus();
    bing.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    publish([opportunity("amazon"), opportunity("dropbox")]);
    await settle();
    await new Promise((resolve) => setTimeout(resolve));

    expect(document.activeElement?.getAttribute("data-health-list-row")).toBe("dropbox");
  });
});
