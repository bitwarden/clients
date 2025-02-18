import {
  GENERATOR_DISK,
  GENERATOR_MEMORY,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
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
export type AddyIoSettings = SelfHostedApiSettings & EmailDomainSettings;
export type AddyIoOptions = SelfHostedApiOptions & EmailDomainOptions;
export type AddyIoConfiguration = ForwarderConfiguration<AddyIoSettings>;

// default values
const defaultSettings = Object.freeze({
  token: "",
  domain: "",
  baseUrl: "",
});

// supported RPC calls
const createForwardingEmail = Object.freeze({
  url(_request: IntegrationRequest, context: ForwarderContext<AddyIoSettings>) {
    return context.baseUrl() + "/api/v1/aliases";
  },
  body(request: IntegrationRequest, context: ForwarderContext<AddyIoSettings>) {
    return {
      domain: context.emailDomain(),
      description: context.generatedBy(request),
    };
  },
  hasJsonPayload(response: Response) {
    return response.status === 200 || response.status === 201;
  },
  processJson(json: any) {
    return [json?.data?.email];
  },
} as CreateForwardingEmailRpcDef<AddyIoSettings>);

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
      // e.g. key: "forwarder.AddyIo.local.settings",
      key: "addyIoForwarder",
      target: "object",
      format: "secret-state",
      frame: 512,
      classifier: new PrivateClassifier<AddyIoSettings>(),
      state: GENERATOR_DISK,
      initial: defaultSettings,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout"],
      },
    } satisfies ObjectKey<AddyIoSettings>,
    import: {
      key: "forwarder.AddyIo.local.import",
      target: "object",
      format: "plain",
      classifier: new PublicClassifier<AddyIoSettings>(["token", "baseUrl", "domain"]),
      state: GENERATOR_MEMORY,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout", "lock"],
      },
    } satisfies ObjectKey<AddyIoSettings, Record<string, never>, AddyIoSettings>,
  },
  settings: new UserKeyDefinition<AddyIoSettings>(GENERATOR_DISK, "addyIoForwarder", {
    deserializer: (value) => value,
    clearOn: [],
  }),
  importBuffer: new BufferedKeyDefinition<AddyIoSettings>(GENERATOR_DISK, "addyIoBuffer", {
    deserializer: (value) => value,
    clearOn: ["logout"],
  }),
} as const);

export const AddyIo = Object.freeze({
  // integration
  id: "anonaddy" as IntegrationId,
  name: "Addy.io",
  extends: ["forwarder"],

  // hosting
  selfHost: "maybe",
  baseUrl: "https://app.addy.io",
  authenticate(_request: IntegrationRequest, context: IntegrationContext<ApiSettings>) {
    return { Authorization: "Bearer " + context.authenticationToken() };
  },

  // extensions
  forwarder,
} as AddyIoConfiguration);
