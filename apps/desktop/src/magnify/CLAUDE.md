# Magnify

Magnify is a lightweight, fast search window that runs as a **separate renderer process**
to the main desktop renderer. It shares the same Electron main process but has its own Angular app
and webpack build.

## Critical Rules

- **NEVER** use NgModule — all components must be standalone (`standalone: true`)
- Keep this app **lightweight**: avoid importing heavy `@bitwarden` libs or desktop
  app code that will pull in transitive dependencies

## NX Commands

Run using npx.

```bash
nx run desktop:build-magnify                         # production build → build/magnify/
nx run desktop:build-magnify --configuration=development
nx run desktop:serve-magnify                         # HMR dev server at http://localhost:4300
nx run desktop:test-magnify                          # jest, scoped to src/magnify/**
```

## Key Files

| File                                 | Purpose                                          |
| ------------------------------------ | ------------------------------------------------ |
| `src/magnify/main.ts`                | Angular standalone bootstrap                     |
| `src/magnify/global.d.ts`            | Ambient type declarations (magnify-only)         |
| `apps/desktop/tsconfig.magnify.json` | TypeScript config for this renderer              |
| `apps/desktop/webpack.magnify.js`    | Standalone webpack entry (dev server only)       |
| `apps/desktop/webpack.base.js`       | `buildMagnifyConfig` export used by the NX build |
