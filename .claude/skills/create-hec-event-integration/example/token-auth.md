# Example: Blumira HEC Integration (Token Auth)

A completed walkthrough of the skill using **Blumira** as the service name.

---

## Prompts answered

| Prompt         | Answer                           |
| -------------- | -------------------------------- |
| Service name   | `Blumira`                        |
| Authentication | Token                            |
| Logos ready?   | Yes — light + dark SVGs provided |

---

## Step 1 — Service name constant

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

## Step 2 — Feature flag

**File:** `libs/common/src/enums/feature-flag.enum.ts`

```typescript
// In the FeatureFlag enum (DIRT section):
EventManagementForBlumira = "event-management-for-blumira",

// In defaultFlags (DIRT section):
[FeatureFlag.EventManagementForBlumira]: FALSE,
```

---

## Step 3 — Card registration

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

## Step 4 — Logos

Copied to:

- `apps/web/src/images/integrations/logo-blumira-color.svg`
- `apps/web/src/images/integrations/logo-blumira-darkmode.svg`

---

## Step 5 — Tests

**File:** `bitwarden_license/bit-common/src/dirt/organization-integrations/services/organization-integration-service.spec.ts`

````typescript
describe("Blumira integration", () => {
  it("should save a new Blumira integration successfully", async () => {
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

  it("should update a Blumira integration successfully", async () => {
    const config = OrgIntegrationBuilder.buildHecConfiguration(
      "https://updated.blumira.com/hec",
      "updated-token",
      OrganizationIntegrationServiceName.Blumira,
    );
    const template = OrgIntegrationBuilder.buildHecTemplate(
      "updated-index",
      OrganizationIntegrationServiceName.Blumira,
    );

    expect(JSON.parse(config.toString())).toEqual({
      Uri: "https://updated.blumira.com/hec",
      Scheme: "Bearer",
      Token: "updated-token",
      bw_serviceName: "Blumira",
    });

    const parsed = JSON.parse(template.toString());
    expect(parsed.index).toBe("updated-index");
    expect(parsed.bw_serviceName).toBe("Blumira");
  });

  it("should delete a Blumira integration successfully", async () => {
    // ... uses standard delete flow via service.delete(orgId, integrationId, configurationId)
    const result = await service.delete(orgId, integrationId, configurationId);
    expect(result).toEqual({ mustBeOwner: false, success: true });
  });

  it("should load a Blumira integration from API response", async () => {
    // ... mocks getOrganizationIntegrations with a Blumira HEC response
    const integrations = await firstValueFrom(service.integrations$);
    expect(integrations).toHaveLength(1);
    expect(integrations[0].type).toBe(OrganizationIntegrationType.Hec);
  });
});
## Step 5 — Tests

**File:** `bitwarden_license/bit-common/src/dirt/organization-integrations/services/organization-integration-service.spec.ts`

```typescript
describe("HEC token-based integration", () => {
  it("should save a new HEC token integration successfully", async () => {
    const config = OrgIntegrationBuilder.buildHecConfiguration(
      "https://test.example.com/hec",
      "test-token",
      OrganizationIntegrationServiceName.Huntress,
    );
    const template = OrgIntegrationBuilder.buildHecTemplate(
      "test-index",
      OrganizationIntegrationServiceName.Huntress,
    );

    expect(JSON.parse(config.toString())).toEqual({
      Uri: "https://test.example.com/hec",
      Scheme: "Bearer",
      Token: "test-token",
      bw_serviceName: "Huntress",
    });

    const parsed = JSON.parse(template.toString());
    expect(parsed.index).toBe("test-index");
    expect(parsed.bw_serviceName).toBe("Huntress");
    expect(parsed.event.type).toBe("#TypeId#");
  });

  it("should update an HEC token integration successfully", async () => {
    const config = OrgIntegrationBuilder.buildHecConfiguration(
      "https://updated.example.com/hec",
      "updated-token",
      OrganizationIntegrationServiceName.Huntress,
    );
    const template = OrgIntegrationBuilder.buildHecTemplate(
      "updated-index",
      OrganizationIntegrationServiceName.Huntress,
    );

    expect(JSON.parse(config.toString())).toEqual({
      Uri: "https://updated.example.com/hec",
      Scheme: "Bearer",
      Token: "updated-token",
      bw_serviceName: "Huntress",
    });

    const parsed = JSON.parse(template.toString());
    expect(parsed.index).toBe("updated-index");
    expect(parsed.bw_serviceName).toBe("Huntress");
  });

  it("should delete an HEC token integration successfully", async () => {
    const result = await service.delete(orgId, integrationId, configurationId);
    expect(result).toEqual({ mustBeOwner: false, success: true });
  });

  it("should load an HEC token integration from API response", async () => {
    const integrations = await firstValueFrom(service.integrations$);
    expect(integrations).toHaveLength(1);
    expect(integrations[0].type).toBe(OrganizationIntegrationType.Hec);
  });
});
````

Run tests:

```bash
cd bitwarden_license/bit-common && npx jest src/dirt/organization-integrations/services/organization-integration-service.spec.ts
```

Result: **32 tests passed**

Run tests:

```bash
cd bitwarden_license/bit-common && npx jest src/dirt/organization-integrations/services/organization-integration-service.spec.ts
```

Result: **32 tests passed**
