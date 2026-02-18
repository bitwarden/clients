# Documentation Playbook

**Purpose:** Step-by-step guide for creating or updating DIRT team documentation

---

## 🎯 When to Use This Playbook

Use this playbook when:

- Creating new documentation files
- Updating existing documentation
- Reorganizing documentation structure
- Adding new sections to existing docs

**Goal:** Ensure all documentation follows team standards, has single responsibility, and doesn't overlap with existing docs.

---

## 📋 Prerequisites

Before creating or updating documentation:

1. **Read team standards:**
   - [documentation-standards.md](../standards/documentation-standards.md) - Documentation standards (REQUIRED)
   - [standards.md](../standards/standards.md) - Coding standards
   - [documentation-structure.md](../documentation-structure.md) - How docs are organized
   - [docs/README.md](../README.md) § Documentation Best Practices

2. **Understand existing documentation:**
   - [getting-started.md](../getting-started.md) - Navigation hub
   - [integration-guide.md](../integration-guide.md) - Service ↔ Component integration
   - Playbooks in [playbooks/](./README.md) - Implementation guides

3. **Start at the DIRT team root:**
   - Location: `bitwarden_license/bit-common/src/dirt/`
   - Read [CLAUDE.md](../../CLAUDE.md) for team context
   - Navigate to [docs/](../) for documentation hub

---

## 🚀 Step-by-Step Process

### Step 1: Define Document Purpose (5-10 min)

**Questions to answer:**

1. **What question does this document answer?**
   - "WHAT should I read?" → Navigation (getting-started.md)
   - "HOW is it organized?" → Structure (documentation-structure.md)
   - "HOW do I implement X?" → Playbook ([topic]-playbook.md)
   - "WHAT are the rules?" → Standards (standards.md)
   - "WHY did we decide X?" → ADR (NNN-title.md)

2. **Does this overlap with existing docs?**
   - Read related documents (see Prerequisites)
   - If overlap exists, should you:
     - Add to existing doc instead of creating new?
     - Move content from existing doc to new doc?
     - Consolidate multiple docs?

3. **What is the document's single responsibility?**
   - Write a one-sentence purpose statement
   - Example: "Explain how documentation is organized across packages"
   - If you need multiple sentences, you might be creating multiple documents

**Output:** Clear, single-sentence purpose statement

---

### Step 2: Check for Overlaps (10-15 min)

**Required checks:**

**For navigation content:**

- [ ] Does [getting-started.md](../getting-started.md) already cover this?
- [ ] Should this be added to getting-started.md instead?

**For structure/organization content:**

- [ ] Does [documentation-structure.md](../documentation-structure.md) already cover this?
- [ ] Should this be added to documentation-structure.md instead?

**For implementation guidance:**

- [ ] Do existing playbooks already cover this?
- [ ] Should this be a new playbook or added to existing playbook?

**For coding standards:**

- [ ] Does [standards.md](../standards/standards.md) already cover this?
- [ ] Should this be added to standards.md instead?

**For integration patterns:**

- [ ] Does [integration-guide.md](../integration-guide.md) already cover this?
- [ ] Should this be added to integration-guide.md instead?

**Decision:** Create new doc, add to existing doc, or consolidate multiple docs?

---

### Step 3: Choose Document Type and Location (5 min)

**See [documentation-standards.md](../standards/documentation-standards.md) for complete naming conventions and location rules.**

**Quick reference - Document types and naming:**

| Type             | Naming Convention                      | Location                    | Example                                |
| ---------------- | -------------------------------------- | --------------------------- | -------------------------------------- |
| **Meta file**    | `README.md`, `CLAUDE.md` (ALL CAPS)    | Directory root              | `docs/README.md`                       |
| **Regular doc**  | `lowercase-kebab-case.md`              | `docs/`                     | `getting-started.md`                   |
| **Playbook**     | `[topic]-playbook.md`                  | `docs/playbooks/`           | `documentation-playbook.md`            |
| **Standard**     | `[topic].md` or `[topic]-standards.md` | `docs/standards/`           | `standards.md`                         |
| **ADR**          | `NNN-title.md` (numbered)              | `docs/[feature]/decisions/` | `001-ground-up-rewrite.md`             |
| **Feature docs** | `lowercase-kebab-case.md`              | `docs/[feature]/`           | `access-intelligence/architecture/...` |

**Location rules:**

- **Cross-cutting docs** (reference multiple packages) → `docs/` (team root)
- **Feature-specific docs** (platform-agnostic services) → `docs/[feature]/`
- **Component docs** (Angular-specific) → `bit-web/src/app/dirt/[feature]/docs/`
- **Browser docs** (browser extension) → `apps/browser/src/dirt/[feature]/docs/`

**Decision:** Document type, name, and location chosen

---

### Step 4: Create Document with Required Metadata (10-15 min)

**See [documentation-standards.md](../standards/documentation-standards.md) § Document Metadata Requirements for complete requirements.**

**Use the metadata template:**

- Copy template from [documentation-standards.md](../standards/documentation-standards.md#required-metadata)
- Fill in title, purpose (one sentence), and dates
- Use version 1.0 for new documents
- Include all required sections

---

### Step 5: Write Content Following Standards (varies)

**See [documentation-standards.md](../standards/documentation-standards.md) § Content Guidelines for complete writing standards.**

**Key reminders:**

- Maintain single responsibility (each section supports main purpose)
- Use clear structure (headings, bullet points, tables, code blocks)
- Include examples (✅ CORRECT / ❌ WRONG patterns)
- Cross-reference related docs (don't duplicate content)
- Follow writing style from standards (clear, direct, present tense, active voice)

---

### Step 6: Update Related Navigation Docs (10-15 min)

**After creating or updating documentation, check if these need updates:**

**Always check:**

- [ ] [getting-started.md](../getting-started.md) - If this is a primary entry point for a task
- [ ] [docs/README.md](../README.md) - If this is a new category or cross-cutting doc
- [ ] [playbooks/README.md](./README.md) - If this is a new playbook

**Check if applicable:**

- [ ] [documentation-structure.md](../documentation-structure.md) - If this changes how docs are organized
- [ ] [CLAUDE.md](../../CLAUDE.md) - If this is critical context for Claude Code
- [ ] [Component CLAUDE.md](/bitwarden_license/bit-web/src/app/dirt/access-intelligence/CLAUDE.md) - If this is component-specific

**What to update:**

- Add link to new document in relevant navigation tables
- Update "Quick Decision Guide" if this answers a new task question
- Update cross-references in related documents

---

### Step 7: Verify and Review (5-10 min)

**Pre-commit checklist:**

**Document metadata:**

- [ ] Title is clear and descriptive
- [ ] Purpose statement is one sentence
- [ ] Last Updated date is today (YYYY-MM-DD)
- [ ] Document Version is included (X.Y format)
- [ ] Maintainer is specified

**Content quality:**

- [ ] Single responsibility maintained (document does ONE thing)
- [ ] No overlap with existing docs (or intentional overlap is cross-referenced)
- [ ] Examples included where helpful
- [ ] Cross-references use correct paths

**Navigation:**

- [ ] getting-started.md updated (if applicable)
- [ ] docs/README.md updated (if applicable)
- [ ] playbooks/README.md updated (if playbook)
- [ ] Related CLAUDE.md files updated (if critical context)

**Naming conventions:**

- [ ] Follows naming standards (ALL CAPS meta files, lowercase-kebab-case regular docs)
- [ ] Playbooks use `-playbook` suffix
- [ ] ADRs use numbered format (NNN-title.md)

---

## 🚨 Common Pitfalls

### 1. Overlapping Responsibilities

**Problem:** Multiple documents answer the same question

**Example we fixed:**

- documentation-structure.md had "Which Documentation Should I Use?" (navigation)
- getting-started.md also did navigation
- **Fix:** Moved all navigation to getting-started.md, documentation-structure.md now only explains structure

**Prevention:**

- Read related docs before creating new ones
- Use "Check for Overlaps" step (Step 2)
- Ask: "What happens if I remove this document? What information is lost?"

---

### 2. Missing Version Numbers

**Problem:** All recent docs were created without version numbers

**Example:**

- getting-started.md had no version number
- documentation-structure.md had no version number
- **Fix:** Added version 1.0 to all new docs

**Prevention:**

- Always include version number in footer metadata
- Use template from Step 4

---

### 3. Missing Purpose Statement

**Problem:** Document doesn't clearly state what it does

**Example:**

- Document titled "Access Intelligence" without explaining if it's a guide, standards, or navigation
- **Fix:** Add clear purpose statement at top: "Purpose: Step-by-step guide for creating or updating DIRT team documentation"

**Prevention:**

- Always include purpose statement after title
- Make it one sentence
- Answer: "What question does this document answer?"

---

### 4. Unclear Document Type

**Problem:** File naming doesn't indicate document type

**Example:**

- `guide.md` - Is this a playbook? Standards? Navigation?
- **Fix:** Use clear naming: `documentation-playbook.md`

**Prevention:**

- Use naming conventions from Step 3
- Playbooks use `-playbook` suffix
- Standards use `-standards` suffix or just name (standards.md)
- Navigation uses descriptive names (getting-started.md)

---

### 5. Broken Cross-References

**Problem:** Links break when files move

**Example:**

- Absolute paths pointing to old locations
- Relative paths that don't account for directory depth
- **Fix:** Update all cross-references after moving files

**Prevention:**

- Use relative paths when possible
- Test links after creating document
- Update related navigation docs (Step 6)

---

### 6. Forgetting to Update Navigation

**Problem:** New document created but no one can find it

**Example:**

- Created new playbook but didn't add to playbooks/README.md
- Created new feature docs but didn't add to docs/README.md
- **Fix:** Always update navigation docs (Step 6)

**Prevention:**

- Use "Update Related Navigation Docs" checklist (Step 6)
- Check getting-started.md, docs/README.md, playbooks/README.md

---

## 📊 Quick Reference

**For complete details, see [documentation-standards.md](../standards/documentation-standards.md)**

**Quick reference below for workflow convenience:**

---

### Document Type Decision Tree

```
What are you documenting?
│
├─ "WHAT should I read?" (Navigation)
│  └─ Add to getting-started.md OR create navigation doc
│
├─ "HOW is it organized?" (Structure)
│  └─ Add to documentation-structure.md OR create structure doc
│
├─ "HOW do I implement X?" (Implementation)
│  └─ Create [topic]-playbook.md in docs/playbooks/
│
├─ "WHAT are the rules?" (Standards)
│  └─ Add to standards.md OR create [topic]-standards.md
│
├─ "WHY did we decide X?" (Architecture)
│  └─ Create NNN-title.md ADR in docs/[feature]/decisions/
│
└─ "HOW does X work?" (Feature docs)
   └─ Create in docs/[feature]/ OR bit-web/[feature]/docs/
```

---

### Required Metadata Template

**See [documentation-standards.md](../standards/documentation-standards.md#document-metadata-requirements) for complete metadata requirements and version numbering rules.**

```markdown
# [Document Title]

**Purpose:** [One-sentence description]

**Last Updated:** 2026-02-13

---

[Content]

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Maintainer:** DIRT Team
```

---

### Navigation Update Checklist

After creating/updating documentation:

- [ ] [getting-started.md](../getting-started.md) - Primary task entry points
- [ ] [docs/README.md](../README.md) - New categories or cross-cutting docs
- [ ] [playbooks/README.md](./README.md) - New playbooks
- [ ] [documentation-structure.md](../documentation-structure.md) - Organization changes
- [ ] [CLAUDE.md](../../CLAUDE.md) - Critical context for AI tools
- [ ] Component CLAUDE.md files - Component-specific docs

---

## 🔄 Maintenance

**When to update this playbook:**

- Changing the documentation creation process/workflow
- Adding new navigation documents to check
- Discovering new common pitfalls
- Updating decision trees or checklists

**When to update documentation-standards.md instead:**

- Changing naming conventions
- Changing metadata requirements
- Adding new document types
- Changing location rules

**How to update:**

1. Follow this playbook to update itself (meta!)
2. Update version number
3. Update "Last Updated" date
4. Update playbooks/README.md if purpose changes

---

**Document Version:** 1.1
**Last Updated:** 2026-02-13
**Maintainer:** DIRT Team
