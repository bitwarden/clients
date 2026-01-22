# Component Library - Development Guidelines

## Storybook Documentation

**ALWAYS write Storybook stories for each component:**

- Create stories for all visual variants (sizes, colors, states)
- Document common use cases and integration patterns
- Stories serve two purposes:
  1. Visual regression test coverage
  2. Engineering documentation and usage examples

Example structure:

- `Default` story - Basic usage
- `AllVariants` story - Visual comparison of all variants
- `AllSizes` story - Size options
- Use case-specific stories (e.g., `InFormContext`, `WithValidation`)

## Testing Strategy

**Unit test components and services with complex logic:**

- Test business logic, calculations, and state management
- Test component interactions and event handling
- Test accessibility attributes and keyboard navigation
- **DO NOT** test framework behavior (e.g., "Angular renders templates")
- **DO NOT** test trivial getters or simple property assignments

Focus on:

- Custom validators and form logic
- Conditional rendering logic
- User interaction flows
- Error handling and edge cases

## Accessibility Requirements

**All components MUST meet WCAG 2.1 Level AA guidelines:**

- Provide proper ARIA labels and roles for semantic elements
- Ensure keyboard navigation support
- Maintain minimum color contrast ratios
- Support screen reader announcements for dynamic content
- Test with screen readers during development

## Architecture Patterns

**Favor composition over inheritance:**

- Use content projection (`ng-content`) for flexibility
- Create small, focused components that compose well together
- Avoid deep component hierarchies
- Prefer directives for reusable behavior

## Angular Best Practices

**Follow modern Angular patterns:**

- Reference the `angular-modernization` skill for guidance on writing modern Angular code
- Use standalone components
- Prefer signals over RxJS when appropriate (see ADR-0027)
- Use computed() for derived state
- Use effect() sparingly and only for side effects

## Naming Conventions

**Component selector naming:**

- Use `bit-` prefix for all components in the component library
- Example: `bit-button`, `bit-form-field`, `bit-icon-tile`
- This prefix distinguishes CL components from feature team components

---

<!-- next steps -->

- have claude create a component to test the context in this file
- continue to refine context in this file
- have claude try to make new kitchen sink stories using the guidelines for consumers
- continue to refine context in top-level claude.md for consumers

<!-- other skill/command ideas for UIF-specific usage -->

- find and describe usage of a given component or service/function to help with migration tasks. can claude break down the usage of different inputs on a given component? i.e. to help answer questions like "do we still need x variant of this component or can we deprecate it?"

<!-- skill/command ideas for teams to use -->

- finding if a component already exists -- when making something new, check if something similar already exists in the CL or can otherwise be accomplished using CL utilities. specify the steps the user would take to find an existing component rather than list all existing components
- skill for figuring out when to load and use angular context
