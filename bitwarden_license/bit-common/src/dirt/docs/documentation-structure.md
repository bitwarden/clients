# DIRT Team Documentation Structure

**Purpose:** Navigation guide for all DIRT team documentation organized by team/feature hierarchy

---

## 📁 Documentation Organization

DIRT team documentation follows a **team/feature** hierarchy organized across multiple locations based on separation of concerns:

### Team-Level Documentation

**Location:** `bitwarden_license/bit-common/src/dirt/docs/`

**Scope:** Applies to all DIRT features (Access Intelligence, Phishing Detection, etc.)

**Contains:**

- Team playbooks (service, component, documentation)
- Team coding standards
- Integration guides
- Getting started guide

### Feature-Level Documentation

**Pattern:** Feature docs live **next to the feature code**, not in the team `docs/` folder.

**Location:** `dirt/[feature]/docs/`

**Examples:**

- **Access Intelligence:** `dirt/access-intelligence/v2/docs/` (or `dirt/access-intelligence/docs/` for current version)
- **Phishing Detection (future):** `dirt/phishing-detection/docs/`

**Feature docs contain:**

- Feature-specific architecture
- Feature-specific implementation guides
- Feature-specific patterns

**Exception:** Migration/transition documentation can live in team `docs/` as **team-level knowledge**. Example: `docs/access-intelligence/` contains migration guides from v1 to v2, which is team-level context about the transition, not feature-specific architecture.

### 1. Services & Architecture (Platform-Agnostic)

**Pattern:** `bitwarden_license/bit-common/src/dirt/[feature]/docs/`

**Purpose:** Feature-specific documentation lives next to the feature code

**Example for Access Intelligence:**

- Location: `dirt/access-intelligence/v2/docs/` (for v2 architecture)
- Contains: Architecture docs, implementation guides specific to that version

**Note:** Team-level migration docs may live in `docs/access-intelligence/` as team knowledge about the transition between versions.

### 2. Components (Angular-Specific)

**Pattern:** `bitwarden_license/bit-web/src/app/dirt/[feature]/docs/`

**Purpose:** Angular-specific UI components for web client only

**Example for Access Intelligence:**

- Location: `dirt/access-intelligence/docs/`
- Contains: Component inventory, migration guides, Storybook

---

## 🎯 Where to Start?

**For navigation guidance (what to read), see:** [getting-started.md](./getting-started.md)

This document focuses on **how** the documentation is organized, not **what** to read.

---

## 🗂️ Complete File Structure

```
# ============================================================================
# SERVICES & ARCHITECTURE (bit-common)
# Platform-agnostic - Used by web, desktop, browser, CLI
# ============================================================================

bitwarden_license/bit-common/src/dirt/
├── docs/                                        ← TEAM-LEVEL documentation only
│   ├── README.md                                ← Team docs overview
│   ├── getting-started.md                       ← Entry point for team
│   ├── documentation-structure.md               ← This file
│   ├── integration-guide.md                     ← Service ↔ Component integration
│   │
│   ├── playbooks/                               ← Team playbooks (service, component, docs)
│   │   └── README.md                            ← Playbook navigation
│   │
│   ├── standards/                               ← Team coding standards
│   │   └── standards.md                         ← Core standards
│   │
│   └── access-intelligence/                     ← EXCEPTION: Migration guides (team knowledge)
│       ├── README.md                            ← Migration overview
│       ├── ...                                  ← Migration analysis files
│       ├── architecture/                        ← Migration architecture comparison
│       │   └── ...                              ← Architecture comparison files
│       └── implementation/                      ← Implementation guides
│           └── ...                              ← Integration guides
│
└── [feature]/                                   ← FEATURE CODE + FEATURE DOCS
    └── docs/                                    ← Feature-specific documentation
        ├── README.md                            ← Feature docs navigation
        ├── architecture/                        ← Feature architecture (lives with code)
        │   └── ...                              ← Architecture files
        └── implementation/                      ← Feature implementation guides
            └── ...                              ← Implementation guide files

# Example for Access Intelligence v2:
bitwarden_license/bit-common/src/dirt/access-intelligence/
├── v2/                                          ← V2 implementation
│   ├── services/                                ← V2 services
│   ├── models/                                  ← V2 models
│   └── docs/                                    ← V2-SPECIFIC documentation
│       ├── README.md                            ← V2 docs overview
│       ├── architecture/                        ← V2 architecture
│       │   └── ...                              ← Architecture files
│       └── implementation/                      ← V2 implementation guides
│           └── ...                              ← Implementation guide files
└── v1/                                          ← V1 implementation (legacy)

# ============================================================================
# COMPONENTS (bit-web)
# Angular-specific - Web client only
# ============================================================================

bitwarden_license/bit-web/src/app/dirt/[feature]/
├── docs/                                        ← Component documentation
│   └── README.md                                ← Component docs navigation
├── [component folders]/                         ← Angular components
└── v2/                                          ← V2 components (if applicable)

# Example for Access Intelligence:
bitwarden_license/bit-web/src/app/dirt/access-intelligence/
├── docs/                                        ← Component documentation
│   ├── README.md                                ← Component docs navigation
│   └── ...                                      ← Component guides
├── [components]/                                ← Angular components
└── v2/                                          ← V2 components (if applicable)
    └── ...                                      ← V2 component files
```

---

## 🔄 When to Update This Structure

Update this document when:

- [ ] Adding new documentation categories
- [ ] Changing file locations
- [ ] Restructuring documentation organization

---

## 📝 Architecture Decisions

**Where decisions are tracked:**

- **Company-wide ADRs:** Stored in the `contributing-docs` repository
- **Feature-specific decisions:** Tracked in Confluence (link to be added)
- **Local decision notes (optional):** `~/Documents/bitwarden-notes/dirt/decisions/[feature]/` for personal reference before moving to Confluence
  - Example: `~/Documents/bitwarden-notes/dirt/decisions/access-intelligence/`

**What goes in repo architecture docs:**

- Current architecture state
- Migration plans and roadmaps
- Technical constraints
- Implementation patterns

**What goes in Confluence:**

- Decision discussions and rationale
- Alternative approaches considered
- Stakeholder input
- Links to Slack discussions

---

## ✏️ Creating New Documentation

**Before creating new documentation, see:** [docs/README.md](./README.md) § Documentation Best Practices

**Key principles:**

- **Single responsibility** - Each document should answer one question
- **Check for overlaps** - Read related docs first
- **Follow naming conventions** - See [documentation-standards.md](./standards/documentation-standards.md)
- **Cross-reference standards** - See [documentation-standards.md § Cross-Reference Standards](./standards/documentation-standards.md#cross-reference-standards)
- **Update navigation** - Add to getting-started.md if it's a primary entry point

---

## 📊 Why This Structure?

### Documentation Placement Principles

**Team-Level Documentation (`docs/`):**

- Applies to all DIRT features
- Playbooks, standards, getting-started guides
- Migration guides and transition documentation (team knowledge about rewrites)
- Cross-feature integration patterns

**Feature-Level Documentation (`dirt/[feature]/docs/`):**

- Lives **next to the feature code**
- Feature-specific architecture
- Version-specific implementation details
- Feature-specific patterns

**Rationale:**

- **Discoverability:** Architecture docs are found where the code lives
- **Versioning:** v1 and v2 can have separate docs directories
- **Maintainability:** Update feature docs without touching team docs
- **Clarity:** Clear separation between "what applies to all features" vs "what applies to this feature"

### Separation of Concerns

**Platform-Agnostic (bit-common):**

- Services work on all platforms (web, desktop, browser, CLI)
- Domain models are platform-independent
- Architecture decisions affect all clients
- **Feature docs live with feature code:** `dirt/[feature]/docs/`

**Angular-Specific (bit-web):**

- Components only used in web client
- Storybook is web-only
- Angular-specific patterns (OnPush, Signals, etc.)
- **Component docs live with components:** `dirt/[feature]/docs/`

### Benefits

1. **Clarity:** Developers know where to look based on what they're working on
2. **Separation:** Team docs vs feature docs, Angular code vs platform-agnostic code
3. **Discoverability:** Feature docs are near feature code
4. **Maintainability:** Easier to update feature docs without affecting team docs
5. **Scalability:** Can add versioned docs (v1/, v2/) next to versioned code
6. **Migration clarity:** Team `docs/` can hold migration guides while feature `docs/` hold version-specific architecture

---

## 🆘 Need Help?

### Can't Find Documentation?

1. **Start with getting-started.md:** [getting-started.md](./getting-started.md)
   - Navigation hub for all DIRT team documentation
   - Links to all major documentation categories

2. **Check README files:**
   - [Team Documentation README](./README.md)
   - [Component README](/bitwarden_license/bit-web/src/app/dirt/access-intelligence/docs/README.md)

3. **Check feature-specific docs:**
   - Look in `dirt/[feature]/docs/` next to the feature code
   - Example: `dirt/access-intelligence/v2/docs/`

### Links Broken?

- Check if file was moved
- Update cross-references following [documentation-standards.md § Cross-Reference Standards](./standards/documentation-standards.md#cross-reference-standards)
- Update navigation in README.md files

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
