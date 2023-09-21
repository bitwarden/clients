import { Directive, EventEmitter, OnInit, Output } from "@angular/core";
import { Router } from "@angular/router";

import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Directive()
export class TwoFactorOptionsComponent implements OnInit {
  @Output() onProviderSelected = new EventEmitter<TwoFactorProviderType>();
  @Output() onRecoverSelected = new EventEmitter();

  providers: any[] = [];

  constructor(
    protected twoFactorService: TwoFactorService,
    protected router: Router,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected win: Window
  ) {}

  ngOnInit() {
    this.providers = this.twoFactorService.getSupportedProviders(this.win);
  }

  choose(p: any) {
    this.onProviderSelected.emit(p.type);
  }

  recover() {
    this.platformUtilsService.launchUri("https://vault.bitwarden.com/#/recover-2fa");
    this.onRecoverSelected.emit();
  }
}
