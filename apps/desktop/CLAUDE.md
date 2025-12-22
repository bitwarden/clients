# Desktop (Electron) - Critical Rules

- **CRITICAL**: Separate main process vs renderer process contexts
  - Main process: Node.js + Electron APIs (files in `/apps/desktop/src/main/`)
  - Renderer process: Browser-like environment (Angular app files)
  - Use IPC (Inter-Process Communication) for cross-process communication

- **NEVER** import Node.js modules directly in renderer process
- **NEVER** import Angular modules in the main process
  - Use preload scripts or IPC to access Node.js functionality
  - See `/apps/desktop/src/*/preload.ts` files for patterns
