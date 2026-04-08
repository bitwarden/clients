import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { UntypedFormBuilder } from "@angular/forms";
import { Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class SendControlsPolicy extends BasePolicyEditDefinition {
  name = "sendControls";
  description = "sendControlsPolicyDesc";
  type = PolicyType.SendControls;
  category = PolicyCategory.DataControl;
  priority = 30;
  component = SendControlsPolicyComponent;

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.SendControls);
  }
}

@Component({
  selector: "send-controls-policy-edit",
  templateUrl: "send-controls.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendControlsPolicyComponent extends BasePolicyEditComponent implements OnInit {
  readonly data = this.formBuilder.group({
    disableSend: false,
    disableHideEmail: false,
  });

  constructor(private readonly formBuilder: UntypedFormBuilder) {
    super();
  }

  async ngOnInit() {
    super.ngOnInit();
  }
}
