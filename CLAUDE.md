# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Bitwarden Clients repository containing all Bitwarden client applications except mobile apps. It's a monorepo with multiple applications and shared libraries built using Angular, TypeScript, and various build tools.

## Architecture

### Applications (apps/)

- **browser**: Browser extension using Angular and webpack
- **cli**: Command-line interface built with TypeScript/Node.js
- **desktop**: Desktop application using Electron and Angular
- **web**: Web vault application using Angular

### Libraries (libs/)

- **common**: Core shared functionality and services
- **angular**: Angular-specific components and utilities
- **components**: Reusable UI component library with Storybook
- **platform**: Platform abstraction layer
- **auth**: Authentication services and components
- **vault**: Vault-related functionality
- **key-management**: Cryptographic key management
- **tools**: Import/export and generator utilities
- **billing**: Billing and subscription management

### Build System

- Uses **Nx** for monorepo management with build orchestration
- **Angular CLI** for Angular applications
- **Webpack** for bundling (custom configs per app)
- **Jest** for testing across all packages

## Development Commands

### Core Development

```bash
# Install dependencies
npm install

# Run tests
npm test
npm run test:watch        # Watch mode
npm run test:watch:all   # Watch all packages

# Linting and formatting
npm run lint             # ESLint + Prettier check
npm run lint:fix         # Auto-fix linting issues
npm run prettier         # Format code
```

### Building Applications

Each application has its own build configuration:

```bash
# CLI application
cd apps/cli && npm run build

# Browser extension
cd apps/browser && npm run build

# Desktop application
cd apps/desktop && npm run build

# Web application
cd apps/web && npm run build
```

### Testing

- **Root level**: `npm test` runs Jest across all packages
- **Package level**: Each package has its own jest.config.js
- **E2E tests**: `npm run test:e2e` runs WebDriver tests

### Component Development

```bash
# Start Storybook for component development
npm run storybook

# Build Storybook
npm run build-storybook
```

## Key Technical Details

### Monorepo Structure

- Nx workspace with dependency graph management
- Shared TypeScript configuration in `tsconfig.base.json`
- Package-specific configurations inherit from base
- Build caching and parallel execution via Nx

### Build Configuration

- Each app uses webpack with custom configurations
- Angular applications use Angular CLI builders
- CLI uses pure webpack for Node.js bundling
- Desktop uses Electron-specific webpack configs (main/renderer/preload)

### Code Organization

- Services follow Angular dependency injection patterns
- State management uses RxJS patterns
- Cryptographic operations isolated in key-management lib
- Platform-specific code abstracted through platform lib

### Testing Strategy

- Unit tests with Jest and jest-mock-extended
- Angular component tests use jest-preset-angular
- E2E tests with WebDriver across multiple browsers
- Storybook interaction tests for components

## Development Workflow

1. **Setup**: Run `npm install` at root to install all dependencies
2. **Development**: Work in specific app/lib directories
3. **Testing**: Use `npm test` for unit tests, specific package tests via their jest configs
4. **Building**: Use app-specific build commands or Nx build targets
5. **Linting**: Always run `npm run lint` before commits (enforced by husky hooks)

## Important Notes

- This is a security-focused codebase - never commit secrets or API keys
- Follow existing patterns for services, components, and state management
- Browser extension has specific manifest v2/v3 configurations
- Desktop app includes Rust native modules in `desktop_native/`
- Bitwarden-licensed code exists in `bitwarden_license/` directory
