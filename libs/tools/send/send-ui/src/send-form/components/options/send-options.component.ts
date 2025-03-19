// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { BehaviorSubject, firstValueFrom, map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { pin } from "@bitwarden/common/tools/rx";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import {
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { CredentialGeneratorService, GenerateRequest, Generators } from "@bitwarden/generator-core";

import { SendFormConfig } from "../../abstractions/send-form-config.service";
import { SendFormContainer } from "../../send-form-container";

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
    TypographyModule,
  ],
})
export class SendOptionsComponent implements OnInit {
  @Input({ required: true })
  config: SendFormConfig;
  @Input()
  originalSendView: SendView;
  disableHideEmail = false;
  passwordRemoved = false;
  sendOptionsForm = this.formBuilder.group({
    maxAccessCount: [null as number],
    accessCount: [null as number],
    notes: [null as string],
    password: [null as string],
    hideEmail: [false as boolean],
  });

  get hasPassword(): boolean {
    return this.originalSendView && this.originalSendView.password !== null;
  }

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
    private dialogService: DialogService,
    private sendApiService: SendApiService,
    private formBuilder: FormBuilder,
    private policyService: PolicyService,
    private i18nService: I18nService,
    private toastService: ToastService,
    private generatorService: CredentialGeneratorService,
    private accountService: AccountService,
  ) {
    this.sendFormContainer.registerChildForm("sendOptionsForm", this.sendOptionsForm);

    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) => this.policyService.getAll$(PolicyType.SendOptions, userId)),
        map((policies) => policies?.some((p) => p.data.disableHideEmail)),
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
          password: value.password,
          hideEmail: value.hideEmail,
          notes: value.notes,
        });
        return send;
      });
    });
  }

  generatePassword = async () => {
    const on$ = new BehaviorSubject<GenerateRequest>({ source: "send" });
    const account$ = this.accountService.activeAccount$.pipe(
      pin({ name: () => "send-options.component", distinct: (p, c) => p.id === c.id }),
    );
    const generatedCredential = await firstValueFrom(
      this.generatorService.generate$(Generators.password, { on$, account$ }),
    );

    this.sendOptionsForm.patchValue({
      password: generatedCredential.credential,
    });
  };

  removePassword = async () => {
    if (!this.originalSendView || !this.originalSendView.password) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removePassword" },
      content: { key: "removePasswordConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    this.passwordRemoved = true;

    await this.sendApiService.removePassword(this.originalSendView.id);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("removedPassword"),
    });

    this.originalSendView.password = null;
    this.sendOptionsForm.patchValue({
      password: null,
    });
    this.sendOptionsForm.get("password")?.enable();
  };

  ngOnInit() {
    if (this.sendFormContainer.originalSendView) {
      this.sendOptionsForm.patchValue({
        maxAccessCount: this.sendFormContainer.originalSendView.maxAccessCount,
        accessCount: this.sendFormContainer.originalSendView.accessCount,
        password: this.hasPassword ? "************" : null, // 12 masked characters as a placeholder
        hideEmail: this.sendFormContainer.originalSendView.hideEmail,
        notes: this.sendFormContainer.originalSendView.notes,
      });
    }
    if (this.hasPassword) {
      this.sendOptionsForm.get("password")?.disable();
    }

    if (!this.config.areSendsAllowed) {
      this.sendOptionsForm.disable();
    }
  }
}
