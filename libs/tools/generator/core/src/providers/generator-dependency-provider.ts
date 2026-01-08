import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { RestClient } from "@bitwarden/common/tools/integration/rpc";

import { Randomizer } from "../abstractions";

export type GeneratorDependencyProvider = {
  randomizer: Randomizer;
  client: RestClient;
  // FIXME: introduce `I18nKeyOrLiteral` into forwarder
  //        structures and remove this dependency
  i18nService: I18nService;
  sdk: SdkService;
  now: () => number;
};
