# Bitwarden Clients Repo Code Review - Careful Consideration Required

## Think Twice Before Recommending

Angular has multiple valid patterns and ongoing migrations. Before suggesting changes:

- **Consider the migration context** - Is this code part of an active modernization effort?
- **Check for established patterns** - Look for similar implementations in the codebase
- **Avoid premature optimization** - Don't suggest refactoring stable, working code without clear benefit
- **Respect incremental progress** - Teams may be modernizing gradually with feature flags

## Angular Modernization - Handle with Care

**Control Flow Syntax (@if, @for, @switch):**

- When you see legacy structural directives (*ngIf, *ngFor), consider whether modernization is in scope
- Do not mandate changes to stable code unless part of the PR's objective
- If suggesting modernization, acknowledge it's optional unless required by PR goals

**Standalone Components:**

- New components should be standalone whenever feasible, but do not flag existing NgModule components as issues
- Legacy patterns exist for valid reasons - consider migration effort vs benefit

**Typed Forms:**

- Recommend typed forms for NEW form code
- Don't suggest rewriting working untyped forms unless they're being modified

## Tailwind CSS - Critical Pattern

**tw- prefix is mandatory** - This is non-negotiable and should be flagged as ❌ major finding:

- Missing tw- prefix breaks styling completely
- Check ALL Tailwind classes in modified files

## Rust SDK Migrations - Tread Carefully

When reviewing cipher operations:

- Look for breaking changes in the TypeScript → Rust boundary
- Verify error handling matches established patterns
- Don't suggest alternative SDK patterns without strong justification

## Component Library First

Before suggesting custom implementations:

- Check if Bitwarden's component library already provides the functionality
- Prefer existing components over custom Tailwind styling
- Don't add UI complexity that the component library already solves

## When in Doubt

- **Ask questions** (💭) rather than making definitive recommendations
- **Flag for human review** (⚠️) if you're uncertain
- **Acknowledge alternatives** exist when suggesting improvements
