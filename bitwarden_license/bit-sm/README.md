# Secrets Manager

Commercial Secrets Manager library: API services, request/response DTOs and view models for
projects, secrets, machine accounts (service accounts), access policies, counts, events and
import/export.

The code here is **framework-agnostic** (no Angular) so that it is not tied to the web vault
(`bitwarden_license/bit-web`) or the `bw sm` CLI (`bitwarden_license/bit-cli`), which consume it.
The Angular DI wiring lives in `bitwarden_license/bit-web/src/app/secrets-manager/provide-secrets-manager.ts`;
the CLI instantiates the services in `bitwarden_license/bit-cli/src/service-container.ts`.

Import via the `@bitwarden/bit-sm/*` path alias, for example
`@bitwarden/bit-sm/projects/project.service`.

## Running tests

`npm test -- bit-sm`
