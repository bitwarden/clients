# Access Intelligence - Component Context

> Scope: `bitwarden_license/bit-web/src/app/dirt/access-intelligence/` (Angular web components).
> Supplements the repo-wide `/.claude/CLAUDE.md`. Note: the DIRT team-level file at
> `bitwarden_license/bit-common/src/dirt/CLAUDE.md` does not auto-load here (different subtree),
> so the most relevant team context is linked below.

## Quick Navigation

- **Full team context, architecture, services:** [Team CLAUDE.md](/bitwarden_license/bit-common/src/dirt/CLAUDE.md)
- **Team docs hub / getting started:** [docs/README.md](/bitwarden_license/bit-common/src/dirt/docs/README.md), [getting-started.md](/bitwarden_license/bit-common/src/dirt/docs/getting-started.md)

> Detailed Angular/testing standards docs are tracked for a follow-up. The high-value
> checklists are inlined below so this file is self-contained today.

## Known Architecture Gaps

### Model Class Names (current vs. legacy)

The current Access Intelligence models live under
`/bitwarden_license/bit-common/src/dirt/access-intelligence/models/` (`api/`, `data/`, `domain/`,
`view/`) and use the names in the table below. Use these names in all new code and comments.

The legacy ("V1") models still live in
`/bitwarden_license/bit-common/src/dirt/reports/risk-insights/models/report-models.ts`
(`RiskInsightsData`, `OrganizationReportSummary`, `OrganizationReportApplication`,
`ApplicationHealthReportDetail`). They are **not** annotated `@deprecated` in code; treat them as
legacy regardless. Do not extend them in new work; they are expected to be removed once the V1 code
path is deleted.

The V2 models are the new architecture, gated behind
`FeatureFlag.AccessIntelligenceNewArchitecture` (`pm-31936-access-intelligence-new-architecture`,
currently off by default); V1 remains the active path until that flag is enabled and the V1 cleanup
lands.

| V2 Model Name          | Layer classes (api / data / domain / view)                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `AccessReport`         | `AccessReportApi`, `AccessReportData`, `AccessReport`, `AccessReportView`                                 |
| `ApplicationHealth`    | `ApplicationHealthApi`, `ApplicationHealthData`, `ApplicationHealth`, `ApplicationHealthView`             |
| `AccessReportSummary`  | `AccessReportSummaryApi`, `AccessReportSummaryData`, `AccessReportSummary`, `AccessReportSummaryView`     |
| `AccessReportSettings` | `AccessReportSettingsApi`, `AccessReportSettingsData`, `AccessReportSettings`, `AccessReportSettingsView` |
| `AccessReportMetrics`  | `AccessReportMetricsApi`, `AccessReportMetricsData`, `AccessReportMetrics`, `AccessReportMetricsView`     |

### 4-Layer Model Mapping Is Not Always 1:1

The 4-layer model (Api -> Data -> Domain -> View) is not strictly 1:1 for all models. Some
view-layer constructs (e.g., `MemberRegistry`) have no direct domain counterpart; they are
reconstituted from the decrypted payload rather than lifted from a domain field. Review cross-layer
`{@link}` references when documenting, since deprecated/repurposed models can make them misleading.

## Standards Compliance Checklist (apply to all modified files)

- [ ] Components use `ChangeDetectionStrategy.OnPush`
- [ ] New subscriptions use `takeUntilDestroyed(this.destroyRef)` (or convert to `toSignal()`)
- [ ] Signals follow Angular modernization patterns (`input()`, `output()`, `computed()`)
- [ ] Tests use deterministic data (no `Math.random()`, no `new Date()`)
- [ ] Storybook stories use fixtures (e.g. `story-fixtures.ts`)
- [ ] Follow the Angular Architecture Patterns in [/.claude/CLAUDE.md](/.claude/CLAUDE.md#angular-architecture-patterns)

## Dependency Audit (before implementing)

When a component needs a new observable from a service, the full change chain is:

1. **Abstraction** - add the property to the abstract class
2. **Default implementation** - add `BehaviorSubject` + emissions
3. **Mock in spec** - add `BehaviorSubject` to the mock type and `beforeEach`

When using an existing component or service as a dependency, check it for FIXMEs and note them in
your plan (don't block on them, but track them).

## Pre-commit Checklist

- [ ] No `console.*` statements (use Storybook `action()` for logging in stories)
- [ ] No exposed `BehaviorSubject`s (expose `.asObservable()` instead)
- [ ] All subscriptions use `takeUntilDestroyed()` or are converted to `toSignal()`
- [ ] All promises are awaited or use the `void` operator
- [ ] No unused imports/variables

---

**For complete project context, architecture, and service documentation:**
-> [Team CLAUDE.md](/bitwarden_license/bit-common/src/dirt/CLAUDE.md)
