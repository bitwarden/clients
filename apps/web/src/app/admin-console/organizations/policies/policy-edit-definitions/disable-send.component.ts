import { ChangeDetectionStrategy, Component } from "@angular/core";
import { map, Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class DisableSendPolicy extends BasePolicyEditDefinition {
  name = "disableSend";
  description = "disableSendPolicyDesc";
  type = PolicyType.DisableSend;
  category = PolicyCategory.DataControl;
  priority = 40;
  component = DisableSendPolicyComponent;

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.SendControls).pipe(map((enabled) => !enabled));
  }
}

@Component({
  selector: "disable-send-policy-edit",
  templateUrl: "disable-send.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisableSendPolicyComponent extends BasePolicyEditComponent {}
