// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { combineLatest, switchMap, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import {
  TypographyModule,
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
} from "@bitwarden/components";

import { SendFormConfig } from "../../abstractions/send-form-config.service";
import { SendFormContainer } from "../../send-form-container";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-send-options",
  templateUrl: "./send-options.component.html",
  standalone: true,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CardComponent,
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    IconButtonModule,
    JslibModule,
    ReactiveFormsModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    TypographyModule,
  ],
})
export class SendOptionsComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true })
  config: SendFormConfig;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  originalSendView: SendView;
  disableHideEmail = false;

  sendOptionsForm = this.formBuilder.group({
    maxAccessCount: [null as number],
    accessCount: [null as number],
    notes: [null as string],
    hideEmail: [false as boolean],
  });

  get shouldShowCount(): boolean {
    return this.config.mode === "edit" && this.sendOptionsForm.value.maxAccessCount !== null;
  }

  get viewsLeft() {
    return String(
      this.sendOptionsForm.value.maxAccessCount
        ? this.sendOptionsForm.value.maxAccessCount - this.sendOptionsForm.value.accessCount
        : 0,
    );
  }

  constructor(
    private sendFormContainer: SendFormContainer,
    private formBuilder: FormBuilder,
    private policyService: PolicyService,
    private accountService: AccountService,
    private configService: ConfigService,
  ) {
    this.sendFormContainer.registerChildForm("sendOptionsForm", this.sendOptionsForm);

    combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.SendControls),
      this.accountService.activeAccount$.pipe(getUserId),
    ])
      .pipe(
        switchMap(([sendControlsEnabled, userId]) =>
          sendControlsEnabled
            ? this.policyService
                .policiesByType$(PolicyType.SendControls, userId)
                .pipe(
                  map(
                    (policies) => policies?.some((p) => p.data?.disableHideEmail === true) ?? false,
                  ),
                )
            : this.policyService
                .policiesByType$(PolicyType.SendOptions, userId)
                .pipe(map((policies) => policies?.some((p) => p.data?.disableHideEmail) ?? false)),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((disableHideEmail) => {
        this.disableHideEmail = disableHideEmail;
      });

    this.sendOptionsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.sendFormContainer.patchSend((send) => {
        Object.assign(send, {
          maxAccessCount: value.maxAccessCount,
          accessCount: value.accessCount,
          hideEmail: value.hideEmail,
          notes: value.notes,
        });
        return send;
      });
    });
  }

  ngOnInit() {
    if (this.sendFormContainer.originalSendView) {
      this.sendOptionsForm.patchValue({
        maxAccessCount: this.sendFormContainer.originalSendView.maxAccessCount,
        accessCount: this.sendFormContainer.originalSendView.accessCount,
        hideEmail: this.sendFormContainer.originalSendView.hideEmail,
        notes: this.sendFormContainer.originalSendView.notes,
      });
    }

    if (!this.config.areSendsAllowed) {
      this.sendOptionsForm.disable();
    }
  }
}
