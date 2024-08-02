import { GENERATOR_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { IntegrationContext, IntegrationId } from "@bitwarden/common/tools/integration";
import { ApiSettings, IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";
import { BufferedKeyDefinition } from "@bitwarden/common/tools/state/buffered-key-definition";

import { ForwarderConfiguration, ForwarderContext, EmailDomainSettings } from "../engine";
import { CreateForwardingEmailRpcDef } from "../engine/forwarder-configuration";
import { ApiOptions, EmailDomainOptions } from "../types";

// integration types
export type ForwardEmailSettings = ApiSettings & EmailDomainSettings;
export type ForwardEmailOptions = ApiOptions & EmailDomainOptions;
export type ForwardEmailConfiguration = ForwarderConfiguration<ForwardEmailSettings>;

// default values
const defaultSettings = Object.freeze({
  token: "",
  domain: "",
});

// supported RPC calls
const createForwardingEmail = Object.freeze({
  url(_request: IntegrationRequest, context: ForwarderContext<ForwardEmailSettings>) {
    const domain = context.emailDomain();
    return context.baseUrl() + `/v1/domains/${domain}/aliases`;
  },
  body(request: IntegrationRequest, context: ForwarderContext<ForwardEmailSettings>) {
    return {
      labels: context.website(request),
      description: context.generatedBy(request),
    };
  },
  hasJsonPayload(response: Response) {
    return response.status === 200 || response.status === 201;
  },
  processJson(json: any, context: ForwarderContext<ForwardEmailSettings>) {
    const { name, domain } = json;
    const domainPart = domain?.name ?? context.emailDomain();
    return [`${name}@${domainPart}`];
  },
} as CreateForwardingEmailRpcDef<ForwardEmailSettings>);

// forwarder configuration
const forwarder = Object.freeze({
  defaultSettings,
  settings: new UserKeyDefinition<ForwardEmailSettings>(GENERATOR_DISK, "forwardEmailForwarder", {
    deserializer: (value) => value,
    clearOn: [],
  }),
  importBuffer: new BufferedKeyDefinition<ForwardEmailSettings>(
    GENERATOR_DISK,
    "forwardEmailBuffer",
    {
      deserializer: (value) => value,
      clearOn: ["logout"],
    },
  ),
  createForwardingEmail,
} as const);

export const ForwardEmail = Object.freeze({
  // integration metadata
  id: "forwardemail" as IntegrationId,
  name: "Forward Email",
  extends: ["forwarder"],

  // service provider
  selfHost: "never",
  baseUrl: "https://api.forwardemail.net",
  authenticate(_request: IntegrationRequest, context: IntegrationContext<ApiSettings>) {
    return { Authorization: "Basic " + context.authenticationToken({ base64: true, suffix: ":" }) };
  },

  // specialized configurations
  forwarder,
} as ForwardEmailConfiguration);
