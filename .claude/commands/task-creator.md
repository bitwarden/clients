Use this template to break a feature spec into sprint-ready engineering tasks.

## INPUTS

- Feature spec - the feature specification to break down
- (optional) Code - existing code context

## INSTRUCTIONS

1. Parse the feature spec into vertical slices deliverable per sprint.
2. For each task, define acceptance criteria and effort (S/M/L or hours).
3. Capture dependencies (code, teams, data, compliance).
4. Include testing, docs, and observability per task.
5. Identify cross-cutting NFRs (perf, security, accessibility).
6. Keep lines ≤80 chars.

## OUTPUT FORMAT

### Work breakdown

| ID  | Title | Owner | Effort | Depends on |
| --- | ----- | ----- | ------ | ---------- |
| T1  | ...   |       | M      | T0         |

### Tasks

**T1:**

- **Description:**
- **Acceptance criteria:**
- **Effort:**
- **Dependencies:**
- **Risk:**
- **Test plan:**
- **Observability:**
- **Docs:**

**T2:**

- ...

### Milestones

- **M1:** Prototype
- **M2:** Beta/feature-flagged
- **M3:** GA

### NFRs

- **Performance:**
- **Security/compliance:**
- **Accessibility:**
- **Internationalization:**
- **Reliability/SLOs:**

### Analytics & success metrics

- **KPIs/dashboards:**

### Definition of done (global)

- Code reviewed, linted, and formatted
- Tests written, passing, and stable
- Feature flagged and togglable
- Metrics/logs/traces in place
- Docs updated (README/ADR/changelog)
