# DIRT Team - Getting Started

**Purpose:** Navigation hub showing what documentation is available for your work

---

## 🎯 DIRT Team Features

The **DIRT team** (Data, Insights, Reporting & Tooling) owns:

- **Access Intelligence** (formerly Risk Insights)
  - Organization security reporting and password health analysis
  - Location: `dirt/reports/risk-insights/` (v1 services), `bit-web/.../access-intelligence/` (UI)
  - Note: `risk-insights` is the v1 codebase name for Access Intelligence

- **Organization Integrations**
  - Third-party organization integrations
  - Location: `dirt/organization-integrations/`

- **External Reports**
  - Various organization reports (weak password report, member access report, etc.)
  - Documentation: Coming soon

- **Phishing Detection**
  - Documentation: Coming soon

**Note:** Access Intelligence has the most documentation as it's the first feature we're documenting comprehensively.

---

## 📚 What's Available

### Development Resources

| Resource Type           | What It Provides                                        | Where to Find It                                                                                                       |
| ----------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Playbooks**           | Step-by-step implementation guides for common dev tasks | [Playbooks Hub](./playbooks/)                                                                                          |
| **Standards**           | Coding conventions, patterns, and best practices        | [Standards Hub](./standards/README.md)                                                                                 |
| **Architecture**        | Feature architecture reviews and migration plans        | [Access Intelligence Architecture](./access-intelligence/architecture/)                                                |
| **Integration Guides**  | How services and components work together               | [Generic Guide](./integration-guide.md), [Access Intelligence](./access-intelligence/service-component-integration.md) |
| **Documentation Guide** | How docs are organized and where to find things         | [Documentation Structure](./documentation-structure.md)                                                                |

### Standards by Area

| Area                   | Standard Document                                                          |
| ---------------------- | -------------------------------------------------------------------------- |
| **General Coding**     | [Standards Hub](./standards/README.md)                                     |
| **Services**           | [Service Standards](./standards/service-standards.md)                      |
| **Domain Models**      | [Model Standards](./standards/model-standards.md)                          |
| **Service Testing**    | [Service Testing Standards](./standards/testing-standards-services.md)     |
| **Angular Components** | [Angular Standards](./standards/angular-standards.md)                      |
| **Component Testing**  | [Component Testing Standards](./standards/testing-standards-components.md) |
| **RxJS Patterns**      | [RxJS Standards](./standards/rxjs-standards.md)                            |
| **Code Organization**  | [Code Organization Standards](./standards/code-organization-standards.md)  |
| **Documentation**      | [Documentation Standards](./standards/documentation-standards.md)          |

### Playbooks by Task

| Task                                 | Playbook                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| **Implement or refactor a service**  | [Service Implementation Playbook](./playbooks/service-implementation-playbook.md) |
| **Migrate or create a UI component** | [Component Migration Playbook](./playbooks/component-migration-playbook.md)       |
| **Create or update documentation**   | [Documentation Playbook](./playbooks/documentation-playbook.md)                   |
| **Browse all playbooks**             | [Playbooks Hub](./playbooks/)                                                     |

---

## 🚀 Quick Reference by Task

| What are you working on?                             | Start here                                                                                                                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Services** (implementation, architecture, testing) | [Service Playbook](./playbooks/service-implementation-playbook.md) + [Service Standards](./standards/service-standards.md)                                                                   |
| **Domain Models** (view models, query methods)       | [Service Playbook](./playbooks/service-implementation-playbook.md) + [Model Standards](./standards/model-standards.md)                                                                       |
| **UI Components** (Angular, migration, testing)      | [Component Playbook](./playbooks/component-migration-playbook.md) + [Angular Standards](./standards/angular-standards.md)                                                                    |
| **Storybook** (create or update stories)             | [Component Playbook](./playbooks/component-migration-playbook.md) + [Component Testing Standards § Storybook](./standards/testing-standards-components.md#storybook-as-living-documentation) |
| **Component Tests** (Jest, OnPush, Signals)          | [Component Playbook](./playbooks/component-migration-playbook.md) + [Component Testing Standards](./standards/testing-standards-components.md)                                               |
| **Service Tests** (mocks, observables, RxJS)         | [Service Playbook](./playbooks/service-implementation-playbook.md) + [Service Testing Standards](./standards/testing-standards-services.md)                                                  |
| **Documentation** (create, update, organize)         | [Documentation Playbook](./playbooks/documentation-playbook.md) + [Documentation Standards](./standards/documentation-standards.md)                                                          |
| **Architecture Review** (feature planning)           | [Access Intelligence Architecture](./access-intelligence/architecture/)                                                                                                                      |
| **Feature Architecture Decisions**                   | Document in [docs/[feature]/architecture/](./documentation-structure.md#feature-level-documentation) (decisions tracked in Confluence)                                                       |

---

## 🆘 Need Help?

**Can't find what you're looking for?**

- **Understand how docs are organized:** See [Documentation Structure](./documentation-structure.md)
- **Browse all team documentation:** See [Team Docs README](./README.md)
- **Component-specific docs:** See [Component Docs](/bitwarden_license/bit-web/src/app/dirt/access-intelligence/docs/README.md)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
