import {
  GENERATOR_DISK,
  GENERATOR_MEMORY,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { VendorId } from "@bitwarden/common/tools/extension";
import { Vendor } from "@bitwarden/common/tools/extension/vendor/data";
import { IntegrationContext, IntegrationId } from "@bitwarden/common/tools/integration";
import { ApiSettings, IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";
import { PrivateClassifier } from "@bitwarden/common/tools/private-classifier";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";
import { BufferedKeyDefinition } from "@bitwarden/common/tools/state/buffered-key-definition";
import { ObjectKey } from "@bitwarden/common/tools/state/object-key";

import { ForwarderConfiguration, ForwarderContext, EmailDomainSettings } from "../engine";
import { CreateForwardingEmailRpcDef } from "../engine/forwarder-configuration";
import { ApiOptions, EmailDomainOptions } from "../types";

// integration types
export type MailFlusherSettings = ApiSettings & EmailDomainSettings;
export type MailFlusherOptions = ApiOptions & EmailDomainOptions;
export type MailFlusherConfiguration = ForwarderConfiguration<MailFlusherSettings>;

// default values
const defaultSettings = Object.freeze({
  token: "",
  domain: "",
});

// supported RPC calls
const createForwardingEmail = Object.freeze({
  url(_request: IntegrationRequest, context: ForwarderContext<MailFlusherSettings>) {
    return context.baseUrl() + "/api/v1/aliases";
  },
  body(request: IntegrationRequest, context: ForwarderContext<MailFlusherSettings>) {
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
} as CreateForwardingEmailRpcDef<MailFlusherSettings>);

// forwarder configuration
const forwarder = Object.freeze({
  defaultSettings,
  createForwardingEmail,
  request: ["token", "domain"],
  settingsConstraints: {
    token: { required: true },
    domain: { required: true },
  },
  local: {
    settings: {
      // FIXME: integration should issue keys at runtime
      // based on integrationId & extension metadata
      // e.g. key: "forwarder.MailFlusher.local.settings",
      key: "mailFlusherForwarder",
      target: "object",
      format: "secret-state",
      frame: 512,
      classifier: new PrivateClassifier<MailFlusherSettings>(),
      state: GENERATOR_DISK,
      initial: defaultSettings,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout"],
      },
    } satisfies ObjectKey<MailFlusherSettings>,
    import: {
      key: "forwarder.MailFlusher.local.import",
      target: "object",
      format: "plain",
      classifier: new PublicClassifier<MailFlusherSettings>(["token", "domain"]),
      state: GENERATOR_MEMORY,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout", "lock"],
      },
    } satisfies ObjectKey<MailFlusherSettings, Record<string, never>, MailFlusherSettings>,
  },
  settings: new UserKeyDefinition<MailFlusherSettings>(GENERATOR_DISK, "mailFlusherForwarder", {
    deserializer: (value) => value,
    clearOn: [],
  }),
  importBuffer: new BufferedKeyDefinition<MailFlusherSettings>(
    GENERATOR_DISK,
    "mailFlusherBuffer",
    {
      deserializer: (value) => value,
      clearOn: ["logout"],
    },
  ),
} as const);

export const MailFlusher = Object.freeze({
  // integration
  id: Vendor.mailflusher as IntegrationId & VendorId,
  name: "MailFlusher",
  extends: ["forwarder"],

  // hosting
  selfHost: "never",
  baseUrl: "https://app.mailflusher.com",
  authenticate(_request: IntegrationRequest, context: IntegrationContext<ApiSettings>) {
    return { Authorization: "Bearer " + context.authenticationToken() };
  },

  // extensions
  forwarder,
} as MailFlusherConfiguration);
