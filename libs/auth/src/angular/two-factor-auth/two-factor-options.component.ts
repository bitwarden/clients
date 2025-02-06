import { DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnInit, Output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import {
  ButtonModule,
  DialogModule,
  DialogService,
  IconModule,
  ItemModule,
  TypographyModule,
} from "@bitwarden/components";

import {
  TwoFactorAuthAuthenticatorIcon,
  TwoFactorAuthDuoIcon,
  TwoFactorAuthEmailIcon,
  TwoFactorAuthWebAuthnIcon,
  TwoFactorAuthYubicoIcon,
} from "../icons/two-factor-auth";

export enum TwoFactorOptionsDialogResult {
  Provider = "Provider selected",
  Recover = "Recover selected",
}

export type TwoFactorOptionsDialogResultType = {
  result: TwoFactorOptionsDialogResult;
  type: TwoFactorProviderType;
};

@Component({
  standalone: true,
  selector: "app-two-factor-options",
  templateUrl: "two-factor-options.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    TypographyModule,
    ItemModule,
    IconModule,
  ],
  providers: [],
})
export class TwoFactorOptionsComponent implements OnInit {
  @Output() onProviderSelected = new EventEmitter<TwoFactorProviderType>();
  @Output() onRecoverSelected = new EventEmitter();

  providers: any[] = [];
  TwoFactorProviderType = TwoFactorProviderType;

  readonly Icons = {
    TwoFactorAuthAuthenticatorIcon,
    TwoFactorAuthEmailIcon,
    TwoFactorAuthDuoIcon,
    TwoFactorAuthYubicoIcon,
    TwoFactorAuthWebAuthnIcon,
  };

  constructor(
    private twoFactorService: TwoFactorService,
    private dialogRef: DialogRef,
  ) {}

  async ngOnInit() {
    const providers = await this.twoFactorService.getSupportedProviders(window);
    providers.sort((a: any, b: any) => a.sort - b.sort);
    this.providers = providers;
  }

  async choose(p: any) {
    this.onProviderSelected.emit(p.type);
    this.dialogRef.close({ result: TwoFactorOptionsDialogResult.Provider, type: p.type });
  }

  static open(dialogService: DialogService) {
    return dialogService.open<TwoFactorOptionsDialogResultType>(TwoFactorOptionsComponent);
  }
}
