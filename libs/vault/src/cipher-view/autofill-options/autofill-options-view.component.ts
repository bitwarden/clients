// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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

import { DESKTOP_APP_URI_PREFIX } from "../../models/desktop-app-uri.constants";
const APP_URI_LABEL = "application";
const WEBSITE_URI_LABEL = "website";

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
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() loginUris: LoginUriView[];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() cipherId: string;

  private windowsDesktopAutotypeGA = false;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private accountService: AccountService,
    private configService: ConfigService,
  ) {
    this.configService
      .getFeatureFlag$(FeatureFlag.WindowsDesktopAutotypeGA)
      .pipe(takeUntilDestroyed())
      .subscribe((enabled) => {
        this.windowsDesktopAutotypeGA = enabled;
      });
  }

  protected getUriLabel(uri: LoginUriView): string {
    return this.windowsDesktopAutotypeGA && uri.uri?.startsWith(DESKTOP_APP_URI_PREFIX)
      ? APP_URI_LABEL
      : WEBSITE_URI_LABEL;
  }

  protected isAppUri(uri: LoginUriView): boolean {
    return this.windowsDesktopAutotypeGA && (uri.uri?.startsWith(DESKTOP_APP_URI_PREFIX) ?? false);
  }

  async openWebsite(selectedUri: string) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.updateLastLaunchedDate(this.cipherId, activeUserId);
    this.platformUtilsService.launchUri(selectedUri);
  }
}
