# Bitwarden Clients - Claude Code Configuration

## Critical Rules

- **NEVER** edit: `/build/`, `/dist/`, `/.git/`, `/.vs/`, `/node_modules/` which are generated files
- **NEVER** use code regions: If complexity suggests regions, refactor for better readability
- **NEVER** compromise zero-knowledge principles: User vault data must remain encrypted and inaccessible to Bitwarden
- **NEVER** log or expose sensitive data: No PII, passwords, keys, or vault data in logs or error messages
- **ALWAYS** use secure communication channels: Enforce confidentiality, integrity, and authenticity
- **ALWAYS** encrypt sensitive data: All vault data must be encrypted at rest, in transit, and in use
- **ALWAYS** prioritize cryptographic integrity and data protection
- **ALWAYS** add unit tests (with mocking) for any new feature development

## Project Context

- **Architecture**: Feature and team-based organization
- **Framework**: Angular
- **Testing**: Jest
- **Container**: Docker, Docker Compose, Kubernetes/Helm deployable

## Project Structure

- **Browser Extension**: `apps/browser` - Web Extension API and Angular
- **Command-line Interface**: `apps/cli` - TypeScript and Node.js
- **Desktop Application**: `apps/desktop` - Electron and Angular
- **Web Vault**: `apps/web` - Angular

## Security Requirements

- **Compliance**: SOC 2 Type II, SOC 3, HIPAA, ISO 27001, GDPR, CCPA
- **Principles**: Zero-knowledge, end-to-end encryption, secure defaults
- **Validation**: Input sanitization, parameterized queries, rate limiting
- **Logging**: Structured logs, no PII/sensitive data in logs

## Common Commands

- Web Vault: `npm install`, `npm run build:bit:watch`, `npm run build:watch`, `npm run test`
- Lint: `npm run lint`, `npm run lint:fix"`
- Browser extension: `npm run build:extension`
- CLI: `npm run build:oss:debug`, `npm run build:bit:watch`
- Electron: `npm run build:electron`, `npm run start:electron`
- Storybook: `npm run storybook`

## Code Review Checklist

- Security impact assessed
- Jest tests added / updated
- Performance impact considered
- Error handling implemented
- Breaking changes documented
- CI passes: build, test, lint
- Feature flags considered for new features
- CODEOWNERS file respected

## Key Architectural Decisions

- Adopt Observable Data Services for Angular (AR 003)
- Scalable Angular Clients folder structure (AR 0011)
- Angular Reactive Forms (ADR 0024)
- Deprecate TypeScript Enum Types (AR 0025)

## References

- [Server architecture](https://contributing.bitwarden.com/architecture/server/)
- [Architectural Decision Records (ADRs)](https://contributing.bitwarden.com/architecture/adr/)
- [Contributing guidelines](https://contributing.bitwarden.com/contributing/)
- [Setup guide](https://contributing.bitwarden.com/getting-started/clients/)
- [Code style](https://contributing.bitwarden.com/contributing/code-style/)
- [Bitwarden security whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/)
- [Bitwarden security definitions](https://contributing.bitwarden.com/architecture/security/definitions)
