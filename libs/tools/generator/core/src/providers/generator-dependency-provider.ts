import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RestClient } from "@bitwarden/common/tools/integration/rpc";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";

import { Randomizer } from "../abstractions";

export type GeneratorDependencyProvider = {
  randomizer: Randomizer;
  client: RestClient;
  // FIXME: introduce `I18nKeyOrLiteral` into forwarder
  //        structures and remove this dependency
  i18nService: I18nService;
  /**
   * SDK client used by the password/passphrase generators. Provided as a lazy factory that resolves
   * a fresh value from `SdkService.client$` on each invocation. `client$` re-emits when the
   * environment changes (self-hosted URL changes, login/logout transitions, initial storage read),
   * so calling this per-generation ensures the latest client is always used rather than a stale
   * snapshot captured at app-init time.
   */
  sdk: () => Promise<PasswordManagerClient>;
  now: () => number;
};
