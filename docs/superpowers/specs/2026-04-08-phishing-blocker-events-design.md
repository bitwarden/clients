# Phishing Blocker Event Collection — Design Spec

**Date:** 2026-04-08
**Status:** Approved

## Overview

Add three new audit log events to the phishing blocker feature in the browser extension. These events are recorded for organization audit logs — each event is emitted once per organization the user belongs to (where `useEvents` is enabled).

## New Event Types

File: `libs/common/src/dirt/event-logs/enums/event-type.enum.ts`

New `PhishingBlocker` group at the next available block (2400), following the increment-by-100 convention:

| Event Name                     | Value | Description                                        |
| ------------------------------ | ----- | -------------------------------------------------- |
| `PhishingBlocker_SiteAccessed` | 2400  | User was redirected to the phishing warning page   |
| `PhishingBlocker_SiteExited`   | 2401  | User closed the tab from the phishing warning page |
| `PhishingBlocker_Bypassed`     | 2402  | User chose to continue to the known phishing site  |

## Component Changes

File: `apps/browser/src/dirt/phishing-detection/popup/phishing-warning.component.ts`

### Injected dependencies (additions)

- `EventCollectionService` — to record events
- `OrganizationService` — to fetch the active user's organizations
- `AccountService` — to get the active user ID (already available via `OrganizationService`)

### Org fetch helper

A private async helper fetches the active user's organizations filtered to those with `useEvents === true`. Uses `firstValueFrom` on `OrganizationService.organizations$`. This follows the same pattern used inside `EventCollectionService`.

### Event firing

| Lifecycle point    | Event                          | `uploadImmediately` |
| ------------------ | ------------------------------ | ------------------- |
| `ngOnInit`         | `PhishingBlocker_SiteAccessed` | `false`             |
| `closeTab()`       | `PhishingBlocker_SiteExited`   | `false`             |
| `continueAnyway()` | `PhishingBlocker_Bypassed`     | `true`              |

For each event: iterate the filtered org list and call `eventCollectionService.collect(eventType, null, uploadImmediately, org.id)` once per org.

`PhishingBlocker_Bypassed` uses `uploadImmediately = true` because it is a security signal that org admins should receive without delay.

### No changes required to `EventCollectionService`

Passing a valid `organizationId` satisfies the existing `shouldUpdate` guard. No whitelist changes or new methods needed.

## Out of Scope

- Backend changes (event type values must be coordinated with server-side if not already defined there)
- Changes to event upload scheduling
- Any UI changes to the phishing warning page
