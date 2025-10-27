This document provides explicit instructions for Copilot Agent to follow when working with this
repository. It outlines the coding standards, project structure, and best practices to ensure
high-quality contributions that align with the repository's goals and maintainability standards.

## Repository Overview

This repository is organized as a **monorepo** containing multiple applications and libraries. The
main directories are:

- `apps/` – Contains all application projects (e.g., browser, cli, desktop, web). Each app is
  self-contained with its own configuration, source code, and tests.
- `libs/` – Contains shared libraries and modules used across multiple apps. Libraries are organized
  by domain or functionality (e.g., common, ui, platform, key-management).

**Strict boundaries** must be maintained between apps and libraries. Do not introduce
cross-dependencies that violate the intended modular structure. Always consult and respect the
dependency rules defined in `eslint.config.mjs`, `nx.json`, and other configuration files.

## Coding Standards and Best Practices

### 1. Linting and Formatting

- All code **must** pass ESLint and Prettier checks before being committed.
- Use the provided configuration files (`eslint.config.mjs`, `.prettierrc`, etc.).
- **Do not** override or disable linting/formatting rules unless explicitly instructed by repository
  maintainers.
- Run linting and formatting tools locally before submitting changes.

### 2. TypeScript Usage

- Use **strict typing** throughout the codebase. Avoid the use of `any` unless absolutely necessary
  and justified with a comment.
- Adhere to the settings in `tsconfig.json` and `tsconfig.eslint.json`.
- Prefer interfaces and type aliases for type definitions. Use enums and literal types where
  appropriate.
- Always annotate function return types and exported members.

### 3. Project Structure and File Organization

- Place all source code for apps in their respective `src/` directories within `apps/`.
- Place all source code for libraries in their respective `src/` directories within `libs/`.
- Tests should be located in alongside the code in `*.spec.ts` files, following the conventions of
  each app or library.
- Do not place unrelated files or code in shared directories.
- Keep configuration files (e.g., `jest.config.js`, `tsconfig.json`) at the root of each app or
  library.

### 4. Testing

- All new features and bug fixes **must** include appropriate unit and/or integration tests.
- Use Jest for unit tests.
- Ensure all tests pass before submitting changes.
- Write clear, descriptive test names and use test coverage tools to ensure code is well-tested.

### 5. Commit Messages

- Use the **conventional commit** format for all commits. Example:
  `feat(browser): add autofill support for new form type`.
- Prefix commits with `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, etc., as appropriate.
- Include a clear, concise description of the change and reference related issues when applicable.

### 6. Security

- **Never** commit secrets, credentials, or sensitive information. Follow the guidelines in
  `SECURITY.md`.
- Review code for potential security vulnerabilities, especially when handling authentication,
  encryption, or user data.
- Use environment variables and secure storage for sensitive configuration.

### 7. Documentation

- Update `README.md` or other relevant documentation files when making significant changes, adding
  new features, or modifying existing behavior.
- Document public APIs, exported functions, and complex logic with clear comments and docstrings.
- Maintain up-to-date usage instructions and examples for each app and library.

### 8. Dependency Management

- Use `npm` for installing and managing dependencies. Do not use `yarn` or other package managers
  unless specified.
- Do not add or update any dependencies unless explicitly asked.
- Do not modify `package.json` or `package-lock.json` unless required for the task.
- Only the root `package.json` should be modified for adding new dependencies.

### 9. Configuration and Tooling

- Respect all configuration files at the root and within each app/library (e.g.,
  `eslint.config.mjs`, `jest.config.js`, `tsconfig.json`).
- Do not override or duplicate configuration unless required for a specific app or library.
- Use provided scripts in `package.json` for building, testing, and linting.

### 10. Communication and Collaboration

- For questions, clarifications, or proposing significant changes, refer to `CONTRIBUTING.md` or
  contact the repository maintainers.
- Open issues or pull requests with detailed descriptions and context.
- Review and address feedback promptly.

## Summary Checklist for Copilot Agent

- [ ] Respect monorepo structure and boundaries
- [ ] Pass all linting and formatting checks
- [ ] Use strict TypeScript typing
- [ ] Add/update tests for all changes
- [ ] Follow conventional commit messages
- [ ] Do not commit secrets or sensitive data
- [ ] Update documentation as needed
- [ ] Use npm for dependencies and do not modify lockfiles unnecessarily
- [ ] Adhere to all configuration and tooling standards
