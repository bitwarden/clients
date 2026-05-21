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
} from "@bitwarden/common/tools/integration/rpc";
import { PrivateClassifier } from "@bitwarden/common/tools/private-classifier";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";
import { BufferedKeyDefinition } from "@bitwarden/common/tools/state/buffered-key-definition";
import { ObjectKey } from "@bitwarden/common/tools/state/object-key";

import { ForwarderConfiguration, ForwarderContext, EmailDomainSettings } from "../engine";
import { CreateForwardingEmailRpcDef } from "../engine/forwarder-configuration";
import { ApiOptions, EmailDomainOptions } from "../types";

// integration types
export type ProxiedMailSettings = ApiSettings & EmailDomainSettings;
export type ProxiedMailOptions = ApiOptions & EmailDomainOptions;
export type ProxiedMailConfiguration = ForwarderConfiguration<ProxiedMailSettings>;

// default values
const defaultSettings = Object.freeze({
  token: "",
  domain: "",
});

// supported RPC calls
const createForwardingEmail = Object.freeze({
  url(_request: IntegrationRequest, _context: ForwarderContext<ProxiedMailSettings>) {
    return "https://proxiedmail.com/api/v1/aliases";
  },
  body(request: IntegrationRequest, context: ForwarderContext<ProxiedMailSettings>) {
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
} as CreateForwardingEmailRpcDef<ProxiedMailSettings>);

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
      // e.g. key: "forwarder.ProxiedMail.local.settings",
      key: "proxiedmailForwarder",
      target: "object",
      format: "secret-state",
      frame: 512,
      classifier: new PrivateClassifier<ProxiedMailSettings>(),
      state: GENERATOR_DISK,
      initial: defaultSettings,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout"],
      },
    } satisfies ObjectKey<ProxiedMailSettings>,
    import: {
      key: "forwarder.ProxiedMail.local.import",
      target: "object",
      format: "plain",
      classifier: new PublicClassifier<ProxiedMailSettings>(["token", "domain"]),
      state: GENERATOR_MEMORY,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout", "lock"],
      },
    } satisfies ObjectKey<ProxiedMailSettings, Record<string, never>, ProxiedMailSettings>,
  },
  settings: new UserKeyDefinition<ProxiedMailSettings>(GENERATOR_DISK, "proxiedmailForwarder", {
    deserializer: (value) => value,
    clearOn: [],
  }),
  importBuffer: new BufferedKeyDefinition<ProxiedMailSettings>(
    GENERATOR_DISK,
    "proxiedmailBuffer",
    {
      deserializer: (value) => value,
      clearOn: ["logout"],
    },
  ),
} as const);

export const ProxiedMail = Object.freeze({
  // integration
  id: Vendor.proxiedmail as IntegrationId & VendorId,
  name: "ProxiedMail",
  extends: ["forwarder"],

  // hosting
  selfHost: "no",
  baseUrl: "https://proxiedmail.com",
  authenticate(_request: IntegrationRequest, context: IntegrationContext<ApiSettings>) {
    return { Authorization: "Bearer " + context.authenticationToken() };
  },

  // extensions
  forwarder,
} as ProxiedMailConfiguration);
