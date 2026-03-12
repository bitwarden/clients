# Access Intelligence: Service ↔ Component Integration

**Purpose:** Detailed guide for implementing Access Intelligence features that span services (bit-common) and components (bit-web)

**Audience:** Developers implementing Access Intelligence reports, visualizations, and user interactions

---

## 📋 Access Intelligence Architecture

```
┌─────────────────────────────────────────────────┐
│ Component (bit-web/access-intelligence)         │
│  - User interactions                             │
│  - Display logic                                 │
│  - Converts Observables → Signals (toSignal())  │
│  - OnPush + Signal inputs/outputs                │
├─────────────────────────────────────────────────┤
│ AccessIntelligenceDataService                    │
│  - Single report$ observable                     │
│  - Exposes data to components                    │
│  - Delegates business logic to models            │
│  - Delegates persistence to services             │
├─────────────────────────────────────────────────┤
│ Domain Services (bit-common/dirt)                │
│  - Business logic orchestration                  │
│  - Pure transformation                           │
│  - Platform-agnostic                             │
├─────────────────────────────────────────────────┤
│ View Models                                      │
│  - Smart models (CipherView pattern)             │
│  - Query methods: getAtRiskMembers()             │
│  - Mutation methods: markApplicationAsCritical() │
└─────────────────────────────────────────────────┘
```

---

## 🔀 Service → Component Integration

### Standard Pattern

**Service exposes:**

```typescript
// AccessIntelligenceDataService
report$: Observable<RiskInsightsView | null>;
```

**Component consumes:**

```typescript
// In component
constructor(private dataService: AccessIntelligenceDataService) {}

report$ = this.dataService.report$;
reportSignal = toSignal(this.report$);

// In template
@if (reportSignal(); as report) {
  <div>{{ report.getTotalMemberCount() }}</div>
}
```

### Example 1: Adding "At-Risk Members Drawer"

**Service work (DONE):**

- ✅ `RiskInsightsView.getAtRiskMembers()` method implemented
- ✅ `AccessIntelligenceDataService.report$` exposes data
- ✅ Tests confirm method returns correct members

**Component work (NEXT):**

1. Create `AtRiskMembersDrawerComponent`
2. Inject `AccessIntelligenceDataService`
3. Convert `report$` to signal with `toSignal()`
4. Call `report.getAtRiskMembers()` in template
5. Display member list

**Handoff information:**

```typescript
// Tell component developer:
// 1. Service to inject: AccessIntelligenceDataService
// 2. Observable to use: report$: Observable<RiskInsightsView | null>
// 3. Model method available: report.getAtRiskMembers(): MemberRegistryEntry[]
// 4. Returns: Array of { id, email, name, hasAccess: boolean }
```

---

## 🔀 Component → Service Integration

### Example 2: Component Needs "Filter by Critical Apps"

**Component work (BLOCKED):**

- Component wants to display only critical applications
- No method exists on `RiskInsightsView` yet

**Handoff to service developer:**

```typescript
// What the component needs: "List of only critical applications"
// Proposed API: report.getCriticalApplications(): RiskInsightsReportView[]
// Why: User toggles "Show only critical" filter
// Format: Array of application view models with isCritical === true
// Performance: Could be 100+ applications
```

**Service work (NEEDED):**

1. Add `RiskInsightsView.getCriticalApplications(): RiskInsightsReportView[]`
2. Add tests for the new method
3. Update documentation
4. Notify component developer when done

**Component work (UNBLOCKED):**

- Use `report.getCriticalApplications()` in template
- Display filtered list

---

## 📝 Example: Adding New Report Type (Full Cycle)

### Phase 1: Service Work

1. **Define domain models** (Api → Data → Domain → View)
   - `NewReportTypeApi`, `NewReportTypeData`, `NewReportType`, `NewReportTypeView`

2. **Add view model methods**
   - Query: `NewReportTypeView.getSomeData()`
   - Mutation: `NewReportTypeView.updateSomeData()`

3. **Implement services**
   - Generation service: `NewReportTypeGenerationService`
   - Persistence: Update `ReportPersistenceService` to handle new type
   - Data service: Update `AccessIntelligenceDataService` to expose new report

4. **Test everything**
   - Unit tests for models
   - Unit tests for services
   - Integration tests for full pipeline

5. **Document handoff**
   - What observables to use
   - What model methods are available
   - Example usage in components

### Phase 2: Component Work

1. **Create V2 component**
   - `new-report-type-v2.component.ts`
   - Inject `AccessIntelligenceDataService`
   - Use `toSignal()` to convert observables

2. **Implement UI**
   - Display report data using view model methods
   - Handle user actions via model mutation methods
   - OnPush change detection

3. **Add Storybook**
   - Document all component variants
   - Interactive controls for testing

4. **Add tests**
   - Component rendering
   - User interactions
   - Model method calls

5. **Wire into routing**
   - Add route to `access-intelligence-routing.module.ts`
   - Update navigation

---

## 🧪 Testing Access Intelligence Features

### Service Layer Tests

**Test that services:**

- Return correct view models
- Observable emits expected data
- Error handling works
- Performance is acceptable

```typescript
it("should return at-risk members", (done) => {
  service.report$.pipe(take(1)).subscribe((report) => {
    const members = report?.getAtRiskMembers();
    expect(members).toHaveLength(5);
    expect(members[0].email).toBe("user@example.com");
    done();
  });
});
```

### Component Layer Tests

**Test that components:**

- Correctly inject services
- Convert observables to signals
- Call view model methods
- Display data correctly

```typescript
it("should display at-risk member count", () => {
  const mockReport = new RiskInsightsView();
  mockReport.getAtRiskMembers = jest.fn(() => [member1, member2]);

  component.reportSignal = signal(mockReport);
  fixture.detectChanges();

  expect(component.memberCount()).toBe(2);
  expect(screen.getByText("2 at-risk members")).toBeInTheDocument();
});
```

### Integration Tests (E2E)

**Test that:**

- User actions trigger service calls
- Data flows correctly from service → component
- UI updates when data changes

---

## 🚨 Access Intelligence-Specific Pitfalls

### 1. Directly Using API Services in Components

**❌ Wrong:**

```typescript
// In component
constructor(private apiService: RiskInsightsApiService) {}
ngOnInit() {
  this.apiService.getReport().subscribe(...);
}
```

**✅ Correct:**

```typescript
// In component
constructor(private dataService: AccessIntelligenceDataService) {}
report = toSignal(this.dataService.report$);
```

**Why:** Components should never call API services directly. Always go through `AccessIntelligenceDataService`.

### 2. Business Logic in Components

**❌ Wrong:**

```typescript
// In component
markCritical(app: Application) {
  app.isCritical = true;
  this.summary.criticalCount++;
  this.dataService.save(app);
}
```

**✅ Correct:**

```typescript
// In component
markCritical(app: Application) {
  this.report.markApplicationAsCritical(app.name);
  this.dataService.saveReport(this.report);
}
```

**Why:** Business logic belongs in view models, not components. Components coordinate but don't implement logic.

---

## 📊 Common Access Intelligence Patterns

### Pattern 1: Loading Report Data

```typescript
// Component
report = toSignal(this.dataService.report$);

// Template
@if (report(); as reportData) {
  <app-report-summary [report]="reportData" />
} @else {
  <app-loading-spinner />
}
```

### Pattern 2: User Action on Report

```typescript
// Component
onMarkCritical(applicationName: string) {
  const report = this.report();
  if (report) {
    report.markApplicationAsCritical(applicationName);
    // Service watches for changes and persists automatically
  }
}
```

### Pattern 3: Filtering/Querying Report Data

```typescript
// Component
filteredApps = computed(() => {
  const report = this.report();
  const showCriticalOnly = this.showCriticalFilter();

  if (!report) return [];

  return showCriticalOnly ? report.getCriticalApplications() : report.getAllApplications();
});
```

---

## 📞 Access Intelligence Contacts

### Service Questions

- Check: [Architecture Review](/bitwarden_license/bit-common/src/dirt/docs/access-intelligence/architecture/architecture-review.md)
- Ask: DIRT team service developers

### Component Questions

- Ask: DIRT team component developers

---

## 📚 Related Documentation

- [Generic Integration Guide](/bitwarden_license/bit-common/src/dirt/docs/integration-guide.md)
- [Architecture Review](/bitwarden_license/bit-common/src/dirt/docs/access-intelligence/architecture/architecture-review.md)
- [Standards](/bitwarden_license/bit-common/src/dirt/docs/standards/standards.md)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team (Access Intelligence)
