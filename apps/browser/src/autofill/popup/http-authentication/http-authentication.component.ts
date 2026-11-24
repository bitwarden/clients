import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  signal,
  viewChildren,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, map, switchMap } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ItemModule, LinkModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { PasswordRepromptService } from "@bitwarden/vault";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { CipherUse, FillCipherPolicy } from "../../services/abstractions/fill-cipher-policy";
import {
  HttpAuthenticationPopoutMessage,
  HttpAuthenticationSelectionResponse,
} from "../../utils/http-authentication-popout";

/**
 * Asks the user which login, if any, answers a website's browser login pop-up prompt. Choosing
 * "Use browser instead", or closing the window, leaves the prompt to the browser.
 */
@Component({
  selector: "app-http-authentication",
  templateUrl: "http-authentication.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    I18nPipe,
    IconComponent,
    ItemModule,
    LinkModule,
    PopupHeaderComponent,
    PopupPageComponent,
  ],
})
export class HttpAuthenticationComponent {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly accountService = inject(AccountService);
  private readonly fillCipherPolicy = inject(FillCipherPolicy);
  private readonly passwordRepromptService = inject(PasswordRepromptService);

  // `bit-item-content` is a component, so the reference is read as the button element itself.
  private readonly loginButtons = viewChildren("loginButton", {
    read: ElementRef<HTMLButtonElement>,
  });

  private readonly queryParameters$ = this.activatedRoute.queryParamMap.pipe(
    map((queryParamMap) => ({
      sessionId: queryParamMap.get("sessionId"),
      requestOrigin: queryParamMap.get("requestOrigin") ?? "",
      cipherIds: (queryParamMap.get("cipherIds") ?? "").split(",").filter(Boolean),
    })),
  );

  private readonly queryParameters = toSignal(this.queryParameters$);

  /** The origin of the website asking for credentials. */
  protected readonly requestOrigin = toSignal(
    this.queryParameters$.pipe(map(({ requestOrigin }) => requestOrigin)),
    { initialValue: "" },
  );

  /** The logins offered for the prompt, in the order the background offered them. */
  protected readonly ciphers = toSignal(
    combineLatest([this.queryParameters$, this.accountService.activeAccount$.pipe(getUserId)]).pipe(
      switchMap(async ([{ cipherIds }, userId]) => {
        const offeredCiphers = await this.fillCipherPolicy.ciphersForIds(
          userId,
          cipherIds,
          CipherUse.AutomaticFill,
        );

        return cipherIds
          .map((cipherId) => offeredCiphers.find((cipher) => cipher.id === cipherId))
          .filter((cipher): cipher is CipherView => cipher != null);
      }),
    ),
    { initialValue: [] as CipherView[] },
  );

  protected readonly submitting = signal(false);

  constructor() {
    let focusedFirstLogin = false;

    // The logins load after the window opens, so the first one is focused once it has rendered.
    effect(() => {
      const [firstLoginButton] = this.loginButtons();

      if (focusedFirstLogin || firstLoginButton == null) {
        return;
      }

      focusedFirstLogin = true;
      firstLoginButton.nativeElement.focus();
    });
  }

  protected async selectCipher(cipher: CipherView) {
    if (this.submitting()) {
      return;
    }

    // A login with master password reprompt on is released only after the user confirms their master
    // password. Cancelling returns to the list.
    if (
      cipher.reprompt !== CipherRepromptType.None &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      return;
    }

    this.submitting.set(true);
    await this.sendSelectionResponse(cipher.id);
  }

  protected async useBrowserPrompt() {
    this.submitting.set(true);
    await this.sendSelectionResponse(undefined);
  }

  private async sendSelectionResponse(cipherId: string | undefined) {
    const sessionId = this.queryParameters()?.sessionId;

    if (sessionId != null) {
      const response: Omit<HttpAuthenticationSelectionResponse, "command"> = {
        sessionId,
        cipherId,
      };

      await BrowserApi.sendMessage(HttpAuthenticationPopoutMessage.SelectionResponse, response);
    }

    window.close();
  }
}
