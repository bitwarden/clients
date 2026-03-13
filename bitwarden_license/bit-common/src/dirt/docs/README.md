# DIRT Team Documentation

**Location:** `bitwarden_license/bit-common/src/dirt/docs/`
**Purpose:** Overview of DIRT team documentation with navigation to detailed guides

---

## 🎯 Start Here

**New to the DIRT team?** → [Getting Started](./getting-started.md)

**Looking for something specific?**

- **"What should I read for my task?"** → [Getting Started](./getting-started.md)
- **"How are docs organized?"** → [Documentation Structure](./documentation-structure.md)
- **"What are the coding standards?"** → [Standards](./standards/)
- **"How do services integrate with components?"** → [Integration Guide](./integration-guide.md)

---

## 📁 What's in This Folder

| Document/Folder                                                | Purpose                                           |
| -------------------------------------------------------------- | ------------------------------------------------- |
| **[getting-started.md](./getting-started.md)**                 | Navigation hub - what to read for your task       |
| **[documentation-structure.md](./documentation-structure.md)** | Complete structure guide - how docs are organized |
| **[integration-guide.md](./integration-guide.md)**             | Service ↔ Component integration patterns          |
| **[standards/](./standards/)**                                 | Team coding and documentation standards           |
| **[access-intelligence/](./access-intelligence/)**             | Migration guides and architecture comparisons     |

---

## 🏗️ DIRT Team Features

The DIRT team (Data, Insights, Reporting & Tooling) owns:

- **Access Intelligence** - Organization security reporting and password health
- **Organization Integrations** - Third-party integrations
- **External Reports** - Organization reports (weak passwords, member access, etc.)
- **Phishing Detection** - Browser-based phishing detection

**Documentation is organized by package:**

- **bit-common** - Platform-agnostic services (work on all platforms)
- **bit-web** - Angular web components (web client only)
- **bit-browser** - Browser extension components

For detailed feature documentation locations, see [Getting Started](./getting-started.md).

---

## 📝 Creating New Documentation

**Before creating new docs, follow these steps:**

1. **Read the standards:** [Documentation Standards](./standards/documentation-standards.md)
2. **Check for overlaps:** Review existing docs to avoid duplication
3. **Update navigation:** Add to [getting-started.md](./getting-started.md) if it's a primary entry point
4. **Update this README:** If adding a new category or top-level document

**For detailed guidance on where to place docs, see:**

- [Documentation Standards § Document Location Rules](./standards/documentation-standards.md#document-location-rules)
- [Documentation Structure](./documentation-structure.md)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
