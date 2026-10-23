import {
  GENERATOR_DISK,
  GENERATOR_MEMORY,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { VendorId } from "@bitwarden/common/tools/extension";
import { Vendor } from "@bitwarden/common/tools/extension/vendor/data";
import { IntegrationContext, IntegrationId } from "@bitwarden/common/tools/integration";
import {
  ApiSettings,
  IntegrationRequest,
  SelfHostedApiSettings,
} from "@bitwarden/common/tools/integration/rpc";
import { PrivateClassifier } from "@bitwarden/common/tools/private-classifier";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";
import { BufferedKeyDefinition } from "@bitwarden/common/tools/state/buffered-key-definition";
import { ObjectKey } from "@bitwarden/common/tools/state/object-key";

import { ForwarderConfiguration, ForwarderContext, EmailDomainSettings } from "../engine";
import { CreateForwardingEmailRpcDef } from "../engine/forwarder-configuration";
import { EmailDomainOptions, SelfHostedApiOptions } from "../types";

// integration types
export type SkudoSettings = SelfHostedApiSettings & EmailDomainSettings;
export type SkudoOptions = SelfHostedApiOptions & EmailDomainOptions;
export type SkudoConfiguration = ForwarderConfiguration<SkudoSettings>;

// default values
const defaultSettings = Object.freeze({
  token: "",
  domain: "",
  baseUrl: "",
});

// supported RPC calls
const createForwardingEmail = Object.freeze({
  url(_request: IntegrationRequest, context: ForwarderContext<SkudoSettings>) {
    return context.baseUrl() + "/api/v1/aliases";
  },
  body(request: IntegrationRequest, context: ForwarderContext<SkudoSettings>) {
    return {
      domain: context.emailDomain(),
      description: context.generatedBy(request, { extractHostname: true, maxLength: 200 }),
    };
  },
  hasJsonPayload(response: Response) {
    return response.status === 200 || response.status === 201;
  },
  processJson(json: any) {
    return [json?.data?.email];
  },
} as CreateForwardingEmailRpcDef<SkudoSettings>);

// forwarder configuration
const forwarder = Object.freeze({
  defaultSettings,
  createForwardingEmail,
  request: ["token", "baseUrl", "domain"],
  settingsConstraints: {
    token: { required: true },
    domain: { required: true },
    baseUrl: {},
  },
  local: {
    settings: {
      // FIXME: integration should issue keys at runtime
      // based on integrationId & extension metadata
      // e.g. key: "forwarder.Skudo.local.settings",
      key: "skudoForwarder",
      target: "object",
      format: "secret-state",
      frame: 512,
      classifier: new PrivateClassifier<SkudoSettings>(),
      state: GENERATOR_DISK,
      initial: defaultSettings,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout"],
      },
    } satisfies ObjectKey<SkudoSettings>,
    import: {
      key: "forwarder.Skudo.local.import",
      target: "object",
      format: "plain",
      classifier: new PublicClassifier<SkudoSettings>(["token", "baseUrl", "domain"]),
      state: GENERATOR_MEMORY,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout", "lock"],
      },
    } satisfies ObjectKey<SkudoSettings, Record<string, never>, SkudoSettings>,
  },
  settings: new UserKeyDefinition<SkudoSettings>(GENERATOR_DISK, "skudoForwarder", {
    deserializer: (value) => value,
    clearOn: [],
  }),
  importBuffer: new BufferedKeyDefinition<SkudoSettings>(GENERATOR_DISK, "skudoBuffer", {
    deserializer: (value) => value,
    clearOn: ["logout"],
  }),
} as const);

export const Skudo = Object.freeze({
  // integration
  id: Vendor.skudo as IntegrationId & VendorId,
  name: "Skudo",
  extends: ["forwarder"],

  // hosting
  selfHost: "maybe",
  baseUrl: "https://app.skudo.org",
  authenticate(_request: IntegrationRequest, context: IntegrationContext<ApiSettings>) {
    return { Authorization: "Bearer " + context.authenticationToken() };
  },

  // extensions
  forwarder,
} as SkudoConfiguration);
