import { DestroyRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { ToastService } from "@bitwarden/components";

import { SendFormService } from "../abstractions/send-form.service";

import { SendFormComponent } from "./send-form.component";

describe("SendFormComponent", () => {
  let component: SendFormComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<SendFormComponent>>;
  let sendFormService: MockProxy<SendFormService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    sendFormService = mock<SendFormService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    const environmentService = mock<EnvironmentService>();
    (environmentService as any).environment$ = of({ getSendUrl: () => "https://send.example" });

    await TestBed.configureTestingModule({
      providers: [
        { provide: SendFormService, useValue: sendFormService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: EnvironmentService, useValue: environmentService },
        DestroyRef,
      ],
    }).compileComponents();

    // Constructed without `fixture.detectChanges()` so the `config`/`formId` required inputs
    // and the `viewChild.required(BitSubmitDirective)` (only read from `ngAfterViewInit`) never
    // need to be satisfied — `submit()` touches neither.
    fixture = TestBed.createComponent(SendFormComponent);
    component = fixture.componentInstance;
  });

  it("emits onSendCreated and shows no error toast when the save succeeds", async () => {
    fixture.componentRef.setInput("config", { mode: "add" });
    const sendView = new SendView();
    sendFormService.submitSendForm.mockResolvedValue(sendView);
    const emitSpy = jest.spyOn(component.onSendCreated, "emit");

    await component.submit();

    expect(emitSpy).toHaveBeenCalledWith(sendView);
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it("does nothing when submitSendForm resolves falsy (validation failure)", async () => {
    sendFormService.submitSendForm.mockResolvedValue(undefined);
    const emitSpy = jest.spyOn(component.onSendCreated, "emit");

    await component.submit();

    expect(emitSpy).not.toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it("shows an error toast instead of throwing when submitSendForm rejects", async () => {
    sendFormService.submitSendForm.mockRejectedValue(new Error("boom"));
    const emitSpy = jest.spyOn(component.onSendCreated, "emit");

    await expect(component.submit()).resolves.toBeUndefined();

    expect(emitSpy).not.toHaveBeenCalled();
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
  });
});
