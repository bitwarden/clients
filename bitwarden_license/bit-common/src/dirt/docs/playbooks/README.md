# DIRT Team - Implementation Playbooks

**Location:** `bitwarden_license/bit-common/src/dirt/docs/playbooks/`
**Purpose:** Step-by-step implementation guides for common development tasks

---

## 📚 Available Playbooks

### Service Implementation

**[Service Implementation Playbook](./service-implementation-playbook.md)**

Complete guide for implementing platform-agnostic services.

**Use when:**

- Implementing domain services (ReportGenerationService, CipherHealthService, etc.)
- Implementing persistence services (ReportPersistenceService)
- Implementing data services (AccessIntelligenceDataService)
- Adding view model query/mutation methods
- Domain model implementation (Data/Domain/View layers)

**Topics covered:**

- 4-layer data model architecture
- Service responsibility patterns
- RxJS observable patterns
- Testing strategies
- Integration patterns

---

### Component Migration

**[Component Migration Playbook](./component-migration-playbook.md)**

Comprehensive guide for migrating Angular components to modern standards.

**Use when:**

- Migrating V1 components to V2 standards
- Creating new V2 components
- Adding OnPush change detection
- Converting to Signals
- Adding Storybook documentation
- Writing component tests

**Topics covered:**

- OnPush change detection patterns
- Signal inputs/outputs
- toSignal() conversions
- Storybook creation
- Component testing
- Migration strategies (UPDATE vs CREATE V2)

---

### Documentation Management

**[Documentation Playbook](./documentation-playbook.md)**

Complete guide for creating and updating DIRT team documentation.

**Use when:**

- Creating new documentation files
- Updating existing documentation
- Reorganizing documentation structure
- Adding new sections to existing docs
- Ensuring documentation follows team standards

**Topics covered:**

- Document purpose and single responsibility
- Checking for overlaps with existing docs
- Naming conventions (meta files, regular docs, playbooks, ADRs)
- Required metadata (purpose, version, last updated)
- Updating navigation docs
- Common documentation pitfalls

---

## 🔗 Related Documentation

### Standards

- [Coding Standards](../standards/standards.md) - Team coding patterns and best practices
- [Service Testing Standards](../standards/testing-standards-services.md) - Service testing guidelines
- [Component Testing Standards](../standards/testing-standards-components.md) - Component testing guidelines

### Integration

- [Integration Guide](../integration-guide.md) - How services and components work together

### Architecture

- [Architecture Docs](../access-intelligence/architecture/) - Service architecture analysis
- [ADRs](../access-intelligence/decisions/) - Architecture decision records

---

## 🆕 Adding New Playbooks

When adding new playbooks to this folder:

1. **Name the file:** `[topic]-playbook.md`
   - Examples: `testing-strategy-playbook.md`, `api-integration-playbook.md`

2. **Update this README:**
   - Add new playbook to "Available Playbooks" section
   - Include brief description and "Use when" guidance

3. **Follow playbook structure:**
   - Clear step-by-step instructions
   - Code examples
   - Common patterns and anti-patterns
   - Related documentation links

4. **Update getting-started.md:**
   - Add entry for new playbook if it's a common task

---

## 💡 Playbook vs Standards

**When to use Playbooks:**

- Step-by-step implementation guides
- "How do I implement X?" questions
- Task-oriented workflows
- End-to-end implementation examples

**When to use Standards:**

- Coding patterns and conventions
- "What's the correct pattern?" questions
- Reference material
- Best practices and anti-patterns

**They complement each other:**

- Playbooks reference standards for patterns
- Standards provide the "what" and "why"
- Playbooks provide the "how" and "when"

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Maintainer:** DIRT Team
