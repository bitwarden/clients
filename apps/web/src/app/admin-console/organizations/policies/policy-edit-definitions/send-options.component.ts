import { ChangeDetectionStrategy, Component, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { UntypedFormBuilder } from "@angular/forms";
import { distinctUntilChanged, map } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class SendOptionsPolicy extends BasePolicyEditDefinition {
  name = "sendControls";
  description = "sendOptionsPolicyDesc";
  type = PolicyType.SendOptions;
  component = SendOptionsPolicyComponent;
}

@Component({
  selector: "send-options-policy-edit",
  templateUrl: "send-options.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendOptionsPolicyComponent extends BasePolicyEditComponent implements OnInit {
  data = this.formBuilder.group({
    disableSend: false,
    disableHideEmail: false,
    disableNoAuthSends: false,
    disablePasswordSends: false,
    disableEmailVerifiedSends: false,
  });

  constructor(
    private formBuilder: UntypedFormBuilder,
    private destroyRef: DestroyRef,
  ) {
    super();
  }

  protected override buildRequestData() {
    return this.data.getRawValue();
  }

  override ngOnInit() {
    super.ngOnInit();

    this.data.valueChanges
      .pipe(
        map(
          ({ disableNoAuthSends, disablePasswordSends, disableEmailVerifiedSends }) =>
            disableNoAuthSends && disablePasswordSends && disableEmailVerifiedSends,
        ),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((allAuthTypesDisabled) => {
        const disableSendControl = this.data.get("disableSend");
        if (allAuthTypesDisabled) {
          disableSendControl?.setValue(true, { emitEvent: false });
          disableSendControl?.disable({ emitEvent: false });
        } else {
          disableSendControl?.enable({ emitEvent: false });
        }
      });
  }
}
