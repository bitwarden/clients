// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

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
import { SendPolicyService } from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendFormService } from "../../abstractions/send-form.service";

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
    I18nPipe,
    ReactiveFormsModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    TypographyModule,
  ],
})
export class SendOptionsComponent implements OnInit {
  protected sendFormService = inject(SendFormService);
  private formBuilder = inject(FormBuilder);

  disableHideEmail = false;

  sendOptionsForm = this.formBuilder.group({
    maxAccessCount: [null as number],
    accessCount: [null as number],
    notes: [null as string],
    hideEmail: [false as boolean],
  });

  private sendPolicyService = inject(SendPolicyService);

  get shouldShowCount(): boolean {
    return (
      this.sendFormService.sendFormConfig.mode === "edit" &&
      this.sendOptionsForm.value.maxAccessCount !== null
    );
  }

  get viewsLeft() {
    return String(
      this.sendOptionsForm.value.maxAccessCount
        ? this.sendOptionsForm.value.maxAccessCount - this.sendOptionsForm.value.accessCount
        : 0,
    );
  }

  constructor() {
    this.sendFormService.registerChildForm("sendOptionsForm", this.sendOptionsForm);

    this.sendPolicyService.disableHideEmail$
      .pipe(takeUntilDestroyed())
      .subscribe((disableHideEmail) => {
        this.disableHideEmail = disableHideEmail;
      });

    this.sendOptionsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.sendFormService.patchSend((send) => {
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
    if (this.sendFormService.originalSendView) {
      this.sendOptionsForm.patchValue({
        maxAccessCount: this.sendFormService.originalSendView.maxAccessCount,
        accessCount: this.sendFormService.originalSendView.accessCount,
        hideEmail: this.sendFormService.originalSendView.hideEmail,
        notes: this.sendFormService.originalSendView.notes,
      });
    }

    if (!this.sendFormService.sendFormConfig.areSendsAllowed) {
      this.sendOptionsForm.disable();
    }
  }
}
