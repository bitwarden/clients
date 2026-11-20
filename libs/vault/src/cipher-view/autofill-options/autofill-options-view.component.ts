// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, computed, inject, Input, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, map, take } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { AutotypeFeatureFlagState } from "@bitwarden/common/desktop-native/enums/autotype-feature-flag-state.enum";
import {
  DESKTOP_APP_URI_PREFIX,
  DesktopAutotypePairingUri,
} from "@bitwarden/common/desktop-native/models/desktop-autotype-pairing-uri";
import { autotypeFeatureFlagState$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-autofill-options-view",
  templateUrl: "autofill-options-view.component.html",
  imports: [
    CommonModule,
    JslibModule,
    CardComponent,
    SectionHeaderComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
  ],
})
export class AutofillOptionsViewComponent {
  readonly loginUris = input<LoginUriView[]>([]);
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() cipherId: string;

  readonly activeUserId$ = getOptionalUserId(this.accountService.activeAccount$);

  private readonly configService = inject(ConfigService);
  private readonly i18nService = inject(I18nService);

  /**
   * Whether desktop app URIs are recognized as desktop apps, rather than shown as website URIs.
   * Desktop apps can be viewed on any client. The feature flag is read once, when the view opens,
   * so the URIs don't change while the user views them.
   */
  private readonly recognizeDesktopApps = toSignal(
    autotypeFeatureFlagState$(this.configService).pipe(
      map((state) => state === AutotypeFeatureFlagState.Ga),
      take(1),
    ),
    { initialValue: false },
  );

  /**
   * The login URIs to show. A desktop app URI is shown by the name of its paired desktop app, or
   * as an invalid app pairing, and its pairing URI is never shown.
   */
  protected readonly uris = computed(() =>
    (this.loginUris() ?? []).map((login) => ({
      login,
      desktopAppName: this.recognizeDesktopApps() ? this.getDesktopAppName(login) : null,
    })),
  );

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private accountService: AccountService,
  ) {}

  async openWebsite(selectedUri: string) {
    const activeUserId = await firstValueFrom(this.activeUserId$);
    // This component may be displayed in an anonymous context where the user is not logged in
    if (activeUserId) {
      await this.cipherService.updateLastLaunchedDate(this.cipherId, activeUserId);
    }
    this.platformUtilsService.launchUri(selectedUri);
  }

  /**
   * Returns the name of the paired desktop app, a label for an invalid app pairing when the desktop
   * app URI isn't a valid pairing URI, or `null` when the URI isn't a desktop app URI.
   */
  private getDesktopAppName(login: LoginUriView): string | null {
    if (!login.uri?.startsWith(DESKTOP_APP_URI_PREFIX)) {
      return null;
    }

    return (
      DesktopAutotypePairingUri.fromString(login.uri)?.data.appData.name ??
      this.i18nService.t("invalidAppPairing")
    );
  }
}
