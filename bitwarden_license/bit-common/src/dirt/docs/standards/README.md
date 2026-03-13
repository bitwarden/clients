# DIRT Team - Development Standards

**Purpose:** Hub for all DIRT team development standards and conventions

**Last Updated:** 2026-02-13

---

## 📚 Standards Files

### Data Models

**[model-standards.md](./model-standards.md)**

View model construction patterns, 4-layer architecture (Api/Data/Domain/View), and EncString handling.

---

### Services

**[service-standards.md](./service-standards.md)**

Service responsibility patterns, helper function guidelines, and service design principles.

---

### RxJS

**[rxjs-standards.md](./rxjs-standards.md)**

Observable patterns, RxJS best practices, hot vs cold observables, and common import paths.

---

### Angular

**[angular-standards.md](./angular-standards.md)**

Angular-specific patterns including state management with Observables and Signals.

---

### Code Organization

**[code-organization-standards.md](./code-organization-standards.md)**

Naming conventions, file organization, comment standards, and where to document architectural decisions.

---

### Documentation

**[documentation-standards.md](./documentation-standards.md)**

Documentation file naming, metadata requirements, structure standards, and content guidelines.

---

### Testing - Services

**[testing-standards-services.md](./testing-standards-services.md)**

Testing standards for platform-agnostic services including test structure, mocking patterns, and coverage guidelines.

---

### Testing - Components

**[testing-standards-components.md](./testing-standards-components.md)**

Testing standards for Angular components including OnPush testing, Signal testing, and Storybook integration.

---

### Responsive Design

**[responsive-design-standards.md](./responsive-design-standards.md)**

Mobile-first responsive design patterns, Tailwind breakpoints, accessibility requirements, and testing guidelines.

---

## 🎯 Quick Navigation

**By Task:**

| What are you doing?                    | Read this                                                            |
| -------------------------------------- | -------------------------------------------------------------------- |
| Implementing models (Data/Domain/View) | [model-standards.md](./model-standards.md)                           |
| Implementing services                  | [service-standards.md](./service-standards.md)                       |
| Working with Observables               | [rxjs-standards.md](./rxjs-standards.md)                             |
| Building Angular components            | [angular-standards.md](./angular-standards.md)                       |
| Building responsive layouts            | [responsive-design-standards.md](./responsive-design-standards.md)   |
| Organizing code/naming                 | [code-organization-standards.md](./code-organization-standards.md)   |
| Writing documentation                  | [documentation-standards.md](./documentation-standards.md)           |
| Writing service tests                  | [testing-standards-services.md](./testing-standards-services.md)     |
| Writing component tests                | [testing-standards-components.md](./testing-standards-components.md) |

---

## 🆕 Adding New Standards

**When to create a new standards file:**

- New technology or framework adopted (e.g., signals-standards.md)
- Existing file becomes too large (>500 lines)
- New domain requires comprehensive guidelines

**When to add to existing file:**

- Extending existing standards with new patterns
- Adding examples or clarifications
- Small additions (<50 lines)

**Process:**

1. Create new file in standards/ folder
2. Add to this README with description
3. Update related guides
4. Update getting-started.md if it's a primary entry point

---

**Document Version:** 1.1
**Last Updated:** 2026-02-18
**Maintainer:** DIRT Team
