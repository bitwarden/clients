This module defines interfaces and helpers for creating vendor integration sites.

## RPC

> ⚠️ **Only use for extension points!**
> This logic is not suitable for general use. Making calls to the Bitwarden server api
> using `@bitwarden/common/tools/integration/rpc` is prohibited.

Interfaces and helpers defining a remote procedure call to a vendor's service. These
types provide extension points to produce and process the call without exposing a
generalized fetch API.

## Sample usage

An email forwarder configuration:

```typescript
// define RPC shapes;
// * the request format, `RequestOptions` is common to all calls
// * the context operates on forwarder-specific settings provided by `state`.
type CreateForwardingEmailConfig<Settings> = RpcConfiguration<
  RequestOptions,
  ForwarderContext<Settings>
>;

// how a forwarder integration point might represent its configuration
type ForwarderConfiguration<Settings> = IntegrationConfiguration & {
  forwarder: {
    defaultState: Settings;
    createForwardingEmail: CreateForwardingEmailConfig<Settings>;
  };
};

// how an importer integration point might represent its configuration
type ImporterConfiguration = IntegrationConfiguration & {
  importer: {
    fileless: false | { selector: string };
    formats: ContentType[];
    crep:
      | false
      | {
          /* credential exchange protocol configuration */
        };
    // ...
  };
};

// how a plugin might be structured
export type JustTrustUsSettings = ApiSettings & EmailDomainSettings;
export type JustTrustUsConfiguration = ForwarderConfiguration<JustTrustUsSettings> &
  ImporterConfiguration;

export const JustTrustUs = {
  // common metadata
  id: "justrustus",
  name: "Just Trust Us, LLC",
  extends: ["forwarder"],

  // API conventions
  selfHost: "never",
  baseUrl: "https://api.just-trust.us/v1",
  authenticate(settings: ApiSettings, context: IntegrationContext) {
    return { Authorization: "Bearer " + context.authenticationToken(settings) };
  },

  // forwarder specific config
  forwarder: {
    defaultState: { domain: "just-trust.us" },

    // specific RPC call
    createForwardingEmail: {
      url: () => context.baseUrl() + "/fowarder",
      body: (request: RequestOptions) => ({ description: context.generatedBy(request) }),
      hasJsonPayload: (response) => response.status === 200,
      processJson: (json) => json.email,
    },
  },

  // importer specific config
  importer: {
    fileless: false,
    crep: false,
    formats: ["text/csv", "application/json"],
  },
} as JustTrustUsConfiguration;
```
