# Access Intelligence — Architecture Diagrams

**Purpose:** Visual architecture reference for the Access Intelligence feature, organized using
the C4 model. Covers all diagram types from overall system context down to individual class
structure.

## Notes

- This document follows the C4 model. See [c4model.com](https://c4model.com) for more information.
- Navigate from broad to narrow: **System Context → Container → Component → Code**, or branch from Component to Dynamic diagrams for runtime behavior.
- When a diagram is updated, increment its version and update the last updated date in its entry below.

## System Context

The feature in context, covering who uses it, what external systems it communicates with, and how
it relates to the Bitwarden platform.

### System Context ([access-intelligence.system-context.mmd](access-intelligence.system-context.mmd))

- **Purpose:** Shows the Access Intelligence feature in its broader environment — the actors who use it, the external systems it communicates with, and how it relates to the Bitwarden platform.
- **Relations:**
  - Expands into: [Container](access-intelligence.container.mmd)
- _Version: 1.0 | Last Updated: 2026-03-16_

## Container

The major runtime pieces that make up the system, including applications, data stores, and
external infrastructure.

### Container ([access-intelligence.container.mmd](access-intelligence.container.mmd))

- **Purpose:** Shows the containers inside the Access Intelligence system — UI, Business Logic, Backend, Database, and Blob Storage — and their dependencies on Bitwarden Platform Services, Have I Been Pwned, and the Bitwarden SDK.
- **Relations:**
  - Expands from: [System Context](access-intelligence.system-context.mmd)
  - Expands into: [Access Intelligence UI](access-intelligence-ui.component.mmd),
    [Access Intelligence Services](access-intelligence-service.component.mmd)
- _Version: 1.0 | Last Updated: 2026-03-16_

## Component

Services and components organized by layer and responsibility, along with the connections between
them.

### Access Intelligence UI ([access-intelligence-ui.component.mmd](access-intelligence-ui.component.mmd))

- **Purpose:** Shows the Angular page components inside the Access Intelligence UI container — the main page, applications, activity, and drawer — and how they depend on the Services container.
- **Relations:**
  - Expands from: [Container](container.mmd) — Access Intelligence UI node
  - Expands into: [UI & Presentational](code/class-ui.mmd)
  - See also: [Access Intelligence Services](access-intelligence-service.component.mmd)
- _Version: 1.0 | Last Updated: 2026-03-16_

### Access Intelligence Services ([access-intelligence-service.component.mmd](access-intelligence-service.component.mmd))

- **Purpose:** Shows the components inside the Access Intelligence Services container — data, report generation, persistence, and task services — and how they depend on the Bitwarden Server and external systems.
- **Relations:**
  - Expands from: [Container](container.mmd) — Access Intelligence Services node
  - Expands into: [Report Generation](code/class-generation.mmd),
    [Persistence & Encryption](code/class-persistence.mmd),
    [Security Tasks](code/class-security-tasks.mmd)
  - See also: [Access Intelligence UI](access-intelligence-ui.component.mmd)
  - See also (runtime behavior): [Generate Report](dynamic/generate-report.mmd),
    [Load Report](dynamic/load-report.mmd),
    [Change Critical Flag](dynamic/change-critical-flag.mmd),
    [Review New Applications](dynamic/review-new-apps.mmd),
    [Send Security Tasks](dynamic/send-security-tasks.mmd)
- _Version: 1.0 | Last Updated: 2026-03-16_

## Dynamic

Runtime behavior for specific user actions, tracing what happens step by step across service
boundaries.

### Generate Report ([dynamic/generate-report.mmd](dynamic/generate-report.mmd))

- **Purpose:** Traces the full pipeline when a user generates a new report, from triggering cipher health checks and member mapping through aggregation and carry-over of previous settings to persistence.
- **Relations:**
  - Expands from: [Component](access-intelligence-service.component.mmd)
  - Code detail: [Report Generation](code/class-generation.mmd),
    [Persistence & Encryption](code/class-persistence.mmd)
  - Other flows: [Load Report](dynamic/load-report.mmd),
    [Change Critical Flag](dynamic/change-critical-flag.mmd),
    [Review New Applications](dynamic/review-new-apps.mmd),
    [Send Security Tasks](dynamic/send-security-tasks.mmd)
- _Version: 1.0 | Last Updated: 2026-03-13_

### Load Report ([dynamic/load-report.mmd](dynamic/load-report.mmd))

- **Purpose:** Traces the auto-load sequence triggered when a user visits the page — fetching metadata and encrypted payload from the server, decrypting, and assembling the report view.
- **Relations:**
  - Expands from: [Component](access-intelligence-service.component.mmd)
  - Code detail: [Report Generation](code/class-generation.mmd),
    [Persistence & Encryption](code/class-persistence.mmd)
  - Other flows: [Generate Report](dynamic/generate-report.mmd),
    [Change Critical Flag](dynamic/change-critical-flag.mmd),
    [Review New Applications](dynamic/review-new-apps.mmd),
    [Send Security Tasks](dynamic/send-security-tasks.mmd)
- _Version: 1.0 | Last Updated: 2026-03-13_

### Change Critical Flag ([dynamic/change-critical-flag.mmd](dynamic/change-critical-flag.mmd))

- **Purpose:** Traces the steps when a user marks or clears the critical flag on an application, covering the view model mutation, summary recompute, and metadata persistence.
- **Relations:**
  - Expands from: [Component](access-intelligence-service.component.mmd)
  - Code detail: [Report Generation](code/class-generation.mmd),
    [Persistence & Encryption](code/class-persistence.mmd)
  - Other flows: [Generate Report](dynamic/generate-report.mmd),
    [Load Report](dynamic/load-report.mmd),
    [Review New Applications](dynamic/review-new-apps.mmd),
    [Send Security Tasks](dynamic/send-security-tasks.mmd)
- _Version: 1.0 | Last Updated: 2026-03-16_

### Review New Applications ([dynamic/review-new-apps.mmd](dynamic/review-new-apps.mmd))

- **Purpose:** Traces the steps when a user reviews new applications — setting critical flags, marking all as reviewed, persisting metadata, and triggering security task creation via the Vault Team.
- **Relations:**
  - Expands from: [Component](access-intelligence-service.component.mmd)
  - Code detail: [Report Generation](code/class-generation.mmd),
    [Persistence & Encryption](code/class-persistence.mmd),
    [Security Tasks](code/class-security-tasks.mmd)
  - Other flows: [Generate Report](dynamic/generate-report.mmd),
    [Load Report](dynamic/load-report.mmd),
    [Change Critical Flag](dynamic/change-critical-flag.mmd),
    [Send Security Tasks](dynamic/send-security-tasks.mmd)
- _Version: 1.0 | Last Updated: 2026-03-13_

### Send Security Tasks ([dynamic/send-security-tasks.mmd](dynamic/send-security-tasks.mmd))

- **Purpose:** Traces the steps when a user manually dispatches security tasks for critical at-risk applications, from deriving unassigned cipher IDs through bulk task creation to updating the task list.
- **Relations:**
  - Expands from: [Component](access-intelligence-service.component.mmd)
  - Code detail: [Security Tasks](code/class-security-tasks.mmd),
    [Report Generation](code/class-generation.mmd)
  - Other flows: [Generate Report](dynamic/generate-report.mmd),
    [Load Report](dynamic/load-report.mmd),
    [Change Critical Flag](dynamic/change-critical-flag.mmd),
    [Review New Applications](dynamic/review-new-apps.mmd)
- _Version: 1.0 | Last Updated: 2026-03-13_

## Code

Internal class structure showing interfaces, properties, methods, and relationships.

### Report Generation ([code/class-generation.mmd](code/class-generation.mmd))

- **Purpose:** Shows the class structure of the data service, report generation services, and output models — including AccessReportView, ApplicationHealthView, and MemberRegistry — and how they relate to each other.
- **Relations:**
  - Expands from: [Component](access-intelligence-service.component.mmd)
  - Dynamic behavior: [Generate Report](dynamic/generate-report.mmd),
    [Load Report](dynamic/load-report.mmd),
    [Change Critical Flag](dynamic/change-critical-flag.mmd),
    [Review New Applications](dynamic/review-new-apps.mmd)
  - Other code diagrams: [Persistence & Encryption](code/class-persistence.mmd),
    [UI & Presentational](code/class-ui.mmd),
    [Security Tasks](code/class-security-tasks.mmd)
- _Version: 1.0 | Last Updated: 2026-03-13_

### Persistence & Encryption ([code/class-persistence.mmd](code/class-persistence.mmd))

- **Purpose:** Shows the class structure of the persistence service, encryption service, versioning services, and API services involved in saving and loading reports.
- **Relations:**
  - Expands from: [Component](access-intelligence-service.component.mmd)
  - Dynamic behavior: [Generate Report](dynamic/generate-report.mmd),
    [Load Report](dynamic/load-report.mmd)
  - Other code diagrams: [Report Generation](code/class-generation.mmd),
    [UI & Presentational](code/class-ui.mmd),
    [Security Tasks](code/class-security-tasks.mmd)
- _Version: 1.0 | Last Updated: 2026-03-13_

### UI & Presentational ([code/class-ui.mmd](code/class-ui.mmd))

- **Purpose:** Shows the class structure of the UI components, drawer state service, and view models used for rendering and managing the Access Intelligence interface.
- **Relations:**
  - Expands from: [Component](access-intelligence-ui.component.mmd)
  - Dynamic behavior: [Generate Report](dynamic/generate-report.mmd),
    [Change Critical Flag](dynamic/change-critical-flag.mmd),
    [Review New Applications](dynamic/review-new-apps.mmd),
    [Send Security Tasks](dynamic/send-security-tasks.mmd)
  - Other code diagrams: [Report Generation](code/class-generation.mmd),
    [Persistence & Encryption](code/class-persistence.mmd),
    [Security Tasks](code/class-security-tasks.mmd)
- _Version: 1.0 | Last Updated: 2026-03-13_

### Security Tasks ([code/class-security-tasks.mmd](code/class-security-tasks.mmd))

- **Purpose:** Shows the class structure of the security tasks service, its default implementation, and its dependency on the Vault Team's AdminTaskService.
- **Relations:**
  - Expands from: [Component](access-intelligence-service.component.mmd)
  - Dynamic behavior: [Review New Applications](dynamic/review-new-apps.mmd),
    [Send Security Tasks](dynamic/send-security-tasks.mmd)
  - Other code diagrams: [Report Generation](code/class-generation.mmd),
    [Persistence & Encryption](code/class-persistence.mmd),
    [UI & Presentational](code/class-ui.mmd)
- _Version: 1.0 | Last Updated: 2026-03-13_

**Document Version:** 1.0
**Last Updated:** 2026-03-16
**Maintainer:** DIRT Team
