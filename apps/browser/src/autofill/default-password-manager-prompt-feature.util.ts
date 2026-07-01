import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

export function isDefaultPasswordManagerPromptFeatureEnabled(
  configService: ConfigService,
): Promise<boolean> {
  return configService.getFeatureFlag(FeatureFlag.DefaultPasswordManagerPrompt);
}
