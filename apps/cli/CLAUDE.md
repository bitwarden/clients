# CLI - Critical Rules

- **ALWAYS** output structured JSON when `process.env.BW_RESPONSE === "true"`
  - Use Response objects (MessageResponse, ListResponse, etc.) from `/apps/cli/src/models/response/`
  - DON'T write free-form text that breaks JSON parsing

- **NEVER** use `console.log()` for output
  - Use `CliUtils.writeLn()` to respect `BW_QUIET` and `BW_RESPONSE` environment variables

- **ALWAYS** respect `BW_CLEANEXIT` environment variable
  - Exit code 0 even on errors when `BW_CLEANEXIT` is set
  - Required for scripting environments that need clean exits

## Development Commands

- `npm run build:bit:watch` - Bitwarden-branded CLI with watch mode
- `npm run build:oss:debug` - OSS/community edition debug build
- `npm run test` - Run Jest tests
- `npm run lint` / `npm run lint:fix` - Lint code

**IMPORTANT**: Use `build:bit:*` for Bitwarden-branded builds, `build:oss:*` for community
