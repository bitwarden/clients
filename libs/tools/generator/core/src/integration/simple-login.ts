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

import { ForwarderConfiguration, ForwarderContext } from "../engine";
import { CreateForwardingEmailRpcDef } from "../engine/forwarder-configuration";
import { SelfHostedApiOptions } from "../types";

// integration types
export type SimpleLoginSettings = SelfHostedApiSettings;
export type SimpleLoginOptions = SelfHostedApiOptions;
export type SimpleLoginConfiguration = ForwarderConfiguration<SimpleLoginSettings>;

// default values
const defaultSettings = Object.freeze({
  token: "",
  domain: "",
  baseUrl: "",
});

// supported RPC calls
const createForwardingEmail = Object.freeze({
  url(request: IntegrationRequest, context: ForwarderContext<SimpleLoginSettings>) {
    const endpoint = context.baseUrl() + "/api/alias/random/new";
    const hostname = context.website(request);
    const url = hostname !== "" ? `${endpoint}?hostname=${hostname}` : endpoint;

    return url;
  },
  body(request: IntegrationRequest, context: ForwarderContext<SimpleLoginSettings>) {
    return { note: context.generatedBy(request) };
  },
  hasJsonPayload(response: Response) {
    return response.status === 200 || response.status === 201;
  },
  processJson(json: any) {
    return [json?.alias];
  },
} as CreateForwardingEmailRpcDef<SimpleLoginSettings>);

// forwarder configuration
const forwarder = Object.freeze({
  defaultSettings,
  createForwardingEmail,
  request: ["token", "baseUrl"],
  settingsConstraints: {
    token: { required: true },
  },
  local: {
    settings: {
      // FIXME: integration should issue keys at runtime
      // based on integrationId & extension metadata
      // e.g. key: "forwarder.SimpleLogin.local.settings",
      key: "simpleLoginForwarder",
      target: "object",
      format: "secret-state",
      frame: 512,
      classifier: new PrivateClassifier<SimpleLoginSettings>(),
      state: GENERATOR_DISK,
      initial: defaultSettings,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout"],
      },
    } satisfies ObjectKey<SimpleLoginSettings>,
    import: {
      key: "forwarder.SimpleLogin.local.import",
      target: "object",
      format: "plain",
      classifier: new PublicClassifier<SimpleLoginSettings>(["token", "baseUrl"]),
      state: GENERATOR_MEMORY,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout", "lock"],
      },
    } satisfies ObjectKey<SimpleLoginSettings, Record<string, never>, SimpleLoginSettings>,
  },
  settings: new UserKeyDefinition<SimpleLoginSettings>(GENERATOR_DISK, "simpleLoginForwarder", {
    deserializer: (value) => value,
    clearOn: [],
  }),
  importBuffer: new BufferedKeyDefinition<SimpleLoginSettings>(
    GENERATOR_DISK,
    "simpleLoginBuffer",
    {
      deserializer: (value) => value,
      clearOn: ["logout"],
    },
  ),
} as const);

// integration-wide configuration
export const SimpleLogin = Object.freeze({
  id: "simplelogin" as IntegrationId,
  name: "SimpleLogin",
  selfHost: "maybe",
  extends: ["forwarder"],
  baseUrl: "https://app.simplelogin.io",
  authenticate(_request: IntegrationRequest, context: IntegrationContext<ApiSettings>) {
    return { Authentication: context.authenticationToken() };
  },
  forwarder,
} as SimpleLoginConfiguration);
