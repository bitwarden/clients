# Conventions

This file outlines the code conventions that we're applying to code within the generator
modules. These conventions supplement the conventions in the
[contributing documentation][code-style].

> [!IMPORTANT]
> If you are using a programming assistant, please include this file in the prompt's
> context when generating code.

## Modules

Every source folder is treated as a module, and must have a barrel file. It may
import from its ancestors and its children. Modules should not import from their
cousins or grandchildren. Do not import barrel files from parent scopes.

✅ Do:

```ts
import foo from "../../foo";
import bar from "../bar";
import baz from "../baz.ts";

import biz from "./biz";
```

❌ Do not:

```ts
import foo from "../";
import bar from "../../foo/bar";
import baz from "../bar/baz.ts";

import buz from "./baz/biz/buz";
```

### Barrel files ([ADR-0002][adr-0002])

The root barrel file contains all public exports of the module. All other barrel files
are internal to the module. This is presently [enforced with a lint][restrict-path-lint].

### Common files

The following files may be used to consolidate low-level module items.

- `data.ts` <- constants; may only depend on external modules.
- `index.ts` <- exports; may define aggregates and apply type assertions to improve module DevEx.
- `type.ts` <- type definitions; may only depend on `data.ts` and external modules.
- `util.ts` <- utility functions; may only depend on `data.ts`, `type.ts`, and external modules.

[Example][common-files-example]

> [!TIP]
> Implementing the `const object` pattern ([ADR-0025][adr-0025]):
>
> 1. Write the const object into `data.ts`
> 2. Derive type definitions from the const object in `type.ts`
> 3. Import types and data into `index.ts`, perform type assertions, and re-export the data.

## Rx ([ADR-0015][adr-0015])

Reactive code should be written functionally, with liberal use of observable injection. Core
rx code should not depend on services. It should depend solely on reactive objects and
functions.

Services and other long-lived components compose the rx logic for injection into other contexts.
They read observables from their dependencies and inject them into the Core rx code.

[Example][rx-example]

## Logging

The generator's reactivity model is time-sensitive, which makes identifying and diagnosing runtime
behaviors difficult. Consider, for example, interactively debugging an observable subject to
`timeout()`. Because the computer's clock keeps running when the debugger is paused, stopping a
program subject to this operation can exhaust the timeout, resulting in
[heisenbugs][heisenbug]. The generator's permanent runtime logging
facilities decrease this complexity of debugging by writing structured logs using the
`SemanticLogger`.

When a generator creates a logger, it sets the log's `type` parameter. This can be filtered by
editing XYZ.

> [!CAUTION]
> The `SemanticLogger` writes arbitrary runtime information into the console. It is
> automatically disabled outside of development environments to mitigate data leaks.

[adr-0002]: https://contributing.bitwarden.com/architecture/adr/public-module-npm-packages
[adr-0015]: https://contributing.bitwarden.com/architecture/adr/short-lived-browser-services#decision-outcome
[adr-0025]: https://github.com/bitwarden/contributing-docs/pull/605
[code-style]: https://contributing.bitwarden.com/contributing/code-style/
[common-files-example]: https://github.com/bitwarden/clients/tree/main/libs/tools/generator/core/src/metadata
[heisenbug]: https://en.wikipedia.org/wiki/Heisenbug
[restrict-path-lint]: https://github.com/bitwarden/clients/blob/721657a5c30802edef34a20309c01ae2952b1da1/eslint.config.mjs#L131-L134
[rx-example]: https://github.com/bitwarden/clients/tree/2e78c3edc7153d275c8814f3ffde02fb4a82ac0d/libs/common/src/tools/achievements

## Navigation

- [Generator README](./readme.md)
