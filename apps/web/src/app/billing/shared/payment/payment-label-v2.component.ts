// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { booleanAttribute, Component, Input, OnInit } from "@angular/core";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FormFieldModule } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

/**
 * Label that should be used for elements loaded via Stripe API.
 *
 * Applies the same label styles from CL form-field component when
 * the `ExtensionRefresh` flag is set.
 */
@Component({
  selector: "app-payment-label-v2",
  templateUrl: "./payment-label-v2.component.html",
  standalone: true,
  imports: [FormFieldModule, SharedModule],
})
export class PaymentLabelV2 implements OnInit {
  /** `id` of the associated input */
  @Input({ required: true }) for: string;
  /** Displays required text on the label */
  @Input({ transform: booleanAttribute }) required = false;

  protected extensionRefreshFlag = false;

  constructor(private configService: ConfigService) {}

  async ngOnInit(): Promise<void> {
    this.extensionRefreshFlag = await this.configService.getFeatureFlag(
      FeatureFlag.ExtensionRefresh,
    );
  }
}
