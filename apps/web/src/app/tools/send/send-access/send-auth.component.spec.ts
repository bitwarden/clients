import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  SendAccessToken,
  SendTokenService,
  TryGetSendAccessTokenError,
} from "@bitwarden/common/auth/send-access";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { AnonLayoutWrapperDataService, ToastService } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { CryptoFunctionService } from "@bitwarden/legacy-crypto";

import { SendAuthComponent } from "./send-auth.component";

describe("SendAuthComponent", () => {
  let fixture: ComponentFixture<SendAuthComponent>;
  let sendTokenService: MockProxy<SendTokenService>;
  let emitted: SendAccessToken[];

  const validToken = () => new SendAccessToken("token", Date.now() + 60_000);
  const expiredToken = () => new SendAccessToken("expired-token", Date.now() - 60_000);

  async function setup(firstResponse: SendAccessToken | TryGetSendAccessTokenError) {
    sendTokenService = mock<SendTokenService>();
    sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(firstResponse));

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [SendAuthComponent],
      providers: [
        { provide: CryptoFunctionService, useValue: mock<CryptoFunctionService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: i18nService },
        { provide: SendTokenService, useValue: sendTokenService },
        { provide: AnonLayoutWrapperDataService, useValue: mock<AnonLayoutWrapperDataService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendAuthComponent);
    fixture.componentRef.setInput("id", "send-id");
    fixture.componentRef.setInput("key", "send-key");
    emitted = [];
    fixture.componentInstance["accessGranted"].subscribe((event) =>
      emitted.push(event.accessToken),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const openButton = () =>
    fixture.nativeElement.querySelector("#send-access_button_open") as HTMLButtonElement | null;

  const selectOpen = async () => {
    openButton()!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it("does not load a Send with no password or email until Open is selected", async () => {
    await setup(validToken());

    expect(emitted).toEqual([]);
    expect(openButton()).not.toBeNull();
  });

  it("loads the Send with the held token when Open is selected", async () => {
    const token = validToken();
    await setup(token);

    await selectOpen();

    expect(emitted).toEqual([token]);
    expect(sendTokenService.tryGetSendAccessToken$).toHaveBeenCalledTimes(1);
    expect(openButton()).toBeNull();
  });

  it("requests a new token when the held one expired before Open was selected", async () => {
    await setup(expiredToken());
    const fresh = validToken();
    sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(fresh));

    await selectOpen();

    expect(emitted).toEqual([fresh]);
    expect(sendTokenService.tryGetSendAccessToken$).toHaveBeenCalledTimes(2);
  });

  it("does not show Open for a Send protected by a password", async () => {
    await setup({
      kind: "expected_server",
      error: {
        error: "invalid_request",
        send_access_error_type: "password_hash_b64_required",
      },
    } as TryGetSendAccessTokenError);

    expect(openButton()).toBeNull();
    expect(emitted).toEqual([]);
  });
});
