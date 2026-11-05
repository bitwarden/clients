import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ButtonModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import {
  HttpAuthenticationPopoutMessage,
  HttpAuthenticationSelectionResponse,
} from "../../utils/http-authentication-popout";

/**
 * Asks the user which login, if any, answers an HTTP authentication challenge. Closing the
 * window without choosing leaves the challenge to the browser's own prompt.
 */
@Component({
  selector: "app-http-authentication",
  templateUrl: "http-authentication.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    ItemModule,
    JslibModule,
    PopupFooterComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
})
export class HttpAuthenticationComponent {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);

  private readonly queryParameters$ = this.activatedRoute.queryParamMap.pipe(
    map((queryParamMap) => ({
      sessionId: queryParamMap.get("sessionId"),
      requestUrl: queryParamMap.get("requestUrl"),
      cipherIds: (queryParamMap.get("cipherIds") ?? "").split(",").filter(Boolean),
    })),
  );

  private readonly queryParameters = toSignal(this.queryParameters$);

  protected readonly requestOrigin = computed(() => {
    const requestUrl = this.queryParameters()?.requestUrl;

    if (requestUrl == null) {
      return "";
    }

    try {
      return new URL(requestUrl).origin;
    } catch {
      return "";
    }
  });

  protected readonly ciphers = toSignal(
    combineLatest([
      this.queryParameters$,
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.cipherService.cipherViews$(userId)),
      ),
    ]).pipe(
      map(([{ cipherIds }, cipherViews]) =>
        cipherIds
          .map((cipherId) => cipherViews.find((cipherView) => cipherView.id === cipherId))
          .filter((cipherView): cipherView is CipherView => cipherView != null),
      ),
    ),
    { initialValue: [] as CipherView[] },
  );

  protected readonly submitting = signal(false);

  protected async selectCipher(cipher: CipherView) {
    if (this.submitting()) {
      return;
    }

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
