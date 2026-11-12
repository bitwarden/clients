import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

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
import { DialogService, ToastService } from "@bitwarden/components";
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

describe("SendTableV2Component", () => {
  let fixture: ComponentFixture<SendTableV2Component>;
  let component: SendTableV2Component;
  let i18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    // Hide the create dropdown so its own dependencies don't need mocking
    const sendPolicyService: Partial<SendPolicyService> = {
      disableSend$: of(true),
      allowedSendTypes$: of([SendType.Text]),
    };
    const accountService: Partial<AccountService> = { activeAccount$: of(null) };

    await TestBed.configureTestingModule({
      imports: [SendTableV2Component],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: SendApiService, useValue: mock<SendApiService>() },
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
});
