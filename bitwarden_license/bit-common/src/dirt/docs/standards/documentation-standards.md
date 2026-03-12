# Documentation Standards

**Purpose:** Standards and conventions for DIRT team documentation

---

## Table of Contents

1. [Single Responsibility Principle](#single-responsibility-principle)
2. [Document Metadata Requirements](#document-metadata-requirements)
3. [Version Numbering](#version-numbering)
4. [Document Structure](#document-structure)
5. [Naming Conventions](#naming-conventions)
6. [README.md Files](#readmemd-files)
7. [Document Location Rules](#document-location-rules)
8. [Cross-Reference Standards](#cross-reference-standards)
9. [Content Guidelines](#content-guidelines)
10. [File Structure Diagrams](#file-structure-diagrams)

---

## Single Responsibility Principle

**Rule:** Each document should answer ONE question and serve ONE purpose.

**Why:** Prevents overlapping responsibilities, makes documents easier to maintain, and helps users find information quickly.

### Examples of Single Responsibility

| Document                       | Single Responsibility                                              |
| ------------------------------ | ------------------------------------------------------------------ |
| **getting-started.md**         | "WHAT should I read?" (Navigation hub)                             |
| **documentation-structure.md** | "HOW is documentation organized?" (Structure explanation)          |
| **integration-guide.md**       | "HOW do services and components integrate?" (Integration patterns) |
| **standards.md**               | "WHAT are the coding rules?" (Code standards)                      |
| **documentation-standards.md** | "WHAT are the documentation rules?" (Doc standards)                |
| **[topic]-playbook.md**        | "HOW do I implement [topic]?" (Step-by-step guide)                 |

### Testing Single Responsibility

**Ask these questions:**

1. **Can I summarize this document's purpose in one sentence?**
   - ✅ Yes → Good single responsibility
   - ❌ Need multiple sentences → May be multiple documents

2. **If I remove this document, what information is lost?**
   - ✅ One specific type of information → Good
   - ❌ Multiple unrelated types → Split into multiple docs

3. **Does every section support the main purpose?**
   - ✅ All sections relate to main purpose → Good
   - ❌ Some sections don't fit → Move to different document

### Example: Overlap We Fixed

**Problem:**

- `documentation-structure.md` had "Which Documentation Should I Use?" (navigation)
- `getting-started.md` also did navigation
- Overlapping responsibilities

**Fix:**

- Moved all navigation to `getting-started.md` (single source of truth)
- `documentation-structure.md` now only explains structure
- Single responsibility restored

---

## Document Metadata Requirements

**Rule:** Every document MUST include required metadata at top and bottom.

### Required Metadata

**At top of document:**

```markdown
# [Document Title]

**Purpose:** [One-sentence description of what this document does]

---

[Content goes here]
```

**At bottom of document:**

```markdown
---

**Document Version:** X.Y
**Last Updated:** YYYY-MM-DD
**Maintainer:** DIRT Team (or specific person/subteam)
```

### Metadata Field Descriptions

| Field                | Location | Format              | Description                                        |
| -------------------- | -------- | ------------------- | -------------------------------------------------- |
| **Title**            | Top      | `# Title`           | Clear, descriptive title using sentence case       |
| **Purpose**          | Top      | One sentence        | Answers "What question does this document answer?" |
| **Document Version** | Bottom   | `X.Y`               | Version number (see Version Numbering section)     |
| **Last Updated**     | Bottom   | `YYYY-MM-DD`        | Date of last significant update                    |
| **Maintainer**       | Bottom   | Team or person name | Who maintains this document                        |

### Purpose Statement Guidelines

**Good purpose statements:**

- ✅ "Step-by-step guide for creating or updating DIRT team documentation"
- ✅ "Standards and conventions for DIRT team documentation"
- ✅ "Explain how documentation is organized across packages"
- ✅ "Guide for features that span both platform-agnostic services and Angular UI components"

**Bad purpose statements:**

- ❌ "Documentation" (too vague)
- ❌ "This document covers standards, navigation, and examples" (multiple purposes)
- ❌ "Guide" (doesn't say what it guides you through)

**Format:**

- One sentence only
- No period at the end
- Use present tense
- Be specific about what the document does

---

## Version Numbering

**Rule:** All documents must have version numbers using semantic versioning (X.Y format).

### Version Format

**Format:** `X.Y`

- **X** = Major version (breaking changes, major restructures)
- **Y** = Minor version (additions, clarifications, small updates)

### When to Increment

| Change Type           | Version Change       | Example                                      |
| --------------------- | -------------------- | -------------------------------------------- |
| **Initial creation**  | Start at `1.0`       | New document created → `1.0`                 |
| **Minor updates**     | Increment Y          | Add section, clarify content → `1.0` → `1.1` |
| **Bug fixes**         | Increment Y          | Fix typos, broken links → `1.1` → `1.2`      |
| **Major restructure** | Increment X, reset Y | Complete reorganization → `1.5` → `2.0`      |
| **Breaking changes**  | Increment X, reset Y | Change document purpose → `1.3` → `2.0`      |

### Examples

```markdown
# Service Implementation Playbook

**Purpose:** Step-by-step guide for implementing platform-agnostic services

---

[Content]

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Maintainer:** DIRT Team
```

**Update 1: Add new section**

- Version: `1.0` → `1.1`
- Last Updated: Update date

**Update 2: Fix broken links**

- Version: `1.1` → `1.2`
- Last Updated: Update date

**Update 3: Complete restructure**

- Version: `1.2` → `2.0`
- Last Updated: Update date

---

## Document Structure

**Rule:** Documents should follow a consistent structure with required sections.

### Required Sections

**Every document must have:**

1. **Title** (`# Title`)
2. **Purpose statement** (one sentence)
3. **Horizontal rule separator** (`---`)
4. **Content** (organized with clear headings)
5. **Footer metadata** (version, last updated, maintainer)

### Recommended Structure

```markdown
# [Document Title]

**Purpose:** [One sentence]

---

## Optional: Table of Contents

[For longer documents]

## Section 1

[Content]

## Section 2

[Content]

---

## Optional: Related Documentation

[Links to related docs]

---

**Document Version:** X.Y
**Last Updated:** YYYY-MM-DD
**Maintainer:** DIRT Team
```

### Heading Levels

**Use consistent heading hierarchy:**

- `#` - Document title (once, at top)
- `##` - Main sections
- `###` - Subsections
- `####` - Sub-subsections (use sparingly)

**Pattern:**

```markdown
# Document Title

## Main Section 1

### Subsection 1.1

#### Detail 1.1.1

### Subsection 1.2

## Main Section 2
```

### Section Organization

**Order sections logically:**

1. **Introduction/Overview** (if needed)
2. **Core Content** (main sections)
3. **Examples** (if applicable)
4. **Related Documentation** (cross-references)
5. **Maintenance** (when to update this doc)
6. **Footer Metadata**

---

## Naming Conventions

**Rule:** File naming must follow conventions based on document type.

### Document Types and Naming

| Type             | Naming Convention                      | Location                    | Example                      |
| ---------------- | -------------------------------------- | --------------------------- | ---------------------------- |
| **Meta files**   | `ALLCAPS.md`                           | Directory root              | `README.md`, `CLAUDE.md`     |
| **Regular docs** | `lowercase-kebab-case.md`              | `docs/`                     | `getting-started.md`         |
| **Playbooks**    | `[topic]-playbook.md`                  | `docs/playbooks/`           | `documentation-playbook.md`  |
| **Standards**    | `[topic]-standards.md` or `[topic].md` | `docs/standards/`           | `documentation-standards.md` |
| **ADRs**         | `NNN-title.md`                         | `docs/[feature]/decisions/` | `001-ground-up-rewrite.md`   |
| **Feature docs** | `lowercase-kebab-case.md`              | `docs/[feature]/`           | `architecture-review.md`     |

### Meta Files (ALL CAPS)

**Use ALL CAPS for meta files:**

- `README.md` - Directory overview and navigation
- `CLAUDE.md` - AI tooling context and instructions
- `CONTRIBUTING.md` - Contribution guidelines (if added)
- `CHANGELOG.md` - Change log (if added)

**Why ALL CAPS:**

- Industry standard (README.md is universally ALL CAPS)
- Immediately recognizable as meta files
- Distinguishes from regular documentation

### Regular Documentation (lowercase-kebab-case)

**Use lowercase-kebab-case for all other docs:**

- `getting-started.md`
- `documentation-structure.md`
- `integration-guide.md`
- `component-migration-quickstart.md`

**Why lowercase-kebab-case:**

- Cross-platform compatibility (case-insensitive filesystems)
- Auto-completion in terminals
- URL-friendly (if docs ever hosted)
- Consistency with codebase naming

### Playbooks (-playbook suffix)

**Format:** `[topic]-playbook.md`

**Examples:**

- `service-implementation-playbook.md`
- `component-migration-playbook.md`
- `documentation-playbook.md`
- `testing-strategy-playbook.md` (future)

**Why -playbook suffix:**

- Enables filtering by filename (`*-playbook.md`)
- Immediately identifies implementation guides
- Distinguishes from standards or reference docs

### Architecture Decision Records (numbered)

**Format:** `NNN-descriptive-title.md`

- NNN = 3-digit number (001, 002, 003, etc.)
- descriptive-title = lowercase-kebab-case

**Examples:**

- `001-ground-up-rewrite.md`
- `002-consolidate-app-metadata-services.md`
- `003-report-persistence-backend-flexibility.md`

**Why numbered:**

- Standard ADR format
- Chronological ordering
- Easy to reference ("see ADR-003")

---

## README.md Files

**Rule:** README.md files serve as brief directory overviews, not comprehensive guides.

### Purpose of README.md

**README.md is a meta-documentation file that:**

- ✅ Provides a brief overview of what's in the directory
- ✅ Links to detailed documentation (getting-started, structure guides, etc.)
- ✅ Serves as a "directory in a lobby" - tells you where to find maps, not the map itself
- ❌ Does NOT duplicate content from other documentation
- ❌ Does NOT provide comprehensive guides or tutorials
- ❌ Does NOT explain detailed structure (that's documentation-structure.md's job)
- ❌ Does NOT provide navigation (that's getting-started.md's job)

### README.md Template

**Use this template for README.md files:**

```markdown
# [Directory Name]

**Location:** `path/to/directory`
**Purpose:** Brief overview of [directory purpose]

---

## 🎯 Start Here

**New to [area]?** → [Link to getting started guide]

**Looking for something specific?**

- **"Question 1?"** → [Link to relevant doc]
- **"Question 2?"** → [Link to relevant doc]
- **"Question 3?"** → [Link to relevant doc]

---

## 📁 What's in This Folder

| Document/Folder                  | Purpose           |
| -------------------------------- | ----------------- |
| **[doc-name.md](./doc-name.md)** | Brief description |
| **[folder/](./folder/)**         | Brief description |

---

## 📝 [Optional: Brief Context Section]

[1-2 paragraphs of high-level context if needed]

---

**Document Version:** X.Y
**Last Updated:** YYYY-MM-DD
**Maintainer:** [Team Name]
```

### What to Include

**DO include in README.md:**

- ✅ **Brief overview** - 1-2 sentences about the directory's purpose
- ✅ **"Start Here" section** - Quick links for common tasks
- ✅ **"What's in This Folder" table** - List of files/folders with brief descriptions
- ✅ **Links to detailed docs** - Point to getting-started.md, documentation-structure.md, etc.
- ✅ **High-level context** - 1-2 paragraphs if needed (optional)

**DO NOT include in README.md:**

- ❌ **Full directory trees** - Use placeholders, link to documentation-structure.md
- ❌ **Navigation tables** - Link to getting-started.md instead
- ❌ **Best practices sections** - These belong in standards/ folder
- ❌ **Implementation guides** - These belong in playbooks/ folder
- ❌ **Detailed structure explanations** - Link to documentation-structure.md
- ❌ **Standards or conventions** - These belong in standards/ folder

### Examples

**Good README.md (brief overview):**

```markdown
# DIRT Team Documentation

**Location:** `bitwarden_license/bit-common/src/dirt/docs/`
**Purpose:** Overview of DIRT team documentation with navigation to detailed guides

---

## 🎯 Start Here

**New to the DIRT team?** → [Getting Started](./getting-started.md)

## 📁 What's in This Folder

| Document/Folder                                | Purpose        |
| ---------------------------------------------- | -------------- |
| **[getting-started.md](./getting-started.md)** | Navigation hub |
| **[standards/](./standards/)**                 | Team standards |
```

**Bad README.md (too comprehensive):**

```markdown
# DIRT Team Documentation

## Complete Directory Structure

[Full file tree with every file listed]

## Documentation Best Practices

[Long section explaining standards that belong in documentation-standards.md]

## Quick Navigation

[Navigation table that duplicates getting-started.md]

## When to Use Each Location

[Detailed explanation that belongs in documentation-structure.md]
```

### Common README.md Locations

**Each location has a README.md with a specific scope:**

| Location                       | README.md Scope       | Links To                                             |
| ------------------------------ | --------------------- | ---------------------------------------------------- |
| **`docs/README.md`**           | Team docs overview    | getting-started.md, documentation-structure.md       |
| **`docs/playbooks/README.md`** | Playbooks overview    | Individual playbook files                            |
| **`docs/standards/README.md`** | Standards overview    | Individual standards files                           |
| **`docs/[feature]/README.md`** | Feature docs overview | Feature-specific architecture, implementation guides |

### Testing Your README.md

**Ask these questions:**

1. **Is it brief?** (Should be ~50-100 lines, not 300+)
2. **Does it link instead of duplicate?** (Links to getting-started.md instead of duplicating navigation)
3. **Does it follow single responsibility?** (Overview only, not comprehensive guide)
4. **Could a new person use it to find detailed docs?** (Clear links to where to go next)

### When README.md Gets Too Long

**If your README.md exceeds ~100 lines, you're probably:**

1. **Duplicating content** - Move content to appropriate doc and link to it
2. **Providing detailed guides** - Move to playbooks/ or standards/
3. **Explaining structure in detail** - Move to documentation-structure.md
4. **Providing navigation** - Move to getting-started.md

**Fix:** Simplify README.md to brief overview with links, move content to appropriate locations.

### README.md vs Other Meta Docs

**Clear separation of concerns:**

| Document                       | Purpose                  | Content                                     |
| ------------------------------ | ------------------------ | ------------------------------------------- |
| **README.md**                  | "What's in this folder?" | Brief overview, links to detailed docs      |
| **getting-started.md**         | "What should I read?"    | Navigation hub, task-based links            |
| **documentation-structure.md** | "How is it organized?"   | Complete structure explanation              |
| **CLAUDE.md**                  | "Context for AI tooling" | AI-specific instructions, patterns, context |

**Anti-pattern:** README.md trying to do all four jobs above.

---

## Document Location Rules

**Rule:** Document placement depends on scope and purpose.

### Location Decision Tree

```
What type of documentation?
│
├─ Meta file (README.md, CLAUDE.md)?
│  └─ Place at directory root
│     Examples: docs/README.md, docs/playbooks/README.md
│
├─ Cross-cutting (references multiple packages)?
│  └─ Place at team docs root: docs/
│     Examples: getting-started.md, integration-guide.md
│
├─ Feature-specific (platform-agnostic services)?
│  └─ Place in feature folder: docs/[feature]/
│     Examples: docs/access-intelligence/architecture/
│
├─ Component docs (Angular-specific)?
│  └─ Place in bit-web: bit-web/src/app/dirt/[feature]/docs/
│     Example: bit-web/src/app/dirt/access-intelligence/docs/
│
├─ Browser docs (browser extension)?
│  └─ Place in apps/browser: apps/browser/src/dirt/[feature]/docs/
│     Example: apps/browser/src/dirt/phishing-detection/docs/ (future)
│
├─ Playbook (implementation guide)?
│  └─ Place in: docs/playbooks/
│     Examples: service-implementation-playbook.md
│
├─ Standards (coding/doc standards)?
│  └─ Place in: docs/standards/
│     Examples: standards.md, documentation-standards.md
│
└─ ADR (architecture decision)?
   └─ Place in: docs/[feature]/decisions/
      Examples: docs/access-intelligence/decisions/001-rewrite.md
```

### Location Rules by Scope

| Scope                    | Location                           | Example                                   |
| ------------------------ | ---------------------------------- | ----------------------------------------- |
| **Team-wide**            | `docs/`                            | getting-started.md, integration-guide.md  |
| **Feature (services)**   | `docs/[feature]/`                  | docs/access-intelligence/architecture/    |
| **Feature (components)** | `bit-web/.../[feature]/docs/`      | bit-web/.../access-intelligence/docs/     |
| **Feature (browser)**    | `apps/browser/.../[feature]/docs/` | apps/browser/.../phishing-detection/docs/ |
| **Playbooks**            | `docs/playbooks/`                  | documentation-playbook.md                 |
| **Standards**            | `docs/standards/`                  | documentation-standards.md                |
| **ADRs**                 | `docs/[feature]/decisions/`        | 001-ground-up-rewrite.md                  |

### Package-Based Organization

**Separation of concerns:**

- **bit-common** - Platform-agnostic services and architecture
  - Location: `bitwarden_license/bit-common/src/dirt/docs/`
  - Purpose: Code that works on all platforms (web, desktop, browser, CLI)

- **bit-web** - Angular web components
  - Location: `bitwarden_license/bit-web/src/app/dirt/[feature]/docs/`
  - Purpose: Web client only (Angular-specific)

- **bit-browser** - Browser extension components
  - Location: `apps/browser/src/dirt/[feature]/docs/`
  - Purpose: Browser extension only

---

## Cross-Reference Standards

**Rule:** Use consistent formatting for cross-references and follow path conventions.

### Relative vs Absolute Paths

**Use relative paths when:**

- Linking within same directory tree
- Example: `[standards.md](../standards/standards.md)` from `docs/playbooks/`

**Use absolute paths when:**

- Linking across package boundaries (bit-common → bit-web)
- Example: `[bit-web docs](/bitwarden_license/bit-web/src/app/dirt/access-intelligence/docs/)`

### Path Formats

**Relative paths:**

```markdown
[Standards](../standards/standards.md)
[Getting Started](../getting-started.md)
[Playbook](./service-implementation-playbook.md)
```

**Absolute paths (from repo root):**

```markdown
[Component Docs](/bitwarden_license/bit-web/src/app/dirt/access-intelligence/docs/)
[Browser Code](/apps/browser/src/dirt/phishing-detection/)
```

### Link Formatting

**Good link formatting:**

```markdown
[Standards](../standards/standards.md) - Links to file
[Playbooks](./playbooks/) - Links to directory
[standards.md § Testing](../standards/standards.md#testing-standards) - Links to section
```

**Bad link formatting:**

```markdown
[Standards](../standards/standards.md/) - Extra slash for file
[standards.md](../standards/standards.md) - Filename as link text (use descriptive text)
```

### Section References

**Link to specific sections:**

```markdown
[Documentation Best Practices](../README.md#-documentation-best-practices)
[Version Numbering](#version-numbering)
```

**Format:**

- Use section heading as anchor (GitHub auto-generates)
- Replace spaces with hyphens
- Use lowercase
- Remove special characters except hyphens

---

## Content Guidelines

**Rule:** Write clear, concise content following consistent patterns.

### Writing Style

**Be clear and direct:**

- ✅ "Use lowercase-kebab-case for regular documentation files"
- ❌ "It might be good to consider using lowercase-kebab-case in some cases"

**Use present tense:**

- ✅ "This document explains..."
- ❌ "This document will explain..."

**Use active voice:**

- ✅ "Create documentation following these standards"
- ❌ "Documentation should be created following these standards"

### Examples and Anti-Patterns

**Always include examples:**

```markdown
### Good Example Pattern

**Good examples:**

- ✅ Example of correct pattern
- ✅ Another correct example

**Bad examples:**

- ❌ Example of incorrect pattern
- ❌ Another incorrect example
```

**Use visual indicators:**

- ✅ for correct patterns
- ❌ for incorrect patterns
- ⚠️ for warnings or cautions

### Code Blocks and Formatting

**Use code blocks for:**

- File paths: `` `docs/README.md` ``
- Code examples: ` ```typescript ... ``` `
- File structures: ` ```text ... ``` `
- Commands: `` `npm test` ``

**Use tables for comparisons:**

```markdown
| Pattern  | When to Use | Example   |
| -------- | ----------- | --------- |
| Option A | Scenario A  | Example A |
| Option B | Scenario B  | Example B |
```

### Lists and Organization

**Use bullet points for:**

- Unordered items
- Features or characteristics
- Examples

**Use numbered lists for:**

- Sequential steps
- Ordered procedures
- Prioritized items

**Example:**

```markdown
**Steps to follow:**

1. First step
2. Second step
3. Third step

**Features:**

- Feature 1
- Feature 2
- Feature 3
```

---

## File Structure Diagrams

**Rule:** File structure diagrams should show **folders and meta files only**, using placeholders for other files.

### What to Include in Diagrams

**DO include:**

- ✅ Folders/directories (all levels)
- ✅ Meta files only: `README.md`, `CLAUDE.md`
- ✅ Placeholder `...` to indicate other files exist

**DO NOT include:**

- ❌ Individual content files (analysis docs, architecture docs, etc.)
- ❌ Implementation files (.ts, .js, etc.)
- ❌ Test files (.spec.ts)

### Good Example

```markdown
bitwarden_license/bit-common/src/dirt/
├── CLAUDE.md ← Meta file
│
├── docs/ ← Folder
│ ├── README.md ← Meta file
│ ├── getting-started.md ← Exception: Core navigation file
│ │
│ ├── playbooks/ ← Folder
│ │ ├── README.md ← Meta file
│ │ └── ... ← Placeholder for other playbooks
│ │
│ └── standards/ ← Folder
│ ├── README.md ← Meta file
│ └── ... ← Placeholder for standard files
│
└── [feature]/ ← Folder pattern
└── docs/ ← Folder
├── README.md ← Meta file
├── architecture/ ← Folder
│ └── ... ← Placeholder for architecture files
└── implementation/ ← Folder
└── ... ← Placeholder for implementation files
```

### Bad Example

```markdown
❌ DON'T DO THIS:
bitwarden_license/bit-common/src/dirt/docs/
├── README.md
├── getting-started.md
├── documentation-structure.md ← Individual file (remove)
├── integration-guide.md ← Individual file (remove)
├── playbooks/
│ ├── README.md
│ ├── service-implementation-playbook.md ← Individual file (remove)
│ ├── component-migration-playbook.md ← Individual file (remove)
│ └── documentation-playbook.md ← Individual file (remove)
└── access-intelligence/
├── analysis-ngrx-signals.md ← Individual file (remove)
└── architecture/
├── architecture-review.md ← Individual file (remove)
└── service-dependency-graph.md ← Individual file (remove)
```

### Why This Rule?

**Problems with listing individual files:**

1. **Maintenance burden** - Diagram needs updating every time a file is added/removed
2. **Cluttered** - Hard to see the overall structure
3. **Not scalable** - Large directories become unreadable
4. **Focus on structure** - Diagram should show organization, not inventory

**Benefits of folders + placeholders:**

1. **Low maintenance** - Structure rarely changes even as files are added
2. **Clear hierarchy** - Easy to understand organization at a glance
3. **Scalable** - Works for any size directory
4. **Purpose-focused** - Shows "where things go" not "what exists"

### Exception: Core Navigation Files

For the top-level `docs/` directory, you may include **core navigation files** that are essential entry points:

- ✅ `getting-started.md` - Main entry point
- ✅ `documentation-structure.md` - Core reference

These exceptions should be rare and only for files that are critical to understanding the documentation structure.

### Using Placeholders

**Placeholder format:**

```markdown
├── playbooks/
│ ├── README.md
│ └── ... ← Indicates other playbook files exist
```

**Placeholder with description:**

```markdown
├── architecture/
│ └── ... ← Architecture comparison files
```

**What placeholders communicate:**

- "There are other files here"
- "See README.md for details"
- "Not listing every file to keep diagram clean"

---

## Related Documentation

**Standards:**

- [Coding Standards](./standards.md) - Code-specific standards and patterns
- [Service Testing Standards](./testing-standards-services.md) - Service testing guidelines
- [Component Testing Standards](./testing-standards-components.md) - Component testing guidelines

**Navigation:**

- [Getting Started](../getting-started.md) - Documentation navigation hub
- [Documentation Structure](../documentation-structure.md) - How docs are organized

---

## Maintenance

**When to update this document:**

- Adding new documentation types
- Changing naming conventions
- Adding new metadata requirements
- Discovering new standards or patterns

**How to update:**

1. Update version number
2. Update "Last Updated" date in footer
3. Update related documentation if structure changes

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
