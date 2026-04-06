import { IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";
import {
  ForwarderId,
  CatchallGenerationOptions,
  EffUsernameGenerationOptions,
  SubaddressGenerationOptions,
  UsernameGeneratorType,
} from "@bitwarden/generator-core";

export type UsernameGeneratorOptions = EffUsernameGenerationOptions &
  SubaddressGenerationOptions &
  CatchallGenerationOptions &
  IntegrationRequest & {
    type?: UsernameGeneratorType;
    forwardedService?: ForwarderId | "";
    forwardedAnonAddyApiToken?: string;
    forwardedAnonAddyDomain?: string;
    forwardedAnonAddyBaseUrl?: string;
    forwardedDuckDuckGoToken?: string;
    forwardedFirefoxApiToken?: string;
    forwardedFastmailApiToken?: string;
    forwardedForwardEmailApiToken?: string;
    forwardedForwardEmailDomain?: string;
    forwardedSimpleLoginApiKey?: string;
    forwardedSimpleLoginBaseUrl?: string;
  };
