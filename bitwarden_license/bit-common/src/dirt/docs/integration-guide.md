# Service ↔ Component Integration Guide

**Purpose:** Coordination guide for features that span both platform-agnostic services (bit-common) and Angular UI components (bit-web/bit-browser)

**Scope:** This guide applies to **any DIRT feature** requiring work in both service and component layers. For feature-specific integration patterns and detailed examples, see the feature's documentation:

- [Access Intelligence Integration](/bitwarden_license/bit-common/src/dirt/docs/access-intelligence/service-component-integration.md)

**Focus:** This document focuses on **coordination and handoffs** between service and component developers. For code patterns and standards, see [Standards Documentation](/bitwarden_license/bit-common/src/dirt/docs/standards/standards.md).

---

## 📋 When You Need Both

Many DIRT features require coordinated work across service AND component layers:

| Feature Type               | Service Work                  | Component Work                    |
| -------------------------- | ----------------------------- | --------------------------------- |
| **New report/data type**   | Generate, persist, load data  | Display data, filters, navigation |
| **New data visualization** | Aggregate/query data          | Charts, cards, tables             |
| **User actions**           | Business logic on models      | UI interactions, forms            |
| **Settings/preferences**   | Persist settings              | Settings UI                       |
| **Integrations**           | API communication, sync logic | Configuration UI, status display  |

---

## 🔄 Integration Pattern

```
┌─────────────────────────────────────────────────┐
│ Component (bit-web/bit-browser)                  │
│  - User interactions                             │
│  - Display logic                                 │
│  - Converts Observables → Signals (toSignal())  │
│  - OnPush + Signal inputs/outputs                │
├─────────────────────────────────────────────────┤
│ Data Service (Feature-specific)                  │
│  - Exposes Observable streams                    │
│  - Coordinates feature data                      │
│  - Delegates business logic to models            │
│  - Delegates persistence to services             │
├─────────────────────────────────────────────────┤
│ Domain Services (bit-common)                     │
│  - Business logic orchestration                  │
│  - Pure transformation                           │
│  - Platform-agnostic                             │
├─────────────────────────────────────────────────┤
│ View Models                                      │
│  - Smart models (CipherView pattern)             │
│  - Query methods: getData(), filter(), etc.      │
│  - Mutation methods: update(), delete(), etc.    │
└─────────────────────────────────────────────────┘
```

**Key principle:** Services do the work, components coordinate the UI. Business logic lives in view models, not components.

---

## 🔀 Service → Component Handoff

**When:** Service implementation is complete, ready for UI integration

### Readiness Checklist

Before handing off to component developer, ensure:

- [ ] **Service is complete and tested**
  - [ ] Abstract defined with JSDoc
  - [ ] Implementation complete
  - [ ] Tests passing (`npm run test`)
  - [ ] Types validated (`npm run test:types`)

- [ ] **View models have required methods**
  - [ ] Query methods for component data needs (documented)
  - [ ] Mutation methods for user actions (documented)
  - [ ] Methods follow naming conventions

- [ ] **Data service exposes observables**
  - [ ] Observable(s) are public and documented
  - [ ] Observable emits correct view models
  - [ ] Observable handles errors gracefully

- [ ] **Component requirements documented**
  - [ ] What data the component needs
  - [ ] What user actions the component handles
  - [ ] What the component should display
  - [ ] Any performance considerations

### Handoff Communication Template

When handing off to component developer, provide:

1. **What service to inject**
   - Example: `FeatureDataService`

2. **What observable(s) to use**
   - Example: `data$: Observable<FeatureView | null>`
   - Type signature and nullability

3. **What model methods are available**
   - Query methods: `feature.getData()`, `feature.filter(criteria)`
   - Mutation methods: `feature.update(data)`, `feature.delete(id)`
   - Link to model documentation or JSDoc

4. **How to integrate in component**
   - Reference [Standards: Observable to Signal Conversion](/bitwarden_license/bit-common/src/dirt/docs/standards/standards.md)
   - Basic pattern: inject service → convert observable to signal → use in template

5. **Any gotchas or special considerations**
   - Performance notes (large datasets, expensive operations)
   - Error handling requirements
   - Special states (loading, empty, error)

### Communication Methods

- **Slack:** Quick handoff for simple integrations
- **Jira comment:** Document handoff details on feature ticket
- **Documentation:** Update feature docs with integration examples
- **Pair session:** For complex integrations, schedule pairing

---

## 🔀 Component → Service Handoff

**When:** Component needs new data/functionality not yet available in services

### Discovery Checklist

Before creating a service request, identify:

- [ ] **What's missing**
  - [ ] New query method needed on view model?
  - [ ] New mutation method needed on view model?
  - [ ] New service needed entirely?
  - [ ] New data needs to be loaded/persisted?

- [ ] **Document the requirement clearly**
  - [ ] What data the component needs (shape, type)
  - [ ] What format the data should be in
  - [ ] What user action triggers this need
  - [ ] Performance requirements (dataset size, frequency)

- [ ] **Assess scope**
  - [ ] Is this a new method on existing model? (small change)
  - [ ] Is this a new service? (medium-large change)
  - [ ] Does this require API changes? (involves backend team)

- [ ] **File appropriate ticket**
  - [ ] Link to component/feature that needs it
  - [ ] Link to design/mockup if applicable
  - [ ] Tag service developer or tech lead

### Handoff Communication Template

When requesting service work, provide:

1. **What the component needs**
   - Clear description: "Component needs list of filtered items based on user criteria"

2. **Proposed API (if you have one)**
   - Example: `model.getFilteredItems(criteria): Item[]`
   - This is negotiable, service developer may suggest better approach

3. **Why (user story/context)**
   - Example: "User clicks 'Show only critical' filter, UI should update to show subset"

4. **Data format expected**
   - Example: "Array of `{ id: string, name: string, isCritical: boolean }`"
   - Or reference existing model type if reusing

5. **Performance/scale considerations**
   - Example: "Could be 1000+ items for large organizations"
   - Helps service developer optimize

6. **Timeline/priority**
   - Is this blocking component work?
   - Can component proceed with stub/mock for now?

### Communication Methods

- **Jira ticket:** For non-trivial work requiring tracking
- **Slack:** For quick questions or small additions
- **Planning session:** For large features requiring design discussion
- **ADR:** If architectural decision needed

---

## 🤝 Collaboration Patterns

### Pattern 1: Parallel Development

**When to use:** Service and component work can be developed simultaneously

**How:**

1. Service developer creates interface/abstract first
2. Component developer uses interface with mock data
3. Both develop in parallel
4. Integration happens at the end

**Benefits:** Faster delivery, clear contracts

### Pattern 2: Sequential Development (Service First)

**When to use:** Component needs complete service implementation

**How:**

1. Service developer implements fully
2. Service developer documents integration
3. Component developer integrates
4. Component developer provides feedback

**Benefits:** Fewer integration issues, clearer requirements

### Pattern 3: Sequential Development (Component First)

**When to use:** UI/UX needs to be proven before service investment

**How:**

1. Component developer builds with mock data
2. Component developer documents data needs
3. Service developer implements to match needs
4. Integration and refinement

**Benefits:** User-driven design, avoids unused service work

### Pattern 4: Paired Development

**When to use:** Complex integration, unclear requirements, new patterns

**How:**

1. Service and component developer pair on design
2. Develop together or in short iterations
3. Continuous feedback and adjustment

**Benefits:** Fastest problem solving, shared understanding

---

## 🧪 Testing Integration Points

### Service Layer Testing

**Service developers should test:**

- Services return correct view models
- Observables emit expected data
- Error handling works correctly
- Performance is acceptable for expected dataset sizes

**Reference:** [Service Implementation Playbook - Testing](/bitwarden_license/bit-common/src/dirt/docs/playbooks/service-implementation-playbook.md)

### Component Layer Testing

**Component developers should test:**

- Services are correctly injected
- Observables are correctly converted to signals
- View model methods are called appropriately
- Data is displayed correctly
- User interactions trigger correct model methods

**Reference:** [Component Migration Playbook - Testing](/bitwarden_license/bit-common/src/dirt/docs/playbooks/component-migration-playbook.md)

### Integration Testing

**Both should coordinate on:**

- Full user flows work end-to-end
- Data flows correctly from service → component
- UI updates when data changes
- Error states are handled gracefully

---

## 🚨 Common Integration Pitfalls

### 1. Component Bypasses Data Service

**Problem:** Component directly calls API services or persistence layers

**Why it's bad:** Breaks abstraction, duplicates logic, harder to test

**Solution:** Always go through feature's data service layer

**Reference:** [Standards: Service Layer Pattern](/bitwarden_license/bit-common/src/dirt/docs/standards/standards.md)

### 2. Service Returns Plain Objects

**Problem:** Service returns `{ ... }` instead of view model instances

**Why it's bad:** Loses model methods, breaks encapsulation, business logic leaks to components

**Solution:** Always return view model instances with query/mutation methods

**Reference:** [Standards: View Models](/bitwarden_license/bit-common/src/dirt/docs/standards/standards.md)

### 3. Business Logic in Components

**Problem:** Component implements filtering, calculations, state changes

**Why it's bad:** Logic not reusable, harder to test, violates separation of concerns

**Solution:** Business logic belongs in view models or domain services

**Reference:** [Standards: Component Responsibilities](/bitwarden_license/bit-common/src/dirt/docs/standards/standards.md)

### 4. Manual Observable Subscriptions

**Problem:** Component uses `.subscribe()` instead of `toSignal()`

**Why it's bad:** Memory leaks, manual cleanup needed, doesn't leverage Angular signals

**Solution:** Use `toSignal()` for automatic cleanup and signal integration

**Reference:** [Standards: Observable to Signal Conversion](/bitwarden_license/bit-common/src/dirt/docs/standards/standards.md)

### 5. Unclear Handoff

**Problem:** Service developer finishes work but doesn't communicate to component developer

**Why it's bad:** Delays integration, component developer doesn't know work is ready

**Solution:** Use handoff communication templates above, update Jira tickets, notify in Slack

---

## 📞 Who to Contact

### Service Questions

- Check: [Service Implementation Playbook](/bitwarden_license/bit-common/src/dirt/docs/playbooks/service-implementation-playbook.md)
- Check: [Standards](/bitwarden_license/bit-common/src/dirt/docs/standards/standards.md)
- Ask: DIRT team service developers

### Component Questions

- Check: [Component Migration Playbook](/bitwarden_license/bit-common/src/dirt/docs/playbooks/component-migration-playbook.md)
- Check: [Standards](/bitwarden_license/bit-common/src/dirt/docs/standards/standards.md)
- Ask: DIRT team component developers

### Architecture Questions

- Check: [Architecture Docs](/bitwarden_license/bit-common/src/dirt/docs/access-intelligence/architecture/)
- Check: [Getting Started](/bitwarden_license/bit-common/src/dirt/docs/getting-started.md)
- Ask: DIRT team tech lead

### Coordination/Process Questions

- Ask: DIRT team lead or scrum master

---

## 📚 Related Documentation

### General Guides

- [Getting Started](/bitwarden_license/bit-common/src/dirt/docs/getting-started.md)
- [Standards](/bitwarden_license/bit-common/src/dirt/docs/standards/standards.md)
- [Documentation Structure](/bitwarden_license/bit-common/src/dirt/docs/documentation-structure.md)

### Implementation Playbooks

- [Service Implementation Playbook](/bitwarden_license/bit-common/src/dirt/docs/playbooks/service-implementation-playbook.md)
- [Component Migration Playbook](/bitwarden_license/bit-common/src/dirt/docs/playbooks/component-migration-playbook.md)

### Feature-Specific Integration Guides

- [Access Intelligence Integration](/bitwarden_license/bit-common/src/dirt/docs/access-intelligence/service-component-integration.md)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
