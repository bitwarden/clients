// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, Input, OnInit, TemplateRef, ViewContainerRef } from "@angular/core";

import { AllowedFeatureFlagTypes, FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

/**
 * Directive that conditionally renders the element when the feature flag is enabled and/or
 * matches the value specified by {@link appIfFeatureValue}.
 *
 * When a feature flag is not found in the config service, the element is hidden.
 */
@Directive({
  selector: "[appIfFeature]",
})
export class IfFeatureDirective implements OnInit {
  /**
   * The feature flag to check.
   */
  @Input() appIfFeature: FeatureFlag;

  /**
   * Optional value to compare against the value of the feature flag in the config service.
   * @default true
   */
  @Input() appIfFeatureValue: AllowedFeatureFlagTypes = true;

  private hasView = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private configService: ConfigService,
    private logService: LogService,
  ) {}

  async ngOnInit() {
    try {
      const flagValue = await this.configService.getFeatureFlag(this.appIfFeature);

      if (this.appIfFeatureValue === flagValue) {
        if (!this.hasView) {
          this.viewContainer.createEmbeddedView(this.templateRef);
          this.hasView = true;
        }
      } else {
        this.viewContainer.clear();
        this.hasView = false;
      }
    } catch (e) {
      this.logService.error(e);
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
