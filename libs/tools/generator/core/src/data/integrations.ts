// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { IntegrationId } from "@bitwarden/common/tools/integration";
import { ApiSettings } from "@bitwarden/common/tools/integration/rpc";

import { ForwarderConfiguration } from "../engine";
import { AddyIo } from "../integration/addy-io";
import { DuckDuckGo } from "../integration/duck-duck-go";
import { Fastmail } from "../integration/fastmail";
import { FirefoxRelay } from "../integration/firefox-relay";
import { ForwardEmail } from "../integration/forward-email";
import { SimpleLogin } from "../integration/simple-login";

/** Fixed list of integrations available to the application
 *  @example
 *
 *  // Use `toCredentialGeneratorConfiguration(id :ForwarderIntegration)`
 *  // to convert an integration to a generator configuration
 *  const generator = toCredentialGeneratorConfiguration(Integrations.AddyIo);
 */
export const Integrations = Object.freeze({
  AddyIo,
  DuckDuckGo,
  Fastmail,
  FirefoxRelay,
  ForwardEmail,
  SimpleLogin,
} as const);

const integrations = new Map(Object.values(Integrations).map((i) => [i.id, i]));

export function getForwarderConfiguration(id: IntegrationId): ForwarderConfiguration<ApiSettings> {
  const maybeForwarder = integrations.get(id);

  if (maybeForwarder && "forwarder" in maybeForwarder) {
    return maybeForwarder as ForwarderConfiguration<ApiSettings>;
  } else {
    return null;
  }
}
