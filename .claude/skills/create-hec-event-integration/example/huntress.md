# Example: Huntress HEC Integration (Token Auth)

A completed walkthrough of the skill using **Huntress** as the service name.

---

## Prompts answered

| Prompt         | Answer                           |
| -------------- | -------------------------------- |
| Service name   | `Huntress`                       |
| Authentication | Token                            |
| Logos ready?   | Yes — light + dark SVGs provided |

---

## Step 1 — Service name constant

**File:** `bitwarden_license/bit-common/src/dirt/organization-integrations/models/organization-integration-service-type.ts`

```typescript
export const OrganizationIntegrationServiceName = Object.freeze({
  CrowdStrike: "CrowdStrike",
  Datadog: "Datadog",
  Huntress: "Huntress", // ← added
} as const);
```

---

## Step 2 — Feature flag

**File:** `libs/common/src/enums/feature-flag.enum.ts`

```typescript
// In the FeatureFlag enum (DIRT section):
EventManagementForHuntress = "event-management-for-huntress",

// In defaultFlags (DIRT section):
[FeatureFlag.EventManagementForHuntress]: FALSE,
```

---

## Step 3 — Card registration

**File:** `bitwarden_license/bit-web/src/app/dirt/organization-integrations/organization-integrations.resolver.ts`

```typescript
const huntressFeatureEnabled = await firstValueFrom(
  this.configService.getFeatureFlag$(FeatureFlag.EventManagementForHuntress),
);

if (huntressFeatureEnabled) {
  integrations.push({
    name: OrganizationIntegrationServiceName.Huntress,
    linkURL: "https://bitwarden.com/help/huntress-siem/",
    image: "../../../../../../../images/integrations/logo-huntress-siem.svg",
    imageDarkMode: "../../../../../../../images/integrations/logo-huntress-siem-darkmode.svg",
    type: IntegrationType.EVENT,
    description: "huntressEventIntegrationDesc",
    canSetupConnection: true,
    integrationType: OrganizationIntegrationType.Hec,
    urlHelperLinkText: "https://hec.huntress.io/services/collector",
  });
}
```

> **Note:** The `description` and `urlHelperLinkText` fields are optional. Use `description` when the card needs a localised subtitle (the value is an i18n key). Use `urlHelperLinkText` to show a placeholder/example URL inside the connect dialog's URI field.

---

## Step 4 — Logos

Copied to:

- `apps/web/src/images/integrations/logo-huntress-siem.svg`
- `apps/web/src/images/integrations/logo-huntress-siem-darkmode.svg`

> **Note:** The Huntress logo filenames don't follow the `logo-<name>-color.svg` convention used by other integrations. Use whatever filename the designer provides — just make sure the resolver references the exact same path.

---

## Step 5 — Tests

**File:** `bitwarden_license/bit-common/src/dirt/organization-integrations/services/organization-integration-service.spec.ts`

```typescript
describe("Huntress integration", () => {
  it("should save a new Huntress integration successfully", async () => {
    const config = OrgIntegrationBuilder.buildHecConfiguration(
      "https://hec.huntress.io/services/collector",
      "test-token",
      OrganizationIntegrationServiceName.Huntress,
    );
    const template = OrgIntegrationBuilder.buildHecTemplate(
      "test-index",
      OrganizationIntegrationServiceName.Huntress,
    );

    expect(JSON.parse(config.toString())).toEqual({
      Uri: "https://hec.huntress.io/services/collector",
      Scheme: "Bearer",
      Token: "test-token",
      bw_serviceName: "Huntress",
    });

    const parsed = JSON.parse(template.toString());
    expect(parsed.index).toBe("test-index");
    expect(parsed.bw_serviceName).toBe("Huntress");
    expect(parsed.event.type).toBe("#TypeId#");
  });
});
```

Run tests:

```bash
cd bitwarden_license/bit-common && npx jest src/dirt/organization-integrations/services/organization-integration-service.spec.ts
```

Result: **all tests passed**
