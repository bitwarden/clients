---
name: create-hec-event-integration
description: Use when adding a new HEC (HTTP Event Collector) event integration to the Bitwarden web client. Implements the Splunk token authentication model (Bearer token + URI). Covers feature flag setup and card registration behind the flag. Does not apply to API key integrations or integrations requiring a custom connect dialog.
---

# Create HEC Event Integration (Token Auth)

## Step 1 - Prompts

Ask these questions one at a time — wait for each answer before proceeding.

**Prompt 1 — Service name:** "What is the service name for this integration?" (e.g. `Splunk`, `CrowdStrike`, `Panther`)

Use the answer as `<ServiceName>` throughout. The string value in the constant must exactly match what you use as the card's `name` in Step 4 — a mismatch silently saves the config with the wrong service name.

**Prompt 2 — Authentication:** "How is this integration authenticated?" (e.g. `Token`, `API key`)

- **If Token** — continue with the steps below.
- **If anything else** — stop and inform the user: "This skill currently only supports token-based authentication. Support for other authentication methods hasn't been added yet."

**Prompt 3 — Logos:** "Do you have the integration logo(s) ready to provide?"

- **If yes** — ask for the light-mode SVG file path, and optionally a dark-mode SVG path. Copy both to `apps/web/src/images/integrations/` using the naming convention `logo-<service-name-kebab>-color.svg` and `logo-<service-name-kebab>-darkmode.svg`. Use those filenames in Step 4.
- **If no** — use placeholder paths in Step 4 and add a `// TODO: add logo before shipping` comment.

## Step 2 — Add service name constant

**File:** `bitwarden_license/bit-common/src/dirt/organization-integrations/models/organization-integration-service-type.ts`

Add to `OrganizationIntegrationServiceName`:

```typescript
export const OrganizationIntegrationServiceName = Object.freeze({
  CrowdStrike: "CrowdStrike",
  Datadog: "Datadog",
  Huntress: "Huntress",
  <ServiceName>: "<ServiceName>", // ← add here
} as const);
```

## Step 3 — Add feature flag

**File:** `libs/common/src/enums/feature-flag.enum.ts`

Add the enum entry and its default. The enum key is PascalCase; the string value is kebab-case (e.g. `CrowdStrike` → `crowdstrike`, `Sumo Logic` → `sumo-logic`):

```typescript
// In the FeatureFlag enum:
EventManagementFor<ServiceName> = "event-management-for-<service-name-kebab>",

// In the defaultFlags object:
[FeatureFlag.EventManagementFor<ServiceName>]: FALSE,
```

Example for `Panther`:

```typescript
EventManagementForPanther = "event-management-for-panther",
[FeatureFlag.EventManagementForPanther]: FALSE,
```

## Step 4 — Register the card behind the feature flag

**File:** `bitwarden_license/bit-web/src/app/dirt/organization-integrations/organization-integrations.resolver.ts`

If logos were provided, copy them to `apps/web/src/images/integrations/` first, then use the actual filenames below. If not, use the placeholder paths with the TODO comment:

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

No changes needed to `IntegrationCardComponent` — new HEC token-auth services fall into the existing `else if` branch (type is `Hec` and name is not `CrowdStrike`), which opens `openConnectViaHecTokenDialog` with a `saveCallback`. The callback builds the config and template using the card's `name` as the service name and delegates to `executeHecSave`. Delete is handled by `deleteConnectViaHecTokenIntegration`.

## Step 5 — Add tests

**File:** `bitwarden_license/bit-common/src/dirt/organization-integrations/models/integration-builder.spec.ts`

Add one `it` block inside the existing `describe("buildHecConfiguration", ...)` block, and one inside `describe("buildHecTemplate", ...)`. Use typed property access — do not use `JSON.parse`:

```typescript
// Inside describe("buildHecConfiguration", ...)
it("should work with <ServiceName> service name", () => {
  const config = OrgIntegrationBuilder.buildHecConfiguration(
    "https://test.<servicename>.com/hec",
    "test-token",
    OrganizationIntegrationServiceName.<ServiceName>,
  );

  expect(config).toBeInstanceOf(HecConfiguration);
  expect((config as HecConfiguration).uri).toBe("https://test.<servicename>.com/hec");
  expect((config as HecConfiguration).scheme).toBe("Bearer");
  expect((config as HecConfiguration).token).toBe("test-token");
  expect(config.bw_serviceName).toBe(OrganizationIntegrationServiceName.<ServiceName>);
});

// Inside describe("buildHecTemplate", ...)
it("should work with <ServiceName> service name", () => {
  const template = OrgIntegrationBuilder.buildHecTemplate(
    "test-index",
    OrganizationIntegrationServiceName.<ServiceName>,
  );

  expect(template).toBeInstanceOf(HecTemplate);
  expect((template as HecTemplate).index).toBe("test-index");
  expect(template.bw_serviceName).toBe(OrganizationIntegrationServiceName.<ServiceName>);
});
```

## Step 6 — Run unit tests

Run the unit tests for the spec file and confirm they all pass before finishing:

```bash
npx jest bitwarden_license/bit-common/src/dirt/organization-integrations/models/integration-builder.spec.ts
```

All tests must pass. If any fail, fix them before proceeding.

## Common Mistakes

| Mistake                                                                 | Fix                                                                                                   |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `name` in card doesn't match `OrganizationIntegrationServiceName` value | They must be identical strings — the `saveCallback` passes `name` directly to `buildHecConfiguration` |
| Feature flag default not set to `FALSE`                                 | Always add the default entry in `defaultFlags`; new flags without a default will not work correctly   |
| Kebab-case mismatch in flag string                                      | Convert consistently: lowercase, spaces → hyphens                                                     |
| Adding a new `OrganizationIntegrationType`                              | Not needed — all HEC services share `OrganizationIntegrationType.Hec`                                 |
| Creating a new config/template class                                    | Not needed — `HecConfiguration` and `HecTemplate` handle all HEC services                             |
| Referencing an image path without copying the file                      | Copy SVGs to `apps/web/src/images/integrations/` first; if logos aren't ready, leave the TODO comment |
