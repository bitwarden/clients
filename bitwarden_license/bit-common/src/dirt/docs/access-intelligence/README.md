# Access Intelligence — Service & Architecture Documentation

**Location:** `bitwarden_license/bit-common/src/dirt/docs/access-intelligence/`
**Purpose:** Platform-agnostic service implementation and architecture documentation

---

## 🔍 What is Access Intelligence?

Access Intelligence gives organization admins visibility into credential health across their vault. Admins generate an **AccessReport** — a point-in-time snapshot that maps member credentials to applications (grouped by domain) and runs health checks to identify at-risk passwords and members.

The feature surfaces this data across three areas:

- **Report** — the generated snapshot; shows per-application health metrics, at-risk member and cipher counts
- **Activity** — at-risk statistics from the current report; guides admins through a review flow to track newly detected applications and send security tasks to members with at-risk credentials
- **Applications** — lists all tracked applications with health numbers; admins can mark applications as critical to prioritize monitoring

Security tasks — prompting members to update at-risk passwords — can be sent from multiple points in the feature.

This package (`bit-common`) provides the platform-agnostic services, models, and encryption layer that power these capabilities across clients.

---

## 📚 Documentation Structure

### Core Documentation

| Document                                                                    | Purpose                    | When to Use            |
| --------------------------------------------------------------------------- | -------------------------- | ---------------------- |
| [glossary.md](./glossary.md)                                                | Canonical term definitions | Understanding naming   |
| [standards.md](../standards/standards.md)                                   | Coding standards (shared)  | Reference for patterns |
| [testing-standards-services.md](../standards/testing-standards-services.md) | Testing guidelines         | Writing tests          |

### Architecture

| Document                                                                                               | Purpose                             |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| [architecture/service-dependency-graph.md](./architecture/service-dependency-graph.md)                 | Service relationships               |
| [architecture/architecture-review.md](./architecture/architecture-review.md)                           | Architecture analysis               |
| [architecture/large-scale-performance-research.md](./architecture/large-scale-performance-research.md) | Performance solutions for 10K+ orgs |

### Decisions

| Document                   | Purpose                              |
| -------------------------- | ------------------------------------ |
| [decisions/](./decisions/) | Architecture Decision Records (ADRs) |

### Implementation Guides

| Document                             | Purpose                                |
| ------------------------------------ | -------------------------------------- |
| [implementation/](./implementation/) | Service-specific implementation guides |

---

## 🔗 Related Documentation

### Component Documentation (Angular-Specific)

**Location:** `bitwarden_license/bit-web/src/app/dirt/access-intelligence/docs/`

- **[docs/README.md](/bitwarden_license/bit-web/src/app/dirt/access-intelligence/docs/README.md)** - Component documentation index

### Main Project Context

**Location:** `bitwarden_license/bit-common/src/dirt/CLAUDE.md`

- Project overview, architecture, and which playbook to use

---

## 🚀 Quick Start

### For Service Work

1. **Read the playbook:**

   ```bash
   open playbook.md
   ```

2. **Check standards:**

   ```bash
   open ../standards/standards.md
   ```

3. **Start implementation:**

   ```bash
   # Copy template to external sessions folder (if using sessions)
   # Or follow playbook steps directly

   # Tell Claude:
   "Let's implement [ServiceName] following the Service Playbook"
   ```

### For Component Work

**Use the component documentation:**

```bash
open /bitwarden_license/bit-web/src/app/dirt/access-intelligence/docs/
```

---

## 📋 Which Documentation Should I Use?

| Task                       | Use These Docs                   |
| -------------------------- | -------------------------------- |
| **Implementing services**  | ✅ This folder (bit-common/docs) |
| **Adding model methods**   | ✅ This folder                   |
| **Architecture decisions** | ✅ This folder                   |
| **Domain model work**      | ✅ This folder                   |
| **Migrating components**   | ❌ Use bit-web/docs              |
| **Creating Storybook**     | ❌ Use bit-web/docs              |
| **Component tests**        | ❌ Use bit-web/docs              |

---

## 🗂️ What's in This Folder

| Folder/File                              | Purpose                                             |
| ---------------------------------------- | --------------------------------------------------- |
| **[architecture/](./architecture/)**     | Service architecture analysis and dependency graphs |
| **[decisions/](./decisions/)**           | Architecture Decision Records (ADRs)                |
| **[implementation/](./implementation/)** | Service-specific implementation guides              |

For the complete team documentation structure, see [Documentation Structure](../documentation-structure.md).

---

**Document Version:** 1.3
**Last Updated:** 2026-03-03
**Maintainer:** DIRT Team (Access Intelligence)
