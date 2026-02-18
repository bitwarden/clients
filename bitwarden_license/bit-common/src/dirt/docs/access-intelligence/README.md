# Access Intelligence — Service & Architecture Documentation

**Location:** `bitwarden_license/bit-common/src/dirt/docs/access-intelligence/`
**Purpose:** Platform-agnostic service implementation and architecture documentation

---

## 📚 Documentation Structure

### Core Documentation

| Document                                                                    | Purpose                      | When to Use            |
| --------------------------------------------------------------------------- | ---------------------------- | ---------------------- |
| [playbook.md](./playbook.md)                                                | Service implementation guide | Implementing services  |
| [standards.md](../standards/standards.md)                                   | Coding standards (shared)    | Reference for patterns |
| [testing-standards-services.md](../standards/testing-standards-services.md) | Testing guidelines           | Writing tests          |

### Architecture

| Document                                                                               | Purpose               |
| -------------------------------------------------------------------------------------- | --------------------- |
| [architecture/service-dependency-graph.md](./architecture/service-dependency-graph.md) | Service relationships |
| [architecture/architecture-review.md](./architecture/architecture-review.md)           | Architecture analysis |

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

- **[component-migration-playbook.md](/bitwarden_license/playbooks/component-migration-playbook.md)** - Component migration guide
- **[component-standardization-audit.md](/bitwarden_license/bit-web/src/app/dirt/access-intelligence/docs/component-standardization-audit.md)** - Component inventory
- **[component-migration-quickstart.md](/bitwarden_license/bit-web/src/app/dirt/access-intelligence/docs/component-migration-quickstart.md)** - Component quick start

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

**Document Version:** 1.1
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team (Access Intelligence)
