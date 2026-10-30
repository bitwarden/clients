import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { SendAccessToken } from "@bitwarden/common/auth/send-access";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendDecryptionService } from "@bitwarden/common/tools/send/services/send-decryption.service";
import { AnonLayoutWrapperDataService, ToastService } from "@bitwarden/components";

import { SendViewComponent } from "./send-view.component";

/** The shape the SDK gives its errors: a plain `Error` with a `name` and a `variant`. */
const sdkError = (name: string, variant: string) => Object.assign(new Error(""), { name, variant });

describe("SendViewComponent", () => {
  let fixture: ComponentFixture<SendViewComponent>;
  let component: SendViewComponent;
  let sendApiService: MockProxy<SendApiService>;

  beforeEach(async () => {
    sendApiService = mock<SendApiService>();

    await TestBed.configureTestingModule({
      imports: [SendViewComponent],
      providers: [
        { provide: SendApiService, useValue: sendApiService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: AnonLayoutWrapperDataService, useValue: mock<AnonLayoutWrapperDataService>() },
        { provide: SendDecryptionService, useValue: mock<SendDecryptionService>() },
      ],
    })
      // Only the load outcome is under test, not the rendered Send.
      .overrideComponent(SendViewComponent, { set: { template: "", imports: [] } })
      .compileComponents();

    fixture = TestBed.createComponent(SendViewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("id", "send-id");
    fixture.componentRef.setInput("key", "c2VuZC1rZXk");
    fixture.componentRef.setInput("accessToken", mock<SendAccessToken>());
  });

  async function loadWith(error: unknown) {
    sendApiService.postSendAccess.mockRejectedValue(error);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it("shows the Send as unavailable when the SDK reports it was not found", async () => {
    await loadWith(sdkError("AccessSendError", "NotFound"));

    expect(component.unavailable()).toBe(true);
    expect(component.error()).toBe(false);
  });

  it("shows the Send as unavailable when the server responds with a 404", async () => {
    await loadWith(new ErrorResponse(null, 404));

    expect(component.unavailable()).toBe(true);
    expect(component.error()).toBe(false);
  });

  it("shows the unexpected error for other SDK access errors", async () => {
    await loadWith(sdkError("AccessSendError", "Api"));

    expect(component.unavailable()).toBe(false);
    expect(component.error()).toBe(true);
  });

  it("shows the unexpected error for unrecognized errors", async () => {
    await loadWith(new Error("boom"));

    expect(component.unavailable()).toBe(false);
    expect(component.error()).toBe(true);
  });

  it("asks for authentication again when the access token is rejected", async () => {
    const authRequired = jest.fn();
    component.authRequired.subscribe(authRequired);

    await loadWith(new ErrorResponse(null, 401));

    expect(authRequired).toHaveBeenCalled();
    expect(component.unavailable()).toBe(false);
    expect(component.error()).toBe(false);
  });
});
