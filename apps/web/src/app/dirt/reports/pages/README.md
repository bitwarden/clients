# Passkey Login Report

The Passkey Login Report identifies vault items that could benefit from passkey authentication but don't yet have FIDO2 credentials configured. It cross-references the user's login ciphers against a server-side passkey directory to surface actionable recommendations.

## Server-Side Reference

> Server-side implementation details: [Link to server README](https://github.com/bitwarden/server/blob/0d4dfd85c56f1b230d00f420859a4c30a26c6659/src/Core/Dirt/Reports/ReportFeatures/PasskeyDirectoryReport/README.md)

## How It Works

### Data Flow

1. **Passkey directory fetch** -- The client calls `GET /reports/passkey-directory` to retrieve a list of services that support passkey authentication. Each entry contains:
   - `DomainName` -- The service's domain (e.g., `github.com`)
   - `Instructions` -- A URL pointing to the service's passkey setup documentation
   - `Passwordless` -- Whether the service supports passkey login (passwordless)
   - `Mfa` -- Whether the service supports passkeys as MFA

2. **Client-side matching** -- Decrypted login ciphers are matched against the directory by comparing cipher URIs (host and domain) to directory domain names. A cipher is included in the report if:
   - It is a **Login** type cipher
   - It has at least one URI
   - It does **not** already have FIDO2 credentials
   - It is not deleted
   - The user has view-password permission

3. **Report display** -- Matching ciphers are shown in a table with the cipher name, passkey type indicators (login vs. MFA), owner, and a link to setup instructions when available.

### Matching Logic

The matching algorithm (in `passkey-report.service.ts`) strips `www.` from cipher URIs and checks both the full host and the domain against the directory. The first match wins.

```
cipher URI: https://www.github.com/login
  -> host:   github.com  (match against directory)
  -> domain: github.com  (fallback match)
```

## Components

| Component                   | Path                                            | Description                               |
| --------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `PasskeyReportComponent`    | `passkey-report.component.ts`                   | Individual user report with org filtering |
| `OrgPasskeyReportComponent` | `organizations/org-passkey-report.component.ts` | Organization-scoped report (standalone)   |
| `passkey-report.service.ts` | `passkey-report.service.ts`                     | Shared matching and processing logic      |

### Individual vs. Organization

- **Individual** (`/reports/passkey-report`) -- Shows all ciphers across the user's personal vault and any organizations they belong to. Includes toggle/chip-select filtering by vault owner.
- **Organization** (`/organizations/:orgId/reporting/reports/passkey-report`) -- Shows only ciphers belonging to the specified organization. Uses `AdminConsoleCipherFormConfigService` for edit access and checks `canManageCipher` permissions.

## Feature Flag

The report is gated behind the `PasskeyLoginReport` feature flag (`inno-passkey-directory-report`). Both the individual and organization routes use `canAccessFeature(FeatureFlag.PasskeyLoginReport)` as a route guard. If the flag is disabled, navigation redirects away from the report.

## API Service

| Layer          | File                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| Abstraction    | `libs/common/src/dirt/services/abstractions/passkey-directory-api.service.ts` |
| Implementation | `libs/common/src/dirt/services/default-passkey-directory-api.service.ts`      |
| Response model | `libs/common/src/dirt/models/response/passkey-directory-entry.response.ts`    |

The service is registered in `jslib-services.module.ts`.

## Route Guards

| Context      | Guards                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------- |
| Individual   | `authGuard`, `hasPremiumGuard`, `canAccessFeature(PasskeyLoginReport)`                   |
| Organization | `organizationPermissionsGuard`, `isPaidOrgGuard`, `canAccessFeature(PasskeyLoginReport)` |
