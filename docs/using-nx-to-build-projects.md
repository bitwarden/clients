# Using Nx to Build Projects

Bitwarden uses [Nx](https://nx.dev/) to make building projects from the monorepo easier. To build, lint, or test a project you'll want to reference the project's `project.json` file for availible commands and their names. Then you'll run `npx nx [your_command] [your_project] [your_options]`. Run `npx nx --help` to see availible options, there are many.

Please note: the Nx implementation is a work in progress. Not all apps support Nx yet, CI still uses the old npm builds, and we have many "legacy" libraries that use hacks to get them into the Nx project graph.

## Quick Start

### Basic Commands

```bash
# Build a project
npx nx build cli
npx nx build state # Modern libs and apps have simple, all lowercase target names
npx nx build @bitwarden/common # Legacy libs have a special naming convention and include the @bitwarden prefix

# Test a project
npx nx test cli

# Lint a project
npx nx lint cli

# Serve/watch a project (for projects with serve targets)
npx nx serve cli

# Build all projects that differ from origin/main
nx affected --target=build --base=origin/main

# Build, lint, and test every project at once
npx nx run-many --target=build,test,lint --all

# Most projects default to the "oss-dev" build, so if you need the bitwarden license build add a --configuration
npx nx build cli --configuration=commercial-dev

# If you need a production build drop the "dev" suffix
npx nx build cli --configuration=oss # or "commercial"

# Configurations can also be passed to run-many
# For example: to run all Bitwarden licensed builds
npx nx run-many --target=build,test,lint --all --configuration=commercial

# Outputs are distrubuted in a root level /dist/ folder

# Run a locally built CLI
node dist/apps/cli/oss-dev/bw.js
```

### Global Commands

```bash
# See all projects
npx nx show projects

# Run affected projects only (great for local dev and CI)
npx nx affected:build
npx nx affected:test
npx nx affected:lint

# Show dependency graph
npx nx dep-graph
```

## Library Projects

Our libraries use two different Nx integration patterns depending on their migration status.

### Legacy Libraries

Most existing libraries use a facade pattern where `project.json` delegates to existing npm scripts. This approach maintains backward compatibility with the build methods we used before introducing Nx. These libraries are considered tech debt and Platform has a focus on updating them. For an example reference `libs/common/project.json`.

These libraries use `nx:run-script` executor to call existing npm scripts:

```json
{
  "targets": {
    "build": {
      "executor": "nx:run-script",
      "options": {
        "script": "build"
      }
    }
  }
}
```

#### Available Commands for Legacy Libraries

All legacy libraries support these standardized commands:

- **`nx build <library>`** - Build the library
- **`nx build:watch <library>`** - Build and watch for changes
- **`nx clean <library>`** - Clean build artifacts
- **`nx test <library>`** - Run tests
- **`nx lint <library>`** - Run linting

### Modern Libraries

Newer libraries like `libs/state` use native Nx executors for better performance and caching.

```json
{
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/state"
      }
    }
  }
}
```

## What Happens When You Run An Nx Command

```mermaid
flowchart TD
    Start([You just ran an nx command]) --> ParseCmd[Nx parses command args]
    ParseCmd --> ReadWorkspace[Nx reads nx.json, workspace configuration, cache settings, and plugins]
    ReadWorkspace --> ReadProject[Nx reads project.json, finds the target configuration, and checks executor to use]
    ReadProject --> CheckCache{Nx checks the cache: has this exact build been done before?}

    CheckCache -->|Cache hit| UseCached[Nx uses cached outputs, copies from .nx/cache, and skips execution]
    UseCached --> Done([Your command is done])

    CheckCache -->|Cache miss| DetermineExecutor{Which executor is configured?}

    DetermineExecutor -->|nx:run-script| FacadePattern[Legacy Facade Pattern]
    DetermineExecutor -->|nx/webpack:webpack| WebpackExecutor[Webpack Executor]
    DetermineExecutor -->|nx/js:tsc| TypeScriptExecutor[TypeScript Executor]
    DetermineExecutor -->|nx/jest:jest| JestExecutor[Jest Executor]
    DetermineExecutor -->|nx/eslint:lint| ESLintExecutor[ESLint Executor]

    %% Facade Pattern Flow
    FacadePattern --> ReadPackageJson[The run-script executor finds npm script to run in package.json]
    ReadPackageJson --> RunNpmScript[Npm script is executed]
    RunNpmScript --> NpmDelegates{What does the npm script do?}

    NpmDelegates -->|TypeScript| TSCompile[TypeScript compiles to JavaScript using tsconfig.json]
    NpmDelegates -->|Webpack| WebpackBuild[Webpack bundles and optimizes code]
    NpmDelegates -->|Jest| JestTest[Jest executes unit tests]

    TSCompile --> FacadeOutput[Outputs written to libs/LIB/dist/]
    WebpackBuild --> FacadeOutput
    JestTest --> FacadeOutput
    FacadeOutput --> CacheResults1[Nx caches results in .nx/cache/]

    %% Webpack Executor Flow
    WebpackExecutor --> ReadWebpackConfig[Webpack config read from apps/cli/webpack.config.js or bit-cli/webpack.config.js]
    ReadWebpackConfig --> ConfigureWebpack[Webpack configured with entry points, TypeScript paths, and plugins]
    ConfigureWebpack --> WebpackProcess[Webpack resolves paths, compiles TypeScript, bundles dependencies, and applies optimizations]
    WebpackProcess --> WebpackOutput[Single executable bundle written to dist/apps/cli/]
    WebpackOutput --> CacheResults2[Nx caches results in .nx/cache/]

    %% TypeScript Executor Flow
    TypeScriptExecutor --> ReadTSConfig[TypeScript reads tsconfig.lib.json compilation options]
    ReadTSConfig --> TSProcess[TypeScript performs type checking, emits declarations, and compiles to JavaScript]
    TSProcess --> TSOutput[Outputs written to dist/libs/LIB/]
    TSOutput --> CacheResults3[Nx caches results in .nx/cache/]

    %% Jest Executor Flow
    JestExecutor --> ReadJestConfig[Jest reads jest.config.js test configuration]
    ReadJestConfig --> JestProcess[Jest finds test files, runs suites, and generates coverage]
    JestProcess --> JestOutput[Test results and coverage reports output]
    JestOutput --> CacheResults4[Nx caches results in .nx/cache/]

    %% ESLint Executor Flow
    ESLintExecutor --> ReadESLintConfig[ESLint reads .eslintrc.json rules and configuration]
    ReadESLintConfig --> ESLintProcess[ESLint checks code style, finds issues, and applies auto-fixes]
    ESLintProcess --> ESLintOutput[Lint results with errors and warnings output]
    ESLintOutput --> CacheResults5[Nx caches results in .nx/cache/]

    %% All paths converge
    CacheResults1 --> UpdateGraph[Dependency graph updated to track project relationships]
    CacheResults2 --> UpdateGraph
    CacheResults3 --> UpdateGraph
    CacheResults4 --> UpdateGraph
    CacheResults5 --> UpdateGraph

    UpdateGraph --> Done
```

## Caching and Performance

### Nx Caching

Nx automatically caches build outputs and only rebuilds what changed:

```bash
# First run builds everything
npx nx build cli

# Second run uses cache (much faster)
npx nx build cli
```

### Clearing Cache

```bash
# Clear all caches
npx nx reset
```

## Additional Resources

- [Nx Documentation](https://nx.dev/getting-started/intro)
- [Nx CLI Reference](https://nx.dev/packages/nx/documents/cli)
- [Nx Workspace Configuration](https://nx.dev/reference/project-configuration)
