import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  AccountSwitcherEntries,
  AccountSwitcherEntry,
  AccountSwitcherService,
} from "@bitwarden/common/auth/account-switcher";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";

import { DesktopBiometricsService } from "../../../key-management/biometrics/desktop.biometrics.service";

import { AccountSwitcherV2Component } from "./account-switcher-v2.component";

describe("AccountSwitcherV2Component", () => {
  let fixture: ComponentFixture<AccountSwitcherV2Component>;
  let entries$: BehaviorSubject<AccountSwitcherEntries>;
  let messagingService: MockProxy<MessagingService>;
  let accountService: MockProxy<AccountService>;
  let biometricsService: MockProxy<DesktopBiometricsService>;
  let router: MockProxy<Router>;
  let finishSwitchAccount$: Subject<unknown>;

  const entry = (
    id: string,
    status: AuthenticationStatus = AuthenticationStatus.Locked,
  ): AccountSwitcherEntry => ({
    id: id as UserId,
    name: `name-${id}`,
    email: `${id}@example.com`,
    status,
    avatarColor: null,
    serverHostname: `server-${id}`,
  });

  const render = (entries: AccountSwitcherEntries) => {
    entries$.next(entries);
    fixture.detectChanges();
  };

  const trigger = () => fixture.debugElement.query(By.css("[aria-haspopup='menu']"));

  /** The menu's items, which only exist once the trigger is open. */
  const openMenu = (): HTMLElement[] => {
    trigger().nativeElement.click();
    fixture.detectChanges();
    return Array.from(document.querySelectorAll<HTMLElement>("[bitMenuItem], button[bitmenuitem]"));
  };

  const menuText = () =>
    Array.from(document.querySelectorAll(".cdk-overlay-container"))
      .map((element) => element.textContent)
      .join(" ");

  beforeEach(async () => {
    entries$ = new BehaviorSubject<AccountSwitcherEntries>({
      active: null,
      inactive: [],
      canAddAccount: true,
    });
    messagingService = mock<MessagingService>();
    accountService = mock<AccountService>();
    biometricsService = mock<DesktopBiometricsService>();
    router = mock<Router>();
    finishSwitchAccount$ = new Subject();

    const messageListener = mock<MessageListener>();
    messageListener.messages$.mockReturnValue(finishSwitchAccount$ as any);

    await TestBed.configureTestingModule({
      imports: [AccountSwitcherV2Component],
      providers: [
        { provide: AccountSwitcherService, useValue: { entries$ } },
        { provide: MessagingService, useValue: messagingService },
        { provide: MessageListener, useValue: messageListener },
        { provide: Router, useValue: router },
        { provide: AccountService, useValue: accountService },
        { provide: DesktopBiometricsService, useValue: biometricsService },
        {
          provide: I18nService,
          useValue: { t: (key: string) => key, translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountSwitcherV2Component);
    fixture.detectChanges();
  });

  it("renders nothing when there are no accounts", () => {
    expect(trigger()).toBeNull();
  });

  it("shows the active account's avatar on the trigger", () => {
    render({ active: entry("a"), inactive: [], canAddAccount: true });

    const avatar = trigger().query(By.css("bit-avatar"));
    expect(avatar.nativeElement.getAttribute("aria-label")).toBe("name-a");
  });

  it("shows the active account's name and email when expanded", () => {
    fixture.componentRef.setInput("expanded", true);
    render({ active: entry("a"), inactive: [], canAddAccount: true });

    expect(fixture.nativeElement.textContent).toContain("name-a");
    expect(fixture.nativeElement.textContent).toContain("a@example.com");
  });

  it("shows a trigger without an avatar when only inactive accounts exist", () => {
    render({ active: null, inactive: [entry("b")], canAddAccount: true });

    expect(trigger()).not.toBeNull();
    expect(trigger().query(By.css("bit-avatar"))).toBeNull();
  });

  it("lists inactive accounts in order with their server and status badge", () => {
    render({
      active: entry("a", AuthenticationStatus.Unlocked),
      inactive: [entry("c", AuthenticationStatus.Unlocked), entry("b")],
      canAddAccount: true,
    });

    const [first, second] = openMenu();

    expect(first.textContent).toContain("c@example.com");
    expect(first.textContent).toContain("server-c");
    expect(first.textContent).toContain("unlocked");
    expect(second.textContent).toContain("b@example.com");
    expect(second.textContent).toContain("server-b");
    expect(second.textContent).toContain("locked");
    expect(second.textContent).not.toContain("unlocked");
  });

  it("offers Add account when another account can be added", () => {
    render({ active: entry("a"), inactive: [entry("b")], canAddAccount: true });

    const items = openMenu();

    expect(items.at(-1)?.textContent).toContain("addAccount");
    expect(menuText()).not.toContain("accountSwitcherLimitReached");
  });

  it("shows the limit message in place of Add account at the account limit", () => {
    render({ active: entry("a"), inactive: [entry("b")], canAddAccount: false });

    const items = openMenu();

    expect(items.some((item) => item.textContent?.includes("addAccount"))).toBe(false);
    expect(menuText()).toContain("accountSwitcherLimitReached");
  });

  it("switches to an account when its menu item is clicked", async () => {
    render({ active: entry("a"), inactive: [entry("b")], canAddAccount: true });

    const [accountItem] = openMenu();
    accountItem.click();
    await fixture.whenStable();

    expect(biometricsService.setShouldAutopromptNow).toHaveBeenCalledWith(true);
    expect(messagingService.send).toHaveBeenCalledWith("switchAccount", { userId: "b" });
  });

  it("clears the active account and opens login when Add account is clicked", async () => {
    render({ active: entry("a"), inactive: [], canAddAccount: true });

    const items = openMenu();
    items.at(-1)!.click();
    await fixture.whenStable();

    expect(accountService.switchAccount).toHaveBeenCalledWith(null);
    expect(router.navigate).toHaveBeenCalledWith(["/login"]);
  });
});
