import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { ItemModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { PasswordRepromptService } from "@bitwarden/vault";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { AutofillMessageCommand } from "../../enums/autofill-message.enums";
import { CipherUse, FillCipherPolicy } from "../../services/abstractions/fill-cipher-policy";

import { HttpAuthenticationComponent } from "./http-authentication.component";

describe("HttpAuthenticationComponent", () => {
  const userId = "user-id" as UserId;
  const sessionId = "session-id";

  let fixture: ComponentFixture<HttpAuthenticationComponent>;
  let fillCipherPolicy: MockProxy<FillCipherPolicy>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let sendMessage: jest.SpyInstance;
  let closeWindow: jest.SpyInstance;

  const createLogin = (id: string, name: string, username: string, reprompt = false) => {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.name = name;
    cipher.type = CipherType.Login;
    cipher.reprompt = reprompt ? CipherRepromptType.Password : CipherRepromptType.None;
    cipher.login = new LoginView();
    cipher.login.username = username;
    return cipher;
  };

  const loginButtons = (): HTMLButtonElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll("button[id^='http-authentication_button_select-']"),
    );

  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    const vault = [
      createLogin("first-id", "Company intranet", "user@example.com"),
      createLogin("second-id", "Staging", "admin@example.com", true),
      createLogin("not-offered-id", "Unrelated", "other@example.com"),
    ];
    fillCipherPolicy = mock<FillCipherPolicy>();
    // Returned in reverse order, so the list must follow the order the background offered.
    fillCipherPolicy.ciphersForIds.mockImplementation(async (_userId, ids) =>
      vault.filter((cipher) => ids.includes(cipher.id)).reverse(),
    );
    passwordRepromptService = mock<PasswordRepromptService>();
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId, ...mockAccountInfoWith() });
    sendMessage = jest.spyOn(BrowserApi, "sendMessage").mockImplementation();
    closeWindow = jest.spyOn(window, "close").mockImplementation();

    await TestBed.configureTestingModule({
      imports: [HttpAuthenticationComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(
              convertToParamMap({
                sessionId,
                requestOrigin: "https://intranet.example.com",
                cipherIds: "first-id,second-id",
              }),
            ),
          },
        },
        { provide: AccountService, useValue: accountService },
        { provide: FillCipherPolicy, useValue: fillCipherPolicy },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: string[]) => [key, ...args].join(" ") },
        },
      ],
    })
      .overrideComponent(HttpAuthenticationComponent, {
        // The login rows render the real `bit-item-content`, so the first-login focus is checked
        // against the component the template actually uses.
        set: { imports: [I18nPipe, ItemModule], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HttpAuthenticationComponent);
    await render();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lists only the offered logins, in the order offered", () => {
    expect(loginButtons().map((button) => button.id)).toEqual([
      "http-authentication_button_select-first-id",
      "http-authentication_button_select-second-id",
    ]);
  });

  it("decrypts only the offered logins, for an automatic fill", () => {
    expect(fillCipherPolicy.ciphersForIds).toHaveBeenCalledWith(
      userId,
      ["first-id", "second-id"],
      CipherUse.AutomaticFill,
    );
  });

  it("names the request's origin in the window title", () => {
    const header = fixture.debugElement.query(By.css("popup-header"));

    expect(header.properties.pageTitle.trim()).toBe(
      "fillLoginPopUpPromptsLogInTo https://intranet.example.com",
    );
  });

  it("names the request's origin in the list's accessible name", () => {
    const list: HTMLElement = fixture.nativeElement.querySelector(
      "#http-authentication_list_logins",
    );

    expect(list.getAttribute("aria-label")?.trim()).toBe(
      "fillLoginPopUpPromptsChooseLogin https://intranet.example.com",
    );
  });

  it("focuses the first login when the window opens", () => {
    expect(document.activeElement).toBe(loginButtons()[0]);
  });

  it("sends the selected login and closes the window", async () => {
    loginButtons()[0].click();
    await fixture.whenStable();

    expect(sendMessage).toHaveBeenCalledWith(
      AutofillMessageCommand.httpAuthenticationSelectionResponse,
      {
        sessionId,
        cipherId: "first-id",
      },
    );
    expect(closeWindow).toHaveBeenCalled();
  });

  it("asks for the master password before sending a reprompt-protected login", async () => {
    passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);

    loginButtons()[1].click();
    await fixture.whenStable();

    expect(passwordRepromptService.showPasswordPrompt).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      AutofillMessageCommand.httpAuthenticationSelectionResponse,
      {
        sessionId,
        cipherId: "second-id",
      },
    );
  });

  it("returns to the list when the master password confirmation is cancelled", async () => {
    passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

    loginButtons()[1].click();
    await fixture.whenStable();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(closeWindow).not.toHaveBeenCalled();
    expect(loginButtons()[0].disabled).toBe(false);
  });

  it("does not ask for the master password for a login without reprompt", async () => {
    loginButtons()[0].click();
    await fixture.whenStable();

    expect(passwordRepromptService.showPasswordPrompt).not.toHaveBeenCalled();
  });

  it("sends no login when the user chooses the browser prompt instead", async () => {
    (
      fixture.nativeElement.querySelector(
        "#http-authentication_button_use-browser-instead",
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    expect(sendMessage).toHaveBeenCalledWith(
      AutofillMessageCommand.httpAuthenticationSelectionResponse,
      {
        sessionId,
        cipherId: undefined,
      },
    );
    expect(closeWindow).toHaveBeenCalled();
  });
});
