import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormControl, ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { firstValueFrom, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ClientType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  FormFieldModule,
  RadioButtonModule,
  TypographyModule,
} from "@bitwarden/components";

import {
  NewDeviceVerificationNotice,
  NewDeviceVerificationNoticeService,
} from "./../../services/new-device-verification-notice.service";

@Component({
  standalone: true,
  selector: "app-new-device-verification-notice-page-one",
  templateUrl: "./new-device-verification-notice-page-one.component.html",
  imports: [
    CardComponent,
    CommonModule,
    JslibModule,
    TypographyModule,
    ButtonModule,
    RadioButtonModule,
    FormFieldModule,
    AsyncActionsModule,
    ReactiveFormsModule,
  ],
})
export class NewDeviceVerificationNoticePageOneComponent implements OnInit {
  protected formGroup = this.formBuilder.group({
    hasEmailAccess: new FormControl(0),
  });
  protected isDesktop: boolean;
  readonly currentAcct$: Observable<Account | null> = this.accountService.activeAccount$;
  protected currentEmail: string = "";
  private currentUserId: UserId | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private accountService: AccountService,
    private newDeviceVerificationNoticeService: NewDeviceVerificationNoticeService,
    private platformUtilsService: PlatformUtilsService,
    private configService: ConfigService,
  ) {
    this.isDesktop = this.platformUtilsService.getClientType() === ClientType.Desktop;
  }

  async ngOnInit() {
    const currentAcct = await firstValueFrom(this.currentAcct$);
    if (!currentAcct) {
      return;
    }
    this.currentEmail = currentAcct.email;
    this.currentUserId = currentAcct.id;
  }

  submit = async () => {
    const doesNotHaveEmailAccess = this.formGroup.controls.hasEmailAccess.value === 0;

    if (doesNotHaveEmailAccess) {
      await this.router.navigate(["new-device-notice/setup"]);
      return;
    }

    const tempNoticeFlag = await this.configService.getFeatureFlag(
      FeatureFlag.NewDeviceVerificationTemporaryDismiss,
    );
    const permNoticeFlag = await this.configService.getFeatureFlag(
      FeatureFlag.NewDeviceVerificationPermanentDismiss,
    );

    let newNoticeState: NewDeviceVerificationNotice | null = null;

    // When the temporary flag is enabled, only update the `last_dismissal`
    if (tempNoticeFlag) {
      newNoticeState = {
        last_dismissal: new Date(),
        permanent_dismissal: false,
      };
    } else if (permNoticeFlag) {
      // When the per flag is enabled, only update the `last_dismissal`
      newNoticeState = {
        last_dismissal: new Date(),
        permanent_dismissal: true,
      };
    }

    // This shouldn't occur as the user shouldn't get here unless one of the flags is active.
    if (newNoticeState) {
      await this.newDeviceVerificationNoticeService.updateNewDeviceVerificationNoticeState(
        this.currentUserId!,
        newNoticeState,
      );
    }

    await this.router.navigate(["/vault"]);
  };
}
