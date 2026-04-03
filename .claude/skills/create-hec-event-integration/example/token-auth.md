# Example: Blumira HEC Integration (Token Auth)

A completed walkthrough of the skill using **Blumira** as the service name.

---

## Step 1 - Prompts

| Prompt         | Answer                           |
| -------------- | -------------------------------- |
| Service name   | `Blumira`                        |
| Authentication | Token                            |
| Logos ready?   | Yes — light + dark SVGs provided |

---

## Step 2 — Service name constant

**File:** `bitwarden_license/bit-common/src/dirt/organization-integrations/models/organization-integration-service-type.ts`

```typescript
export const OrganizationIntegrationServiceName = Object.freeze({
  Blumira: "Blumira",
  CrowdStrike: "CrowdStrike",
  Datadog: "Datadog",
  Huntress: "Huntress",
} as const);
```

---

## Step 3 — Feature flag

**File:** `libs/common/src/enums/feature-flag.enum.ts`

```typescript
// In the FeatureFlag enum (DIRT section):
EventManagementForBlumira = "event-management-for-blumira",

// In defaultFlags (DIRT section):
[FeatureFlag.EventManagementForBlumira]: FALSE,
```

---

## Step 4 — Card registration

Logos were provided in Step 1, so copy them first:

- `apps/web/src/images/integrations/logo-blumira-color.svg`
- `apps/web/src/images/integrations/logo-blumira-darkmode.svg`

**File:** `bitwarden_license/bit-web/src/app/dirt/organization-integrations/organization-integrations.resolver.ts`

```typescript
const blumiraFeatureEnabled = await firstValueFrom(
  this.configService.getFeatureFlag$(FeatureFlag.EventManagementForBlumira),
);

if (blumiraFeatureEnabled) {
  integrations.push({
    name: OrganizationIntegrationServiceName.Blumira,
    linkURL: "https://bitwarden.com/help/blumira-siem/",
    image: "../../../../../../../images/integrations/logo-blumira-color.svg",
    imageDarkMode: "../../../../../../../images/integrations/logo-blumira-darkmode.svg",
    type: IntegrationType.EVENT,
    canSetupConnection: true,
    integrationType: OrganizationIntegrationType.Hec,
  });
}
```

---

## Step 5 — Add tests

**File:** `bitwarden_license/bit-common/src/dirt/organization-integrations/services/organization-integration-service.spec.ts`

Added inside the existing `describe("save", ...)` block — no new wrapper `describe`:

```typescript
it("should build correct HEC config and template for Blumira", () => {
  const config = OrgIntegrationBuilder.buildHecConfiguration(
    "https://test.blumira.com/hec",
    "test-token",
    OrganizationIntegrationServiceName.Blumira,
  );
  const template = OrgIntegrationBuilder.buildHecTemplate(
    "test-index",
    OrganizationIntegrationServiceName.Blumira,
  );

  expect(JSON.parse(config.toString())).toEqual({
    Uri: "https://test.blumira.com/hec",
    Scheme: "Bearer",
    Token: "test-token",
    bw_serviceName: "Blumira",
  });

  const parsed = JSON.parse(template.toString());
  expect(parsed.index).toBe("test-index");
  expect(parsed.bw_serviceName).toBe("Blumira");
  expect(parsed.event.type).toBe("#TypeId#");
});
```

---

## Step 6 — Run unit tests

```bash
npx jest bitwarden_license/bit-common/src/dirt/organization-integrations/services/organization-integration-service.spec.ts
```

Result: **32 tests passed**
