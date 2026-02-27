import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IntegrationContext } from "@bitwarden/common/tools/integration/integration-context";
import { ApiSettings } from "@bitwarden/common/tools/integration/rpc";

import { ForwarderConfiguration } from "./forwarder-configuration";
import { EmailDomainSettings, EmailPrefixSettings } from "./settings";

/**
 * Surfaces contextual information to forwarder integrations.
 */
export class ForwarderContext<Settings extends ApiSettings> extends IntegrationContext<Settings> {
  /** Instantiates the context.
   * @param configuration of the forwarder this context assists
   * @param settings loaded from the forwarder's state
   * @param i18n localizes error handling
   */
  constructor(
    readonly configuration: ForwarderConfiguration<Settings>,
    settings: Settings,
    i18n: I18nService,
  ) {
    super(configuration, settings, i18n);
  }

  /** look up the domain part of an email address from the forwarder's settings.
   *  @returns a domain part of an email address
   *  @throws a localized error message when the domain isn't found.
   *  @remarks the string is thrown for backwards compatibility
   */
  emailDomain(): Settings extends EmailDomainSettings ? string : never {
    const domain = "domain" in this.settings ? (this.settings.domain ?? "") : "";
    if (domain === "") {
      const error = this.i18n.t("forwarderNoDomain", this.configuration.name);
      throw error;
    }

    return domain as any;
  }

  /** look up a prefix applied to the email address from the forwarder's settings.
   *  @returns the prefix
   *  @throws a localized error message when the prefix isn't found.
   *  @remarks the string is thrown for backwards compatibility
   */
  emailPrefix(): Settings extends EmailPrefixSettings ? string : never {
    const prefix = "prefix" in this.settings ? (this.settings.prefix ?? "") : "";
    if (prefix === "") {
      const error = this.i18n.t("forwarderNoPrefix", this.configuration.name);
      throw error;
    }

    return prefix as any;
  }

  /** look up a localized error message indicating an account id is required
   *  but wasn't found.
   *  @remarks this returns a string instead of throwing it so that the
   *    user can decide upon control flow.
   */
  missingAccountIdCause() {
    return this.i18n.t("forwarderNoAccountId", this.configuration.name);
  }
}
