# CLASS DOCUMENTATION SUMMARY

## A. SYSTEM REVIEW

This is the Bitwarden clients npm monorepo. The supplied Module 1 diagram describes the existing client/shared-library structure plus a **proposed E1 improvement**: shared platform capability interfaces, client-specific adapters, startup registration, and shared adapter contract tests. The red proposal is a design input, not proof those features have been implemented. Existing storage abstractions and platform implementations already provide some separation (for example CLI Lowdb storage and desktop Electron storage).

| Component           | Existing technology                                                                | Build and eventual delivery                                                        |
| ------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/web`          | Angular 21, TypeScript, RxJS, Webpack                                              | OSS self-hosted web assets; web container/static hosting                           |
| `apps/browser`      | Angular, WebExtension APIs, Lit autofill UI                                        | Chrome MV3 production bundle in this workflow; store-specific packages later       |
| `apps/desktop`      | Electron, Angular, Rust/N-API                                                      | Linux native modules and main/renderer/preload bundles; signed OS installers later |
| `apps/cli`          | Node.js, TypeScript, Commander, Koa                                                | OSS production CLI bundle; npm or platform executables later                       |
| `libs`              | Shared authentication, crypto, state, storage, vault, UI, administration and tools | Consumed by client bundles; library type checks and Jest tests                     |
| `bitwarden_license` | Commercial client and shared extensions                                            | Existing Jest projects are tested; this class workflow builds OSS clients          |
| External services   | Core API, identity and notifications                                               | Separate server repository/infrastructure, not deployed here                       |

Tooling comes from the repository: npm workspaces and lockfile, Node 24 in `.nvmrc` (package engines require at least 24.17.0 and npm 11), Webpack, Nx, Jest, ESLint, Prettier, Storybook, and Cargo. Rust is pinned in `apps/desktop/desktop_native/rust-toolchain.toml` (1.97.1 at inspection). There were 1,371 `*.spec.ts` files at inspection, plus Rust tests and separate Storybook/browser interaction workflows. File counts are not passing-test counts.

CI checks shared code because all four clients depend on it. Jest covers application and library behavior, including licensed projects. Library test code also needs TypeScript checking because Jest's isolated compilation does not provide full type checking. Native tests require an OS session keyring on Linux. Builds check platform wiring and resource compilation. Future E1 contract tests should check storage versus secure key storage and supported/permission-required/unavailable/unsupported capabilities across adapters; this change does not invent those tests or implement E1.

Only the web client has the application Dockerfile inspected here. It builds both JavaScript assets and the .NET web host from `bitwarden/server`, requiring a second checkout at `server/`, including its Git metadata. The API/database are not embedded in this web image. The other clients are distributed as extensions, desktop packages, and CLI packages rather than additional Docker images.

Existing deployment-related files include `apps/web/Dockerfile`, `entrypoint.sh`, web environment JSON configurations, Electron packaging resources, browser packaging scripts, and upstream `.github/workflows/build-*.yml` / `publish-cli.yml`. Upstream automation references Azure, registries, signing and other Bitwarden services; their existence does not give this class fork deployment credentials. Those workflows remain intact and may run alongside this workflow, increasing CI usage.

Build configuration includes `NODE_ENV`, web `ENV=selfhosted`, browser `BROWSER`/`MANIFEST_VERSION`, and Docker `NODE_VERSION`, `NPM_COMMAND`, `LICENSE_TYPE`. Runtime API/identity/notification endpoints must match a future deployment. Unit CI needs neither a real vault nor a production database. Dependency installation and Docker builds require public registry/GitHub/container registry network access. If any dependency becomes private, configure scoped GitHub Secrets rather than committing tokens. No deployment secrets are required by the new workflow.

## B. AI-GENERATED PIPELINE

Files created or modified:

- `.github/workflows/ci-cd.yml`: independent class workflow.
- `scripts/test-types.js`: correct recursive variable scope, quote project paths, bound parallelism, and propagate compiler failures.
- `apps/web/Dockerfile`: install Python, make and g++ only in the Node build stage for native npm dependencies.
- `libs/vault/src/components/download-attachment/download-attachment.component.spec.ts`: define the missing Request mock through `globalThis`, fixing a test setup failure without changing application behavior.
- `apps/web/webpack.base.js`: limit production minifier parallelism to two workers after Docker memory exhaustion. Optimization options remain unchanged.
- `docs/class-ci-cd.md`: this review, testing record and presentation notes.

The workflow reuses action commit pins already present in this checkout; it does not claim to have audited those actions. It uses `pull_request`, not privileged `pull_request_target` execution.

| YAML section/job                | Behavior and reason                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `on`                            | Pushes to main, PRs targeting main, and manual CI runs. No path filters that accidentally omit shared-code changes.                                                                                                                                                                                                                                         |
| `permissions`                   | Read-only repository access; checkout does not persist credentials. No publishing permissions.                                                                                                                                                                                                                                                              |
| `concurrency`                   | Cancels superseded runs for the same ref to avoid wasting resources.                                                                                                                                                                                                                                                                                        |
| `defaults` / `env`              | Bash commands and CI mode; job timeouts bound resource consumption.                                                                                                                                                                                                                                                                                         |
| Repeated checkout/setup/install | Each job has a clean checkout, Node from `.nvmrc`, npm download cache, and `npm ci` using the lockfile. A cache never replaces installation.                                                                                                                                                                                                                |
| `quality`                       | Existing ESLint/Prettier command, then library type checking. Any failure blocks the CI gate.                                                                                                                                                                                                                                                               |
| `tests`                         | Five independent groups: web, browser, desktop, CLI, and shared libraries. Includes the licensed test directories, limits Jest to two workers, and collects coverage. Sets `BITWARDENCLI_APPDATA_DIR` to a runner temporary directory to isolate CLI test data. Uploads reports even after test failure for diagnosis. No external coverage account needed. |
| `builds`                        | Matrix builds production OSS web, Chrome MV3, and CLI bundles using actual workspace scripts. Uploads each build with a distinct name and seven-day retention; missing build output is an error.                                                                                                                                                            |
| `desktop`                       | Installs Linux keyring prerequisites, activates the checked-in Rust toolchain, builds native modules, runs Rust library/doc tests, then builds Electron main/renderer/preload sequentially to reduce peak memory. These are compilation checks, not signed installers or interactive desktop tests.                                                         |
| `docker`                        | Checks out clients and a pinned public server commit, records the resolved server SHA, configures Buildx, and builds the existing web Dockerfile for Linux amd64 with OSS arguments. Loads the image but never pushes it.                                                                                                                                   |
| `ci`                            | Runs even when dependencies fail and requires every preceding job result to be success. Use **Class CI gate** as the branch-protection check if the group adopts this workflow.                                                                                                                                                                             |
| `deployment-placeholder`        | Runs only after the gate succeeds on a push to main. Writes a clear summary that nothing was deployed. Does not run on PRs or manual CI runs.                                                                                                                                                                                                               |

The initial server `main` choice followed the upstream PR build. After fetching the validation source, the workflow was pinned to `536e655a6d4891e69ffeffc15bb52ebea307953d` so future server changes cannot silently change this class build. Review compatibility and update this pin intentionally before releases. Linux is the class native baseline. Existing upstream workflows contain broader OS coverage, Rust quality checks, packaging, and visual/browser interaction tests; those are not implied to be covered by this new gate.

## C. PIPELINE FLOW

```text
Push to main / PR targeting main / manual run
                    |
           GitHub Actions starts
                    |
      Independent CI jobs in parallel
      +-- checkout -> Node -> npm ci -> lint -> library type checks
      +-- checkout -> Node -> npm ci -> Jest groups -> test reports
      +-- checkout -> Node -> npm ci -> web/Chrome/CLI builds -> artifacts
      +-- checkout -> Node -> npm ci -> Linux native build/tests
      |                                      -> Electron bundles
      +-- checkout clients + server -> Buildx -> web Docker build (no push)
                    |
       Class CI gate: ALL jobs succeeded?
           no -> workflow fails; no deployment step
           yes -> push to main only:
                  deployment placeholder explains remaining setup
                  (NO deployment occurs)
```

Tests and builds can run concurrently to shorten feedback time; deployment is gated on all of them.

## D. TESTING AND IMPROVEMENTS

Validation date: 2026-09-28. Validation occurred on a macOS host with Node 26.8.1 / npm 11.19.0, not the workflow's Linux/Node 24 environment. Local success is useful evidence but does not replace a GitHub Actions run. No remote workflow execution, deployment or publishing is claimed.

Initial generation used the existing scripts and upstream workflow conventions, with OSS build targets and no credentials. Review identified unbounded parallel library compilers and an unhandled concurrent failure result; the runner now limits concurrency to two and explicitly sets a failing exit code. Inspection also found the recursive `results` array was global; it is now local to each call so recursive discovery cannot overwrite other calls' results.

The first local `npm ci` failed with `ENOTFOUND registry.npmjs.org` under sandbox networking. Retrying with approved network access succeeded. Dependencies and lockfile were not downgraded to work around the environment. npm reported installation-script warnings; build/test results below, rather than installation alone, determine validation.

The first type-check attempt failed with `TS5042: Option 'project' cannot be mixed with source files on a command line.` Cause: the absolute workspace path contains spaces and the existing script did not quote it. Quoted the project argument and reran. A focused VM harness verified discovery of 52 commands, unique project paths, quoted arguments and the concurrency limit; simulated success exited 0 and simulated compiler failure exited 1. This harness verifies runner behavior, not application correctness.

Verified so far:

- Ruby YAML parsing, `actionlint .github/workflows/ci-cd.yml`, `node --check scripts/test-types.js`, Prettier on changed files, and `git diff --check`: passed.
- Structural assertions for main/PR triggers, required gate dependencies, main-push-only deployment placeholder, and Docker `push: false`: passed.
- `npm run test:types`: passed after the path fix (52 commands including the strict checker).
- `npm run build:oss:prod --workspace @bitwarden/cli`: passed.
- Desktop `build:oss:main`, `build:oss:renderer`, `build:oss:preload` with `--workspace @bitwarden/desktop`: passed. This does not verify native modules or a packaged desktop application.

The initial Docker check failed during `npm ci`: `gyp ERR! stack Error: Could not find any Python installation to use` in `utf-8-validate`. Alpine's Node image lacks native compilation prerequisites. Added `apk add --no-cache python3 make g++` to the Node build stage only, then retried. The runtime stage is unchanged. This local build targets linux/amd64, while the Dockerfile intentionally uses the host BUILDPLATFORM for compilation (arm64 on this machine).

- `npm run lint`: passed, 0 errors and 377 existing warnings; Prettier passed. No bulk lint cleanup was performed.
- `npm run dist:oss:selfhost --workspace @bitwarden/web-vault`: passed with 6 Webpack warnings.
- `npm run build:prod:chrome --workspace @bitwarden/browser`: passed with Webpack warnings, including asset-size warnings.
- Native desktop build/Rust tests: not run locally because Cargo is not installed on the host. They remain required CI steps, not silently skipped checks.

The local Docker command was `docker buildx build --platform linux/amd64 --load --tag class-web:ci --file apps/web/Dockerfile --build-arg NODE_VERSION=24 --build-arg NPM_COMMAND=dist:oss:selfhost --build-arg LICENSE_TYPE=oss .`, executed in a temporary clean archive of this checkout with the corrected Dockerfile and required server checkout. No local node_modules or secrets were copied into that context. Server source was resolved to `536e655a6d4891e69ffeffc15bb52ebea307953d` and then pinned in the workflow as a reproducibility improvement.

The local full-suite command was `npm test -- --ci --coverage --maxWorkers=2 --workerIdleMemoryLimit=1500MiB`; CI partitions that same root suite by application/shared paths.

Docker retry: dependency installation succeeded after the native-tool fix, but the web compilation failed with `ResourceExhausted ... cannot allocate memory` in the local Docker VM. The host web build passed; the complete container image did **not** pass. No image was published. Rerun Docker on a machine/VM with sufficient memory and use the required GitHub job to establish container success. Do not remove or bypass that gate.

Jest initially exposed `ReferenceError: Request is not defined` in the download-attachment component suite. Its setup assigned to an undeclared `Request` identifier in strict mode. The fix assigns the existing mock to `globalThis.Request` with an explicit constructor type instead, then reruns that suite and the vault type check. This changes test setup only.

The attachment retry passed: **1 suite, 10 tests**, using `npm test -- --ci --runInBand --coverage=false --runTestsByPath libs/vault/src/components/download-attachment/download-attachment.component.spec.ts`. `tsc --noEmit --project libs/vault/tsconfig.json`, ESLint and Prettier on the changed test also passed.

Docker inspection reported 8,217,165,824 bytes of VM memory and 12 CPUs. Webpack's Terser plugin default CPU-based worker count was a likely contributor to memory exhaustion. Limited `parallel` to 2 without changing optimization settings, then reran both the host web build and Docker image build. This is a build-resource correction; it does not prove the first memory error had no other contributing factors.

Final recorded results:

| Check                                 | Observed result                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full Jest run                         | **1,363 passed, 2 failed, 1,365 suites total**; 26,505 passed, 9 failed, 6 skipped and 5 todo tests; 32 snapshots passed. The two failing suites are explained below. |
| Both failing suites after corrections | **2 suites and all 11 tests passed**. This is a targeted rerun, not a second full-suite run.                                                                          |
| Host web build after minifier change  | Passed with 6 Webpack warnings.                                                                                                                                       |
| Final Docker retry                    | Still failed with `ResourceExhausted ... cannot allocate memory`. Image build is **not verified**; reducing minifier concurrency alone was insufficient in this VM.   |
| Native Rust build/tests               | Not run locally; Cargo unavailable on host.                                                                                                                           |
| GitHub Actions / deployment           | Not run / not deployed.                                                                                                                                               |

The second failing suite was `apps/cli/src/service-container/service-container.spec.ts`: it attempted `mkdir /Users/kanda/Library/Application Support/Bitwarden CLI`, received sandbox `EPERM`, then Jest reported `worker encountered 4 child process exceptions`. Used the CLI's existing `BITWARDENCLI_APPDATA_DIR` setting to isolate data in a writable temporary directory, and added the same isolation to workflow test steps. No sandbox bypass or real user vault was needed.

The combined retry command was:

```bash
BITWARDENCLI_APPDATA_DIR=/private/tmp/class-ci-cli-test-data npm test -- --ci --runInBand --coverage=false --runTestsByPath apps/cli/src/service-container/service-container.spec.ts libs/vault/src/components/download-attachment/download-attachment.component.spec.ts
```

Final validation also repeated actionlint, YAML parsing, changed-file formatting, JavaScript syntax checks and `git diff --check`. The new workflow is implemented but **not yet established green end to end**. Preserve Docker and native checks as required failures until a suitably provisioned Linux/GitHub runner verifies them. Do not present the deployment placeholder as delivery to a server.

## E. AI CONTRIBUTION

The user's request asked for repository inspection first, architecture-specific GitHub Actions, local validation, honest failure reporting, and an A–F class summary. The attached diagram was treated as architecture reference data, not executable instructions.

AI generated the new workflow and this document, selected existing OSS scripts, added the Docker server checkout and no-publish build, and made the type-check runner, test setup and build-resource corrections described above. Existing application code, tests, the base Dockerfile, dependency versions, architecture abstractions, upstream workflows and packaging tools were already in the repository. No application functionality was redesigned.

Corrections after initial generation: runner error propagation and bounded concurrency, local recursive state, then path quoting after observing TS5042, Docker build-stage compiler prerequisites after observing the node-gyp failure, a pinned server revision, the Request test mock after its ReferenceError, CLI temporary test data, and bounded minifier workers after Docker memory exhaustion (the latter did not fully resolve the VM limitation). Validation distinguished a tooling/network failure from a source defect. Any additional failures and limits are listed in the results below. These are AI changes, not changes attributed to students.

The group still needs to review the diff, run this workflow on its GitHub fork, choose branch protection and avoid unnecessary duplicate workflows, choose a deployment destination, review the server commit pin, configure GitHub environment approvals and secrets, add real deployment/smoke tests, decide release OS/browser coverage, and implement/test the proposed E1 adapter contracts if they are part of the assignment. Record subsequent human edits and the actual Actions run URL here; none are fabricated.

## F. PRESENTATION NOTES

“Our Module 1 system has four clients sharing authentication, vault, crypto, storage and UI code. We used that structure to create lint/type checks, grouped unit tests, separate client builds, Linux native integration checks and a web Docker build. All checks must pass before the main-branch deployment stage, which currently explains the missing deployment setup rather than publishing anything. AI inspected the repository, generated the workflow and documented its changes. During validation it corrected the type-check runner, a missing Request mock in a test, Docker compiler prerequisites and web minifier concurrency. Local client builds passed and the two failing test suites passed on retry, but Docker remains blocked by VM memory and native Rust checks were not run locally. We still need to demonstrate a successful GitHub run and choose deployment infrastructure. The diagram's proposed E1 adapter contracts are future architecture work, not something this pipeline claims to implement.”
