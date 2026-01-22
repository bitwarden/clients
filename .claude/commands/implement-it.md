Use this template to turn a user story into a concrete plan, skeletons, and tests.

## INPUTS

- Ticket - the user story or ticket to implement
- (optional) Non-functional requirements
- (optional) Acceptance criteria
- (optional) Code - existing code context

## INSTRUCTIONS

1. Extract goals, actors, and constraints from the ticket.
2. Make explicit assumptions and edge cases.
3. Produce a step-by-step plan across affected layers:
   - Frontend (web/mobile applications)
   - APIs (backend services)
   - Integrations (messaging, external services)
   - Data (databases, data warehouses, ETL)
   - Authentication/authorization systems
4. Provide key code skeletons and interface contracts.
5. Define tests to add (unit, integration, e2e).
6. Include rollout, feature flag, and observability plan.
7. Keep lines ≤80 chars.

## OUTPUT FORMAT

### Story summary

- **Goal:**
- **Users:**
- **Success criteria:**

### Assumptions & constraints

- ...

### Step-by-step plan

1. ...
2. ...

### Architecture impact

- **Modules/services:**
- **Events/messaging:**
- **Schemas/migrations:**

### API & model contracts (sketch)

### Key code skeletons

- **Components/services:**
- **Workers/consumers:**
- **Repositories/queries:**

### Tests to add

- **Unit:**
- **Integration:**
- **e2e:**
- **Property/fuzz:**
- **Load:**

### Rollout & safety

- **Feature flag:**
- **Backward compatibility:**
- **Metrics/logs/traces:**
- **Runbook:**

### Risks & mitigations

- ...

### Definition of done

- ...
