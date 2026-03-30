# Design: Create HEC Event Integration (Token Auth) Skill

**Date:** 2026-03-30
**Team:** DIRT
**Scope:** `apps/web` + `bitwarden_license/`

---

## Overview

This design describes a Claude skill that guides DIRT team developers through adding a new HEC (HTTP Event Collector) event integration to the Bitwarden web client. The integration uses the **Splunk token authentication model** (Bearer token + endpoint URI) — not an API key model. It is always gated behind a feature flag and uses the shared `openHecConnectDialog` for the connection UI.

New HEC services **reuse** the existing `HecConfiguration` and `HecTemplate` classes — no service-specific configuration or template files are needed.

## User Input Required

Before executing any steps, the skill must ask the user:

1. > "What is the service name for this integration?" (e.g. `Splunk`, `CrowdStrike`, `Panther`)

   The response is used as `<ServiceName>` throughout all steps — in the constant value, flag name, and card registration.

2. > "Do you have the integration logo(s) ready to provide?"
   - **If yes** — ask for the light-mode SVG file path, and optionally a dark-mode SVG. Copy both to `apps/web/src/images/integrations/` using the naming convention `logo-<service-name-kebab>-color.svg` and `logo-<service-name-kebab>-darkmode.svg`. Use those paths in the card registration.
   - **If no** — use placeholder paths in the card registration and add a `// TODO: add logo before shipping` comment so it isn't forgotten.

## Architecture

The integration system has two layers:

- **`bitwarden_license/bit-common/`** — shared models, builder, and service (framework layer)
- **`bitwarden_license/bit-web/`** — UI resolver and card component (presentation layer)

All HEC services share `OrganizationIntegrationType.Hec`, `HecConfiguration`, and `HecTemplate`. The service name (`bw_serviceName`) is the only thing that differentiates them.

## The 4 Steps

### Step 1 — Add service name constant

**File:** `bitwarden_license/bit-common/src/dirt/organization-integrations/models/organization-integration-service-type.ts`

Add the new service to `OrganizationIntegrationServiceName`:

```typescript
export const OrganizationIntegrationServiceName = Object.freeze({
  CrowdStrike: "CrowdStrike",
  Datadog: "Datadog",
  Huntress: "Huntress",
  <ServiceName>: "<ServiceName>", // ← add here
} as const);
```

**Critical:** The string value must exactly match the `name` field used in the card registration (Step 3). `saveHec()` in `IntegrationCardComponent` casts `integrationSettings().name as OrganizationIntegrationServiceName` — if these don't match, the config will be saved with the wrong service name.

### Step 2 — Add feature flag

**File:** `libs/common/src/enums/feature-flag.enum.ts`

Add two entries — the flag definition and its default value (always `FALSE` for new integrations).

The enum key uses PascalCase and the string value uses kebab-case derived from the service name (e.g. `CrowdStrike` → `crowdstrike`, `Sumo Logic` → `sumo-logic`):

```typescript
// In the FeatureFlag enum:
EventManagementFor<ServiceName> = "event-management-for-<service-name-kebab-case>",

// In the defaultFlags object:
[FeatureFlag.EventManagementFor<ServiceName>]: FALSE,
```

Example for `Panther`:

```typescript
EventManagementForPanther = "event-management-for-panther",
[FeatureFlag.EventManagementForPanther]: FALSE,
```

### Step 3 — Register the integration card behind the feature flag

**File:** `bitwarden_license/bit-web/src/app/dirt/organization-integrations/organization-integrations.resolver.ts`

If logos were provided, use the actual filenames. If not, use placeholder paths with a TODO comment:

```typescript
const <serviceName>FeatureEnabled = await firstValueFrom(
  this.configService.getFeatureFlag$(FeatureFlag.EventManagementFor<ServiceName>),
);

if (<serviceName>FeatureEnabled) {
  integrations.push({
    name: OrganizationIntegrationServiceName.<ServiceName>, // must match Step 1 exactly
    linkURL: "https://bitwarden.com/help/<service-name>-siem/",
    image: "../../../../../../../images/integrations/logo-<service-name>-color.svg", // TODO: add logo before shipping (if not yet provided)
    imageDarkMode: "../../../../../../../images/integrations/logo-<service-name>-darkmode.svg", // TODO: add logo before shipping (omit if no dark mode variant)
    type: IntegrationType.EVENT,
    canSetupConnection: true,
    integrationType: OrganizationIntegrationType.Hec,
  });
}
```

**No changes needed to `IntegrationCardComponent`** — new HEC services fall into the existing `else` branch, which calls `openHecConnectDialog` → `saveHec` → `deleteHec`. These methods already use `buildHecConfiguration` and `buildHecTemplate` with the card's `name` as the service name.

### Step 4 — Add tests

**File:** `bitwarden_license/bit-common/src/dirt/organization-integrations/services/organization-integration-service.spec.ts`

Add test coverage for save, update, delete, and load operations for the new service, following the existing Huntress/CrowdStrike test patterns (both are HEC-type integrations like the new service).

---

## Key Constraints

- Feature flag default must be `FALSE`
- `OrganizationIntegrationServiceName` string value must exactly match the card's `name` field
- No new configuration class, template class, or builder methods needed — `HecConfiguration` and `HecTemplate` are reused for all HEC services
- No new `OrganizationIntegrationType` or dialog component needed

## Files Changed Summary

| File                                       | Change                                            |
| ------------------------------------------ | ------------------------------------------------- |
| `organization-integration-service-type.ts` | Add service name constant                         |
| `feature-flag.enum.ts`                     | Add flag + default FALSE                          |
| `apps/web/src/images/integrations/`        | Add light + optional dark SVG (if logos provided) |
| `organization-integrations.resolver.ts`    | Push card behind flag                             |
| `organization-integration-service.spec.ts` | New tests                                         |
