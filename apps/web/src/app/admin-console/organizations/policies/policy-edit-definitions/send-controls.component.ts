import { ChangeDetectionStrategy, Component, DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ReactiveFormsModule, UntypedFormBuilder } from "@angular/forms";
import type { Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  CalloutModule,
  CheckboxModule,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { SendControlsPolicyDialogComponent } from "../policy-edit-dialogs/send-controls-policy-dialog.component";

export class SendControlsPolicy extends BasePolicyEditDefinition {
  name = "sendControls";
  description = "sendControlsPolicyDesc";
  type = PolicyType.DisableSend;
  component = SendControlsPolicyComponent;
  editDialogComponent = SendControlsPolicyDialogComponent;
  showDescription = false;

  override display$(_org: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.SendControls);
  }

  override isEnabled(policiesEnabledMap: Map<PolicyType, boolean>): boolean {
    return (
      (policiesEnabledMap.get(PolicyType.DisableSend) ?? false) ||
      (policiesEnabledMap.get(PolicyType.SendOptions) ?? false)
    );
  }
}

@Component({
  selector: "send-controls-policy-edit",
  templateUrl: "send-controls.component.html",
  imports: [
    CalloutModule,
    CheckboxModule,
    FormFieldModule,
    I18nPipe,
    ReactiveFormsModule,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendControlsPolicyComponent extends BasePolicyEditComponent {
  readonly data = this.formBuilder.group({
    disableSend: [false],
    disableHideEmail: [false],
  });

  private readonly destroyRef = inject(DestroyRef);

  constructor(private readonly formBuilder: UntypedFormBuilder) {
    super();
    this.enabled.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((enabled) => {
      this.toggleDataControls(enabled ?? false);
    });
  }

  override ngOnInit() {
    super.ngOnInit();
    this.toggleDataControls(this.enabled.value ?? false);
  }

  private toggleDataControls(enabled: boolean) {
    if (enabled) {
      this.data.enable();
    } else {
      this.data.disable();
    }
  }
}
