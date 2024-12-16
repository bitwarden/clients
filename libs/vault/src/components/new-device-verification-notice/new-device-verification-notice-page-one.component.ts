import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormControl, ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { firstValueFrom, map, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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

import { NewDeviceVerificationNoticeService } from "./../../services/new-device-verification-notice.service";

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
  protected formMessage: string | null = "";
  protected formGroup = this.formBuilder.group({
    hasEmailAccess: new FormControl(0),
  });
  protected isDesktop: boolean;
  readonly currentAcct$: Observable<Account | null> = this.accountService.activeAccount$.pipe(
    map((acct) => acct),
  );
  private currentEmail: string = "";
  private currentUserId: UserId | null = null;

  constructor(
    private i18nService: I18nService,
    private formBuilder: FormBuilder,
    private router: Router,
    private accountService: AccountService,
    private newDeviceVerificationNoticeService: NewDeviceVerificationNoticeService,
    private platformUtilsService: PlatformUtilsService,
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
    this.formMessage = this.i18nService.t(
      "newDeviceVerificationNoticePageOneFormContent",
      this.currentEmail,
    );
  }

  submit = async () => {
    const doesNotHaveEmailAccess = this.formGroup.controls.hasEmailAccess.value === 0;

    await this.newDeviceVerificationNoticeService.updateNewDeviceVerificationNoticeState(
      this.currentUserId,
      {
        last_dismissal: new Date(),
        permanent_dismissal: !doesNotHaveEmailAccess,
      },
    );

    if (doesNotHaveEmailAccess) {
      await this.router.navigate(["new-device-notice/setup"]);
      return;
    }

    await this.router.navigate(["/vault"]);
  };
}
