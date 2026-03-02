// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, inject, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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
import { SendPolicyService, SendFormConfig } from "@bitwarden/send-ui";

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

  private sendPolicyService = inject(SendPolicyService);

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
  ) {
    this.sendFormContainer.registerChildForm("sendOptionsForm", this.sendOptionsForm);

    this.sendPolicyService.disableHideEmail$
      .pipe(takeUntilDestroyed())
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
