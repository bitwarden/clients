# Contributing to `@bitwarden/components`

## What Belongs Here

- This library holds low-level, domain-agnostic UI. Domain-coupled UI (ciphers, billing, onboarding tours) belongs in the owning team's folder; business logic belongs in services.
- Promote UI into this library once a second team needs it.

## Requirements

- Contributions to this library **MUST** be made in a standalone PR, independent of changes to downstream apps or libraries. The only exception is when migrating existing consumers due to a breaking API or design change, which must be pre-approved by `@bitwarden/team-ui-foundation`.
- Breaking changes and non-obvious changes to consumer code **MUST** be called out explicitly in the PR description.
- Visual or behavioral changes (sizes, click targets, variants, global defaults) **MUST** have Design sign-off and be documented in Figma.
- Every component **MUST** have Storybook coverage for each visual state and variant it supports. Stories are this library's primary documentation and visual regression surface, so prefer them over Jest rendering specs, which duplicate that coverage. Reserve Jest for non-rendering logic.
- Follow the [code style](./CODE_STYLE.md).
