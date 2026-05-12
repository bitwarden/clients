# Technical Requirements for Push-Based Event Delivery

> Purpose: This document explains how to implement a push-based event delivery integration for organization event management.

## Why this matters

Bitwarden generates a high volume of security-relevant events, such as password changes and new device logins. These events are visible in the Admin Console under Reporting > Event log.

Push-based delivery lets organizations stream those events to third-party systems in near real time, including Splunk, Datadog, Huntress, and CrowdStrike. This enables centralized monitoring, alerting, and incident response.

## Architecture at a glance

Push-based event delivery has two independent layers:

1. Server-side delivery pipeline
2. Client-side integration setup

### Server-side responsibilities

The server supports multiple integration channels, including Webhook, Slack, Microsoft Teams, HEC, and Datadog. For full server details, see [Event Integrations](https://github.com/bitwarden/server/blob/main/src/Core/Dirt/EventIntegrations/README.md) in the server repository.

The server-side flow is:

1. A Bitwarden client generates an event.
2. The event is sent to the Events service `collect` endpoint.
3. The Event Writer publishes the event to Azure Service Bus (ASB) or RabbitMQ.
4. Event listeners consume the event.
5. A repository listener persists the event.
6. Channel-specific listeners dispatch the event to configured destinations (for example, Slack or HEC endpoints).

### What a HEC configuration contains

HEC stands for HTTP Event Collector. A HEC configuration includes:

- `Uri`: Destination endpoint, for example `http://splunk-hec-endpoint:8088/services/collector`
- `Token`: Authentication credential
- `Scheme`: Authentication scheme metadata, for example `Bearer` or `Splunk`

These values are stored in organization integration records, and the HEC listener uses them to construct authenticated HTTP requests.

### Client-side responsibilities

The client does not deliver events. It only configures integration metadata so the server can deliver events.

From Admin Console > Organization Settings > Integrations > Event Delivery, the client saves integration configuration in:

- `dbo.OrganizationIntegration`
- `dbo.OrganizationIntegrationConfiguration`

After save/update/delete operations, the server cache is invalidated normally, but a short propagation delay can still occur before delivery reflects the latest configuration.

## What the client can already do

Current client capabilities include:

- Collecting HEC parameters (`Uri`, `Token`, `Scheme`)
- Rendering integration cards with branding
- Opening setup dialogs for connection parameters
- Persisting configuration and template data for server-side delivery

To introduce a new integration card, add an entry in `organization-integrations.resolver.ts` with:

- Service identity (`OrganizationIntegrationServiceName`)
- Integration category (`type`, for example `IntegrationType.EVENT`)
- Backend implementation type (`integrationType`, for example `OrganizationIntegrationType.Hec`)
- Branding assets (`image`, `imageDarkMode`)
- Setup behavior (`canSetupConnection`)
- Docs link (`linkURL`) and helper text (`urlHelperLinkText`)

## Event payload template (HEC)

All HEC integrations use a template structure like this:

```typescript
const template: Record<string, any> = {
  bw_serviceName: this.bw_serviceName,
  source: "bitwarden",
  service: "event-logs",
  event: {
    object: "event",
    type: "#TypeId#",
    typeName: "#Type#",
    memberId: "#UserId#",
    organizationId: "#OrganizationId#",
    providerId: "#ProviderId#",
    itemId: "#CipherId#",
    collectionId: "#CollectionId#",
    groupId: "#GroupId#",
    policyId: "#PolicyId#",
    organizationUserId: "#OrganizationUserId#",
    providerUserId: "#ProviderUserId#",
    providerOrganizationId: "#ProviderOrganizationId#",
    actingUserId: "#ActingUserId#",
    installationId: "#InstallationId#",
    date: "#DateIso8601#",
    deviceType: "#DeviceType#",
    device: "#DeviceTypeId#",
    ipAddress: "#IpAddress#",
    systemUser: "#SystemUser#",
    domainName: "#DomainName#",
    secretId: "#SecretId#",
    projectId: "#ProjectId#",
    serviceAccountId: "#ServiceAccountId#",
  },
};
```

Most IDs in this payload are GUIDs. If needed, add enrichment fields such as:

```typescript
event: {
  ...,
  actingUserName: "#ActingUserName#",
  actingUserEmail: "#ActingUserEmail#",
  organizationName: "#OrganizationName#",
  groupName: "#GroupName#",
}
```

## How to add a new integration

You have two paths.

### Option 1: Use the `/create-hec-event-integration` skill

The skill asks for:

- Integration name (for example Splunk, Blumira, Datadog)
- Authentication method (currently token-based flow is supported for this skill)
- Branding asset availability

Then it scaffolds:

- A new `OrganizationIntegrationServiceName` value
- A feature flag (for example `event-management-for-splunk`)
- A new integration card behind that feature flag in Event Delivery

### Option 2: Manual setup

In `organization-integrations.resolver.ts`, add a record modeled after an existing HEC integration (for example Huntress or Blumira):

- Ensure `name` matches a value in `OrganizationIntegrationServiceName`
- Set `type` to `IntegrationType.EVENT`
- Set `integrationType` to `OrganizationIntegrationType.Hec` for HEC-based providers
- Set `canSetupConnection` to `true` when a setup dialog is required
- Provide `linkURL`, `urlHelperLinkText`, `image`, and `imageDarkMode` values

After this is in place, admins can connect the integration in Event Delivery and save `Uri`, `Token`, and `Scheme` through the UI.

## Infrastructure clarification

- Bitwarden cloud uses Azure Service Bus.
- Self-hosted deployments can use Azure Service Bus or RabbitMQ.

No client-side change is required to choose the transport. That is handled by server and infrastructure configuration.

## Implementation checklist

1. Stand up a test instance of the target provider (Docker, sandbox, or trial).
2. Prepare approved logos for light and dark mode.
3. Add the integration (skill-based or manual path).
4. Add payload enrichment fields only if the provider or use case requires them.
5. Add or update unit tests for resolver/config/template behavior.
6. Validate end-to-end delivery in a real environment.

## References

- Service-level implementation details: [organization-integrations/services/README.md](https://github.com/bitwarden/clients/blob/main/bitwarden_license/bit-common/src/dirt/organization-integrations/services/README.md)
- [Splunk HEC HTTP Event Collector tokens to get data in](https://help.splunk.com/en/splunk-enterprise/get-started/get-data-in/9.3/get-data-with-http-event-collector/set-up-and-use-http-event-collector-in-splunk-web#dbdcdb42_1180_4f33_8c7d_153a5e7868d3--en__Set_up_and_use_HTTP_Event_Collector_in_Splunk_Web)
- [Splunk HEC request format documentation](https://help.splunk.com/en/splunk-enterprise/get-started/get-data-in/9.3/get-data-with-http-event-collector/format-events-for-http-event-collector)
