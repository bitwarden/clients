# Create HEC Event Integration (Token Type Auth) Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Claude skill at `apps/web/.claude/skills/create-hec-event-integration-using-token-auth/SKILL.md` that guides DIRT team developers through adding a new HEC event integration in 4 steps.

**Architecture:** A single SKILL.md file scoped to `apps/web/.claude/skills/`. The skill asks for a service name and optional logo files upfront, then substitutes them throughout all steps. It reuses existing `HecConfiguration`, `HecTemplate`, and `openHecConnectDialog` — no new classes or dialogs are created.

**Tech Stack:** Markdown, YAML frontmatter (agentskills spec), Angular/TypeScript code examples

---

### Task 1: Create the skill directory and SKILL.md

**Files:**

- Create: `apps/web/.claude/skills/create-hec-event-integration-using-token-auth/SKILL.md`

- [ ] **Step 1: Create the skill file**

Create `apps/web/.claude/skills/create-hec-event-integration-using-token-auth/SKILL.md` with the following content:

````markdown
---
name: create-hec-event-integration-using-token-auth
description: Use when adding a new HEC (HTTP Event Collector) event integration to the Bitwarden web client for the DIRT team. Implements the Splunk token authentication model (Bearer token + URI). Covers feature flag setup and card registration behind the flag. Does not apply to API key integrations or integrations requiring a custom connect dialog.
---

# Create HEC Event Integration

## Overview

Adds a new HEC (HTTP Event Collector) event integration using the **Splunk token authentication model** (Bearer token + endpoint URI). The integration is gated behind a feature flag and uses the shared `openHecConnectDialog` — no new configuration classes, template classes, or dialog components are needed.

## Before You Start

Ask the user the following questions before executing any steps:

1. **Service name:** "What is the service name for this integration?" (e.g. `Splunk`, `CrowdStrike`, `Panther`)

   Use this as `<ServiceName>` throughout. The string value in the constant must exactly match what you use as the card's `name` in Step 3 — a mismatch silently saves the config with the wrong service name.

2. **Logos:** "Do you have the integration logo(s) ready to provide?"
   - **If yes** — ask for the light-mode SVG file path, and optionally a dark-mode SVG path. Copy both to `apps/web/src/images/integrations/` using the naming convention `logo-<service-name-kebab>-color.svg` and `logo-<service-name-kebab>-darkmode.svg`. Use those filenames in Step 3.
   - **If no** — use placeholder paths in Step 3 and add a `// TODO: add logo before shipping` comment.

## Step 1 — Add service name constant

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
````

## Step 2 — Add feature flag

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

## Step 3 — Register the card behind the feature flag

**File:** `bitwarden_license/bit-web/src/app/dirt/organization-integrations/organization-integrations.resolver.ts`

If logos were provided, copy them to `apps/web/src/images/integrations/` first, then use the actual filenames below. If not, use the placeholder paths shown and add the TODO comment:

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

No changes needed to `IntegrationCardComponent` — new HEC services fall into the existing `else` branch, which calls `openHecConnectDialog` → `saveHec` → `deleteHec`. These methods already call `buildHecConfiguration` and `buildHecTemplate` using the card's `name` as the service name.

## Step 4 — Add tests

**File:** `bitwarden_license/bit-common/src/dirt/organization-integrations/services/organization-integration-service.spec.ts`

Follow the existing Huntress or CrowdStrike test block as a reference — both are HEC-type integrations. Cover save, update, delete, and load operations:

```typescript
describe("<ServiceName> integration", () => {
  it("should save a new <ServiceName> integration successfully", async () => {
    const config = OrgIntegrationBuilder.buildHecConfiguration(
      "https://test.<servicename>.com/hec",
      "test-token",
      OrganizationIntegrationServiceName.<ServiceName>,
    );
    const template = OrgIntegrationBuilder.buildHecTemplate(
      "test-index",
      OrganizationIntegrationServiceName.<ServiceName>,
    );
    // assert config serializes correctly
    expect(JSON.parse(config.toString())).toEqual({
      Uri: "https://test.<servicename>.com/hec",
      Scheme: "Bearer",
      Token: "test-token",
      bw_serviceName: "<ServiceName>",
    });
    // assert template serializes correctly
    const parsed = JSON.parse(template.toString());
    expect(parsed.index).toBe("test-index");
    expect(parsed.bw_serviceName).toBe("<ServiceName>");
    expect(parsed.event.type).toBe("#TypeId#");
  });
});
```

## Common Mistakes

| Mistake                                                                 | Fix                                                                                                   |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `name` in card doesn't match `OrganizationIntegrationServiceName` value | They must be identical strings — `saveHec()` casts the name directly                                  |
| Feature flag default not set to `FALSE`                                 | Always add the default entry in `defaultFlags`; new flags default to `FALSE`                          |
| Kebab-case mismatch in flag string                                      | Convert the service name consistently: lowercase, spaces → hyphens                                    |
| Adding a new `OrganizationIntegrationType`                              | Not needed — all HEC services share `OrganizationIntegrationType.Hec`                                 |
| Creating a new config/template class                                    | Not needed — `HecConfiguration` and `HecTemplate` handle all HEC services                             |
| Referencing an image path without copying the file                      | Copy SVGs to `apps/web/src/images/integrations/` first; if logos aren't ready, leave the TODO comment |

````

- [ ] **Step 2: Verify the skill directory and file exist**

```bash
ls apps/web/.claude/skills/create-hec-event-integration-using-token-auth/
````

Expected output:

```
SKILL.md
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/.claude/skills/create-hec-event-integration-using-token-auth/SKILL.md
git commit -m "feat(dirt): add create-hec-event-integration-using-token-auth skill"
```

---

### Task 2: Update MEMORY.md to index the new skill

**Files:**

- Modify: `~/.claude/projects/-Users-vijayoommen-Projects-bitwarden-clients/memory/MEMORY.md`

- [ ] **Step 1: Add a pointer to the new skill in MEMORY.md**

Add the following line under a relevant section (create a "Skills" section if one doesn't exist):

```markdown
- [create-hec-event-integration-using-token-auth skill](apps/web/.claude/skills/create-hec-event-integration-using-token-auth/SKILL.md) — DIRT team skill for adding new HEC event integrations with feature flag
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/.claude/skills/create-hec-event-integration-using-token-auth/SKILL.md
git commit -m "docs(dirt): index create-hec-event-integration-using-token-auth skill in memory"
```
