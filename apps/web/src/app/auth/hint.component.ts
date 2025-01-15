// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { HintComponent as BaseHintComponent } from "@bitwarden/angular/auth/components/hint.component";
import { LoginEmailServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

@Component({
  selector: "app-hint",
  templateUrl: "hint.component.html",
})
export class HintComponent extends BaseHintComponent implements OnInit {
  formGroup = this.formBuilder.group({
    email: ["", [Validators.email, Validators.required]],
  });

  get emailFormControl() {
    return this.formGroup.controls.email;
  }

  constructor(
    router: Router,
    i18nService: I18nService,
    apiService: ApiService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    loginEmailService: LoginEmailServiceAbstraction,
    private formBuilder: FormBuilder,
    protected toastService: ToastService,
  ) {
    super(
      router,
      i18nService,
      apiService,
      platformUtilsService,
      logService,
      loginEmailService,
      toastService,
    );
  }

  async ngOnInit(): Promise<void> {
    await super.ngOnInit();
    this.emailFormControl.setValue(this.email);
  }

  // Wrapper method to call super.submit() since properties (e.g., submit) cannot use super directly
  // This is because properties are assigned per type and generally don't have access to the prototype
  async superSubmit() {
    await super.submit();
  }

  submit = async () => {
    this.email = this.emailFormControl.value;
    await this.superSubmit();
  };
}
