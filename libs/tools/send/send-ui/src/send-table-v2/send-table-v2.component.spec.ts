import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { DialogService, MenuTriggerForDirective, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { SendPolicyService } from "../services/send-policy.service";

import { SendTableV2Component } from "./send-table-v2.component";

function createSend(id: string, overrides: Partial<SendView> = {}): SendView {
  const send = new SendView();
  send.id = id;
  send.name = `Send ${id}`;
  send.type = SendType.Text;
  send.authType = AuthType.None;
  send.deletionDate = new Date("2030-01-01T12:00:00Z");
  send.password = null as any;
  return Object.assign(send, overrides);
}

// eslint-disable-next-line no-console
const originalError = console.error;

describe("SendTableV2Component", () => {
  let fixture: ComponentFixture<SendTableV2Component>;
  let component: SendTableV2Component;
  let i18nService: MockProxy<I18nService>;
  let dialogService: MockProxy<DialogService>;
  let sendApiService: MockProxy<SendApiService>;
  let disableSend$: BehaviorSubject<boolean>;
  let sendAuthRequired$: BehaviorSubject<boolean>;

  beforeAll(() => {
    // Opening the menu overlay causes JSDOM to parse stylesheets it can't understand; ignore those.
    // eslint-disable-next-line no-console
    console.error = (...args: unknown[]) => {
      if ((args[0] as Error)?.message?.includes("Could not parse CSS stylesheet")) {
        return;
      }
      originalError(...args);
    };
  });

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.error = originalError;
  });

  afterEach(() => {
    // Close any open menu overlay so it doesn't leak into the next test.
    document.querySelector<HTMLElement>(".cdk-overlay-backdrop")?.click();
  });

  beforeEach(async () => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);
    dialogService = mock<DialogService>();
    sendApiService = mock<SendApiService>();

    // Default to disabled to hide the create dropdown so its own dependencies don't need mocking
    disableSend$ = new BehaviorSubject(true);
    sendAuthRequired$ = new BehaviorSubject(false);
    const sendPolicyService: Partial<SendPolicyService> = {
      disableSend$,
      sendAuthRequired$,
      allowedSendTypes$: of([SendType.Text]),
    };
    const accountService: Partial<AccountService> = { activeAccount$: of(null) };

    await TestBed.configureTestingModule({
      imports: [SendTableV2Component],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: DialogService, useValue: dialogService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: SendApiService, useValue: sendApiService },
        { provide: SendPolicyService, useValue: sendPolicyService },
        { provide: AccountService, useValue: accountService },
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: ValidationService, useValue: mock<ValidationService>() },
        { provide: LogService, useValue: mock<LogService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendTableV2Component);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("sends", [createSend("1"), createSend("2")]);
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should render without throwing while Sends are still loading", () => {
    fixture.componentRef.setInput("sends", undefined);

    expect(() => fixture.detectChanges()).not.toThrow();
  });

  describe("editSend", () => {
    it("should emit the Send once when its name button is clicked", () => {
      const emitSpy = jest.spyOn(component.editSend, "emit");
      const nameButton = fixture.debugElement
        .queryAll(By.css("bit-cell"))[0]
        .query(By.css("button"));

      nameButton.nativeElement.click();

      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
    });
  });

  describe("addSend", () => {
    it("should emit the chosen SendType", () => {
      const emitSpy = jest.spyOn(component.addSend, "emit");

      component["onAddSend"](SendType.File);

      expect(emitSpy).toHaveBeenCalledWith(SendType.File);
    });
  });

  describe("remove authentication", () => {
    const passwordSend = () =>
      createSend("1", { authType: AuthType.Password, password: "hash" } as Partial<SendView>);

    function render(send: SendView, { disableSend = false, sendAuthRequired = false } = {}) {
      // Keep the create dropdown hidden now that Sends may be enabled
      fixture.componentRef.setInput("showCreateButtons", false);
      fixture.componentRef.setInput("sends", [send]);
      disableSend$.next(disableSend);
      sendAuthRequired$.next(sendAuthRequired);
      fixture.detectChanges();
    }

    /** Opens the row's options menu and returns the text of each menu item. */
    function openMenuItems(): string[] {
      const trigger = fixture.debugElement.query(By.directive(MenuTriggerForDirective));
      (trigger.nativeElement as HTMLButtonElement).click();
      fixture.detectChanges();

      // The menu renders in a CDK overlay outside the fixture's root element.
      return Array.from(document.querySelectorAll(".bit-menu-panel [bitMenuItem]")).map(
        (item) => item.textContent?.trim() ?? "",
      );
    }

    it("shows the remove option when no policy restricts it", () => {
      render(passwordSend());

      expect(openMenuItems()).toContain("removePassword");
    });

    it("hides the remove option when policy requires Sends to have authentication", () => {
      render(passwordSend(), { sendAuthRequired: true });

      const items = openMenuItems();

      expect(items).toContain("copySendLink");
      expect(items).not.toContain("removePassword");
    });

    it("hides the remove option when Send is disabled by policy", () => {
      render(passwordSend(), { disableSend: true });

      expect(openMenuItems()).not.toContain("removePassword");
    });

    it("hides the remove option for Sends that don't comply with policy", () => {
      render(
        createSend("1", {
          authType: AuthType.Password,
          password: "hash",
          disabled: true,
        } as Partial<SendView>),
      );

      expect(openMenuItems()).not.toContain("removePassword");
    });

    it("does not remove authentication when policy requires it", async () => {
      const send = passwordSend();
      render(send, { sendAuthRequired: true });

      await component["onRemoveAuth"](send);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(sendApiService.removeAuth).not.toHaveBeenCalled();
    });

    it("removes authentication after confirmation when allowed", async () => {
      const send = passwordSend();
      render(send);
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await component["onRemoveAuth"](send);

      expect(sendApiService.removeAuth).toHaveBeenCalledWith("1");
    });
  });
});
