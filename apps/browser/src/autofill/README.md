# Autofill

Documentation home for the autofill module.

## Build flags

### `BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS`

Enables lightweight performance instrumentation (spans, meters, poisoning) in autofill content
scripts. Disabled by default; folds to a no-op at compile time when unset. See
[`content/performance.md`](./content/performance.md#enabling) for how to enable it and its
disabled-state behavior.

### `BW_DETECT_SYNC_BOUNDARIES`

Enables a guard that reports when a value crosses an asynchronous boundary inside a bracketed
synchronous-fold region. Enabled in development and CI builds; folds to a no-op when unset, so
production builds pay no cost.

## Table of Contents

- **How to**
  - [Measure Content Script Performance](./content/performance.md)
- **Design**
  - [The Monitoring Lifecycle](./lifecycle.design.md)
  - [Fill Mechanics](./autofill.design.md)
  - [Content Script Performance](./content/performance.design.md)
