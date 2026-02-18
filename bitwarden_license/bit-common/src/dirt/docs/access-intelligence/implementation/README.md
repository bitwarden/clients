# Implementation Guides

**Purpose:** Step-by-step implementation guides for integrating Access Intelligence features

---

This directory contains step-by-step integration guides for each abstract service created during the Access Intelligence rewrite.

## Purpose

These guides document HOW to integrate each new service into the existing codebase. They are reference material for future implementation work, not immediate implementation steps.

## Guide Index

### Batch 0-1 (Foundational Services)

- **[DrawerStateService Integration](./drawer-state-integration.md)** - Migrating drawer UI state from RiskInsightsDataService
- **[CipherHealthService Integration](./cipher-health-integration.md)** - Replacing PasswordHealthService with improved architecture

### Batch 2 (Member Mapping)

- **[MemberCipherMappingService Integration](./member-cipher-mapping-integration.md)** - Replacing manual member mapping logic with dedicated service

### Batch 3 (Report Generation) - _Documentation Coming Soon_

- ReportGenerationService Integration

### Batch 4 (Persistence)

- **[ReportPersistenceService Integration](./report-persistence-integration.md)** - Backend-agnostic persistence with multiple implementation support

### Batch 5 (Data Service & Facade) - _Coming Soon_

- AccessIntelligenceDataService Integration

## Guide Format

Each guide follows this structure:

1. **Overview** - What service this replaces and why
2. **DI Registration** - How to wire into Angular providers
3. **Component Migration** - Before/after code examples
4. **Integration Patterns** - How it interacts with existing code
5. **Migration Checklist** - Step-by-step implementation tasks
6. **Testing Strategy** - How to verify correctness - Should write a test file if available
7. **Rollback Plan** - How to revert if issues arise

## Usage

These guides are **reference documentation** for when we're ready to migrate components. They capture architectural decisions and integration patterns established during the abstract service design phase.

**When to use:**

- When starting component migration for a specific service
- When reviewing integration approaches before implementation
- When troubleshooting migration issues
- When onboarding team members to the new architecture

## Related Documentation

- [Playbook](../playbook.md) - Overall session workflow
- [Service Dependency Graph](../architecture/service-dependency-graph.md) - Architecture overview
- [Session Logs](../sessions/) - Design decisions and rationale

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
