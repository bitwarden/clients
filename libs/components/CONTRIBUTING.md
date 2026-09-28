# Contributing to `@bitwarden/components`

- Contributions to this library **MUST** be made in a standalone PR, independent of changes to downstream apps or libraries. The only exception is when migrating existing consumers due to a breaking API or design change, which must be pre-approved by `@bitwarden/team-ui-foundation`.
- Every component **MUST** have Storybook coverage for each visual state and variant it supports. Stories are this library's primary documentation and visual regression surface, so prefer them over Jest rendering specs, which duplicate that coverage. Reserve Jest for non-rendering logic.
