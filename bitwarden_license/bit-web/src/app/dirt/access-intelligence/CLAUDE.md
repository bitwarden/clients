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

### V2 Model Class Names

V2 model families use the final glossary names. V1 names are `@deprecated` in `report-models.ts`
and will be removed when V1 code is deleted. Use these names in all V2 code and comments.

| V2 Model Name          | Layer classes                                                                                             |
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
