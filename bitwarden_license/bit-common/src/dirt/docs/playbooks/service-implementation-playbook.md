# Service Implementation Playbook — Access Intelligence Rewrite

**Purpose:** Systematic implementation of domain services, persistence services, and data services

**Related:** [Component Migration Playbook](./component-migration-playbook.md) - Use for UI component work

---

## 📋 Which Playbook Should I Use?

| Task                                          | Use This Playbook   | Use Component Playbook                                     |
| --------------------------------------------- | ------------------- | ---------------------------------------------------------- |
| Implementing/refactoring services             | ✅ Service Playbook | ❌                                                         |
| Implementing domain models (Data/Domain/View) | ✅ Service Playbook | ❌                                                         |
| Adding view model query methods               | ✅ Service Playbook | ❌                                                         |
| Migrating UI components to V2                 | ❌                  | ✅ [Component Playbook](./component-migration-playbook.md) |
| Creating Storybook for components             | ❌                  | ✅ [Component Playbook](./component-migration-playbook.md) |
| Adding component tests                        | ❌                  | ✅ [Component Playbook](./component-migration-playbook.md) |

**See:** [CLAUDE.md](../../CLAUDE.md) for guidance on which playbook Claude should use automatically.

---

## Session Types & When to Use Them

| When                         | Session Type         | Prompt Pattern                          | Output                       |
| ---------------------------- | -------------------- | --------------------------------------- | ---------------------------- |
| Starting a new service       | **Abstract-first**   | Define the interface, wire DI, validate | `*.service.ts` (abstract)    |
| Understanding existing code  | **Discovery**        | Read + map responsibilities             | `sessions/*.md`              |
| Implementing a service       | **Implementation**   | Implement against the abstract          | `*.service.ts` + `*.spec.ts` |
| Adding model query methods   | **Model enrichment** | Add methods to view models              | `*.view.ts` + `*.spec.ts`    |
| Improving test coverage      | **Testing**          | Read service + write missing tests      | `*.spec.ts`                  |
| Documenting architecture     | **Documentation**    | Generate from code                      | `architecture/*.md`          |
| Evaluating a design question | **Spike/ADR**        | Explore options, write decision         | `decisions/*.md`             |

---

## Workflow Per Session

### Before Starting

```bash
cd ~/path/to/clients
git checkout dirt/access-int-performance  # or your working branch
git pull origin main
npm ci  # always from root
```

### Start Claude Code

```bash
claude  # from repo root — picks up root CLAUDE.md + dirt/CLAUDE.md
```

### Capturing Output as .md

Ask Claude Code directly:

```
Save that analysis to docs/access-intelligence/sessions/2026-02-10-<topic>.md
```

Or redirect:

```
Write a markdown summary of what we just did and save it to
docs/access-intelligence/sessions/2026-02-10-<topic>.md
```

### After Each Session

1. Review generated/modified files
2. `npm run test -- --filter=risk-insights` (or relevant filter)
3. Create: `docs: session log for <topic>` or `feat: add <service> abstract`
4. Update the extraction checklist

---

## Recommended Session Order

### Phase 1: Discovery & Analysis

#### Session 1 — Audit the Facade (RiskInsightsDataService)

```
Read bitwarden_license/bit-common/src/dirt/reports/risk-insights/services/
risk-insights-data.service.ts

For each public method and observable:
1. What does it expose to the UI?
2. Does it contain business logic, UI state logic, or just piping?
3. What orchestrator method does it delegate to?
4. Should this live in a domain service, a presentational service, or on the model?

Categorize every member as one of:
- DOMAIN (report data, critical apps, report generation)
- UI_STATE (drawer open/close, drawer type)
- MODEL_METHOD (filtering that should be a view model method)
- WIRING (just piping an observable through)

Output as a markdown table. Save to
docs/access-intelligence/sessions/2026-02-XX-facade-audit.md
```

#### Session 2 — Audit the Orchestrator

```
Read bitwarden_license/bit-common/src/dirt/reports/risk-insights/services/domain/
risk-insights-orchestrator.service.ts

Map every method to these categories:
- REPORT_GENERATION (loading ciphers, health checks, member mapping, aggregation)
- PERSISTENCE (compress, encrypt, save, load)
- CRITICAL_APPS (save/remove critical, review status)
- STATE_MANAGEMENT (BehaviorSubjects, progress tracking)
- CIPHER_HEALTH (HIBP, weak, reused checks)
- MEMBER_MAPPING (collection/group resolution)

For each method, document:
- Input parameters and their types
- Return type
- What other services it calls
- What state it reads/writes

Save to docs/access-intelligence/sessions/2026-02-XX-orchestrator-audit.md
```

#### Session 3 — Audit the Models

```
Read all files in:
bitwarden_license/bit-common/src/dirt/reports/risk-insights/models/

For each model (RiskInsights, RiskInsightsReport, RiskInsightsApplication,
RiskInsightsSummary), document:
1. Which layers exist (domain, data, view, api)?
2. What fields does each layer have?
3. What's missing for field-level encryption?
4. What query methods SHOULD exist on the view models based on how the
   facade and orchestrator currently filter/transform data?

Also identify any models that are used but don't follow the data model
architecture (legacy models still in use).

Save to docs/access-intelligence/sessions/2026-02-XX-model-audit.md
```

### Phase 2: Abstract-First Design

**⚠️ CRITICAL: Before implementing ANY service, complete Phase 0 (Prerequisites Check) first.**

#### Phase 0: Prerequisites Check (MANDATORY)

**Before starting service implementation:**

1. **Identify the domain model** the service will work with
   - Example: ReportPersistenceService → works with `RiskInsights` domain model

2. **Verify domain has required methods** (following Cipher pattern):

   ```typescript
   ✅ Required methods checklist:
   - [ ] decrypt() → View (Domain → View decryption)
   - [ ] toData() → Data (Domain → Data for storage)
   - [ ] fromJSON() → Domain (JSON deserialization)
   - [ ] fromView() → Domain (View → Domain with encryption) - if service creates domain from view
   ```

3. **If methods are missing (marked with `[TODO]`):**
   - ⛔ **STOP service implementation**
   - 🔄 **Switch to domain model implementation**
   - 📖 **Reference:** `@libs/common/src/vault/models/domain/cipher.ts` (canonical pattern)
   - ✅ **Implement missing methods** following Cipher pattern
   - 🧪 **Test domain methods** in isolation
   - 📝 **Document in session log** (new session for domain work)
   - ▶️ **Then return to service implementation**

4. **Why this is critical:**
   - Services **orchestrate**, domains **handle crypto**
   - If domain can't encrypt/decrypt itself, service will do it wrong (architectural violation)
   - Manual encryption in services = 40-60% more code + maintenance burden
   - See: [CLAUDE.md § 4-Layer Architecture](../../CLAUDE.md#4-layer-data-model-architecture-critical)

**Example from Batch 4:**

> ReportPersistenceService required `RiskInsights` to have `decrypt()`, `toData()`, `fromView()`.
> Found TODOs for these methods. Implemented domain methods first following Cipher pattern.
> Result: Service simplified by 41%, proper architectural separation achieved.

---

#### Session 4 — Define Service Abstracts

```
Based on the architecture in dirt/CLAUDE.md, create abstract classes for:

1. CipherHealthService
   - abstract checkHealth(ciphers: CipherView[]): Observable<Map<CipherId, CipherHealthResult>>

2. MemberCipherMappingService
   - abstract mapCiphersToMembers(
       ciphers: CipherView[],
       members: OrganizationUserView[],
       groups: GroupView[],
       collections: CollectionView[]
     ): Observable<{ mapping: Map<CipherId, MemberRef[]>, registry: MemberRegistry }>

3. ReportGenerationService
   - abstract generateReport(organizationId: OrganizationId): Observable<RiskInsightsView>

4. ReportPersistenceService
   - abstract saveReport(report: RiskInsights): Observable<void>
   - abstract saveApplicationMetadata(apps: RiskInsightsApplicationView[]): Observable<void>
   - abstract loadReport(organizationId: OrganizationId): Observable<RiskInsightsView>

5. AccessIntelligenceDataService (replaces RiskInsightsDataService)
   - report$: Observable<RiskInsightsView | null>
   - reportStatus$: Observable<ReportStatus>
   - etc.

6. DrawerStateService (presentational, Angular-only)
   - drawerState$: Observable<DrawerState>
   - open/close/setType methods

Use JSDoc comments on every method. Follow Bitwarden naming conventions.
Place in services/ directory with proper kebab-case filenames.
Do NOT implement — just the abstract classes.
```

#### Session 5 — Define View Model Methods

```
Based on the facade audit (Session 1), add query methods to the view models.

On RiskInsightsView:
- getAtRiskMembers(): MemberRegistryEntry[]
- getCriticalApplications(): RiskInsightsReportView[]
- getApplicationByHostname(hostname: string): RiskInsightsReportView | undefined
- getNewApplications(): RiskInsightsReportView[]  (reviewedDate === null)
- getSummary(): RiskInsightsSummaryView

On RiskInsightsReportView:
- getMemberDetails(): MemberRegistryEntry[]
- isAtRisk(): boolean
- getAtRiskPasswordCount(): number

These methods replace the filtering logic currently in the facade/orchestrator.
Add tests for each method.
```

#### Session 6 — Wire Abstracts into DI

```
Register the abstract classes in the Angular DI system.

For now, create Default* implementations that throw "not implemented" for each method.
The goal is to verify:
1. The DI wiring compiles
2. Components can inject the new services
3. The abstract API surface works with the existing components

Update the module/providers for the web client.
This should compile but not work at runtime yet.
```

### Phase 3: Implementation

#### Session 7 — Implement CipherHealthService

```
Implement DefaultCipherHealthService against the abstract.

Requirements:
- Accept CipherView[], return Map<CipherId, CipherHealthResult>
- Run weak/reused checks synchronously from cipher passwords
- Run HIBP checks with concurrency limiter (max 5 concurrent, from existing pattern)
- Return results as Observable (emit partial results as they complete? or wait for all?)
- Full Jest test coverage

Reference the existing password-health.service for HIBP patterns.
Reference the concurrency limiting added in PR #18773 (commit 54e6b0b).
```

#### Session 8 — Implement MemberCipherMappingService

```
Implement DefaultMemberCipherMappingService.

Key design point: this service builds a MemberRegistry (Map<OrganizationUserId,
MemberRegistryEntry>) that deduplicates member data. The cipher→member mapping
uses registry indices/IDs instead of full member objects.

Resolution logic:
1. For each cipher, find collections it belongs to
2. For each collection, find members assigned directly
3. For each collection, find groups assigned, then find members in those groups
4. Deduplicate and store in registry

The orchestrator (ReportGenerationService) is responsible for fetching the
org data (members, groups, collections) and passing it in. This service is
a pure transformation — no API calls.

Full Jest test coverage including edge cases.
```

#### Sessions 9-12 — Remaining Services

Follow the same pattern for:

- ReportGenerationService (composes CipherHealth + MemberMapping)
- ReportPersistenceService (compression + encryption + feature flag)
- AccessIntelligenceDataService (thin wiring)

### Phase 4: Integration & Cleanup

#### Session 13 — Extract DrawerStateService

```
Move all drawer state logic from RiskInsightsDataService into DrawerStateService.
This is an Angular-only presentational service using @Injectable.

State: BehaviorSubject<DrawerState> where DrawerState = {
  open: boolean;
  type: DrawerType;
  invokerId: string;
}

The drawer CONTENT (at-risk members, at-risk apps) should be computed from
report$ using the view model methods — not stored in drawer state.

Components that need drawer content do:
  combineLatest([drawerState$, report$]).pipe(
    map(([drawer, report]) => {
      if (drawer.type === DrawerType.OrgAtRiskMembers) {
        return report?.getAtRiskMembers() ?? [];
      }
      // etc
    })
  )
```

#### Session 14 — Connect to Components & Remove Old Code

```
Update components to inject new services instead of old facade/orchestrator.
Remove RiskInsightsDataService and RiskInsightsOrchestratorService.
Run full test suite. Verify all UI features work.
```

---

## 🔀 Service → Component Handoff

**When your service work is ready for UI integration**, follow this handoff process:

### Handoff Checklist

- [ ] Service implementation complete and tested
- [ ] View model methods documented (query + mutation)
- [ ] Data service exposes observables correctly
- [ ] Integration guide updated (if adding new patterns)

### What to Communicate

**Tell component developers:**

1. **Service to inject:** `AccessIntelligenceDataService` (or specific service)
2. **Observable to use:** `report$: Observable<RiskInsightsView | null>`
3. **Available model methods:**
   - Query examples: `report.getAtRiskMembers()`, `report.getCriticalApplications()`
   - Mutation examples: `report.markApplicationAsCritical(appName)`
4. **Usage pattern:**

   ```typescript
   // In component
   constructor(private dataService: AccessIntelligenceDataService) {}
   report = toSignal(this.dataService.report$);

   // In template
   @if (report(); as r) {
     <div>{{ r.getTotalMemberCount() }}</div>
   }
   ```

### See Also

- **[Integration Guide](/bitwarden_license/bit-common/src/dirt/docs/integration-guide.md)** - Full service ↔ component integration patterns
- **[Component Playbook](/bitwarden_license/playbooks/component-migration-playbook.md)** - For component developers

---

## Session Log Template (Optional)

**Note:** Session logs are **optional personal dev notes**, not required for the workflow. Use them if helpful for tracking your work.

**Location:** `~/Documents/bitwarden-notes/access-intelligence-sessions/` (external, not in repo)

**When to use:** If you find it helpful to:

- Track your thought process
- Document design decisions for future reference
- Keep notes on what worked/didn't work
- Record session duration for planning

**Template:**

```markdown
# Session: <Topic>

**Date:** YYYY-MM-DD
**Branch:** dirt/access-int-performance (or current branch)
**Phase:** Discovery | Abstract-First | Implementation | Integration
**Duration:** ~X min

## Objective

What I wanted to accomplish.

## Prerequisites Check (if implementing a service)

**Domain Model:** `<DomainModelName>`

Verified domain has required methods:

- [x] decrypt() → View
- [x] toData() → Data
- [x] fromJSON() → Domain
- [ ] fromView() → Domain (N/A - service doesn't create domain from view)

**Action taken:** None required | Implemented missing methods first (see session: YYYY-MM-DD-domain-<model>.md)

## Key Prompts Used

1. "..."
2. "..."

## Findings / Output

Summary of what was discovered or built.

## Files Created/Modified

- `path/to/file.ts` — what changed

## Design Decisions

- Decided X because Y
- Open question: Z (needs team discussion)

## Next Steps

- [ ] ...
```

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
