import { Directive, EventEmitter, OnInit, Output } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  TwoFactorProviderDetails,
  TwoFactorService,
} from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Directive()
export class TwoFactorOptionsComponentV1 implements OnInit {
  @Output() onProviderSelected = new EventEmitter<TwoFactorProviderType>();
  @Output() onRecoverSelected = new EventEmitter();

  providers: any[] = [];

  constructor(
    protected twoFactorService: TwoFactorService,
    protected router: Router,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected win: Window,
    protected environmentService: EnvironmentService,
  ) {}

  async ngOnInit() {
    this.providers = await this.twoFactorService.getSupportedProviders(this.win);
  }

  async choose(p: TwoFactorProviderDetails) {
    this.onProviderSelected.emit(p.type);
  }

  async recover() {
    const env = await firstValueFrom(this.environmentService.environment$);
    const webVault = env.getWebVaultUrl();
    this.platformUtilsService.launchUri(webVault + "/#/recover-2fa");
    this.onRecoverSelected.emit();
  }
}
