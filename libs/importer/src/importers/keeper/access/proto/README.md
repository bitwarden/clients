# Keeper Protobuf Definitions

These `.proto` files define the Keeper API message types. The generated TypeScript files
are committed directly in `../generated/` and do not need to be regenerated during normal
development.

## Regenerating TypeScript from Proto Files

If the proto definitions change, regenerate the TypeScript files:

```bash
cd libs/importer
npx -p @protobuf-ts/protoc -p @protobuf-ts/plugin protoc --ts_opt ts_nocheck,eslint_disable --ts_out src/importers/keeper/access/generated --proto_path src/importers/keeper/access/proto src/importers/keeper/access/proto/*.proto
```

Commit the updated generated files after regeneration. Run prettier on them before committing.
