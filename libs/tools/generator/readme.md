# Bitwarden Credential Generators

This folder contains the TypeScript implementation of the Bitwarden credential
generator.

## generator-core

Package name: `@bitwarden/generator-core`

Contains credential generation services, configurations, types, and utilities.

Use this module to integrate the generator with your services.

## generator-components

Package name: `@bitwarden/generator-components`

Contains Angular components and modules.

Use this module to integrate the generator with your components.

## generator-history

Package name: `@bitwarden/generator-history`

Generator history layer.

Use this module to record generated credentials to an account's credential log.

## generator-navigation

Package name: `@bitwarden/generator-navigation`

Backwards compatibility layer for legacy generator support.

> [!WARNING]
> Do not use this module.

## generator-legacy

Package name: `@bitwarden/generator-legacy`

Backwards compatibility layer for legacy generator support.

> [!WARNING]
> Do not use this module.

## Navigation

- [Tools README](../README.md)
- [Generator conventions](./conventions.md)
- [Generator help](https://bitwarden.com/help/generator/)
- [Generator SDK](https://github.com/bitwarden/sdk-internal/tree/main/crates/bitwarden-generators)
