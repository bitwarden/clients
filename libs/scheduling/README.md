# `@bitwarden/scheduling`

Owned by: platform

Background task scheduling infrastructure for Bitwarden clients.

## Overview

This library provides the shared abstractions for scheduling recurring and one-shot background tasks across Bitwarden client platforms. It defines a common contract that each platform implements according to its own execution model — for example, browser extensions use `chrome.alarms` because service workers can be killed at any time, while desktop and CLI clients use standard `setTimeout`/`setInterval`.

## Key Abstractions

**`TaskSchedulerService`** — The abstract service interface that all scheduling consumers depend on. Platform packages provide their own concrete implementations; nothing in this library should be imported to fulfill this contract at runtime.

**`DefaultTaskSchedulerService`** — The concrete implementation backed by `globalThis.setTimeout` and `globalThis.setInterval`. This is the scheduler used by the desktop and CLI clients, where a persistent process can be relied upon.

**`ScheduledTaskName`** — A const object enumerating every named scheduled task in the monorepo (e.g., `loginStrategySessionTimeout`, `vaultTimeoutCheckInterval`, `eventUploadsInterval`). All tasks must be registered here to ensure unique, trackable identifiers across platforms.

**`toScheduler()`** — A utility that bridges `TaskSchedulerService` to the RxJS `SchedulerLike` interface, enabling use with RxJS operators such as `timer`.

## Platform Extensions

Platform-specific scheduler implementations live outside this library in their respective app packages. The browser implementation (`apps/browser/src/_background/services/browser-task-scheduler.service.ts`) is the primary example — it wraps `chrome.alarms` to survive service worker lifecycle events. Adding a new platform scheduler means implementing `TaskSchedulerService` and registering it in that platform's dependency injection setup.

## Backward Compatibility

The original source location at `libs/common/src/platform/scheduling/` has been retained as a re-export shim so that existing imports continue to resolve without requiring a bulk migration. New code should import directly from `@bitwarden/scheduling`.
