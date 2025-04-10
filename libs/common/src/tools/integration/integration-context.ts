// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { I18nService } from "../../platform/abstractions/i18n.service";
import { Utils } from "../../platform/misc/utils";

import { IntegrationMetadata } from "./integration-metadata";
import { ApiSettings, IntegrationRequest } from "./rpc";

/** Utilities for processing integration settings */
export class IntegrationContext<Settings extends object> {
  /** Instantiates an integration context
   *  @param metadata - defines integration capabilities
   *  @param i18n - localizes error messages
   */
  constructor(
    readonly metadata: IntegrationMetadata,
    protected settings: Settings,
    protected i18n: I18nService,
  ) {}

  /** Lookup the integration's baseUrl
   *  @returns the baseUrl for the API's integration point.
   *   - By default this is defined by the metadata
   *   - When a service allows self-hosting, this can be supplied by `settings`.
   *  @throws a localized error message when a base URL is neither defined by the metadata or
   *   supplied by an argument.
   */
  baseUrl(): string {
    // normalize baseUrl
    const setting =
      (this.settings && "baseUrl" in this.settings
        ? (this.settings.baseUrl as string)
        : undefined) ?? "";
    let result = "";

    // look up definition
    if (this.metadata.selfHost === "always") {
      result = setting;
    } else if (this.metadata.selfHost === "never" || setting.length <= 0) {
      result = this.metadata.baseUrl ?? "";
    } else {
      result = setting;
    }

    // postconditions
    if (result === "") {
      const error = this.i18n.t("forwarderNoUrl", this.metadata.name);
      throw error;
    }

    return result;
  }

  /** look up a service API's authentication token
   *  @param options.base64 when `true`, base64 encodes the result. Defaults to `false`.
   *  @param options.suffix a string to append to the token. Defaults to empty.
   *  @returns the user's authentication token
   *  @throws a localized error message when the token is invalid.
   *  @remarks the string is thrown for backwards compatibility
   */
  authenticationToken(
    options: { base64?: boolean; suffix?: string } = null,
  ): Settings extends ApiSettings ? string : never {
    // normalize `token` then assert it has a value
    let token = "token" in this.settings ? ((this.settings.token as string) ?? "") : "";
    if (token === "") {
      const error = this.i18n.t("forwaderInvalidToken", this.metadata.name);
      throw error;
    }

    // if a suffix exists, it needs to be included before encoding
    token += options?.suffix ?? "";
    if (options?.base64) {
      token = Utils.fromUtf8ToB64(token);
    }

    return token;
  }

  /** look up the website the integration is working with.
   *  @param request supplies information about the state of the extension site
   *  @returns The website or an empty string if a website isn't available
   *  @remarks `website` is usually supplied when generating a credential from the vault
   */
  website(request: IntegrationRequest) {
    return request.website ?? "";
  }

  /** look up localized text indicating Bitwarden requested the forwarding address.
   *  @param request supplies information about the state of the extension site
   *  @returns localized text describing a generated forwarding address
   */
  generatedBy(request: IntegrationRequest) {
    const website = this.website(request);

    const descriptionId =
      website === "" ? "forwarderGeneratedBy" : "forwarderGeneratedByWithWebsite";
    const description = this.i18n.t(descriptionId, website);

    return description;
  }
}
