# Desktop (Electron) - Critical Rules

- **CRITICAL**: Separate main process vs renderer process contexts
  - Main process: Node.js + Electron APIs (files in `/apps/desktop/src/main/`)
  - Renderer process: Browser-like environment (Angular app files)
  - Use IPC (Inter-Process Communication) for cross-process communication

- **NEVER** import Node.js modules directly in renderer process
  - Use preload scripts or IPC to access Node.js functionality
  - See `/apps/desktop/src/*/preload.ts` files for patterns

## Angular Patterns

- **ALWAYS** use Observable Data Services (ADR-0003)
  - Components use `async` pipe for subscriptions
  - If explicit subscription needed, use `takeUntilDestroyed()`

- **NEVER** create TypeScript enums (ADR-0025)
  - Use `Object.freeze({ Key: value } as const)` pattern

## Development Commands

- `npm run build:electron` - Build Electron desktop app
- `npm run start:electron` - Start desktop app in development mode
- `npm run test` - Run Jest tests
- `npm run lint` / `npm run lint:fix` - Lint code
