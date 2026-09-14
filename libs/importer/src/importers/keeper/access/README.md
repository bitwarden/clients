## Direct Keeper importer

### For reviewers

Most of the diff is local to `libs/importer/src/importers/keeper/`. The points below cover the
non-obvious changes outside that directory.

1. **`keepercsv` / `keeperjson` are gone from the web dropdown.** There's just one `keeper`
   entry now, with a small dropdown next to it to pick the method (direct / CSV / JSON). The
   old IDs still exist in the code, so `bw import keepercsv` and `bw import keeperjson` keep
   working as before. The CLI also accepts `keeper` and picks CSV or JSON based on the file
   extension. The direct flow only runs in the web app and the extension, not in the CLI.

2. **The `/import` route now opens as a popout in the extension on all platforms.** Before,
   Windows kept it inside the popup; now it matches macOS and Linux. The direct flow runs a
   websocket and a bunch of listeners that the popup would tear down whenever you click away.
   This applies to all import formats, not just Keeper.

### Device approval

- [x] Email link click
- [x] Email code
- [x] Keeper push
- [x] Keeper DNA

### 2FA

- [x] SMS
- [x] TOTP
- [x] Duo/Push
- [x] Duo/Passcode
- [x] Duo/SMS
- [x] Duo/Voice
- [-] WebAuthn
- [x] Keeper DNA Push
- [x] Keeper DNA Code
- [ ] RSA?
- [x] Backup code

### TODO

- [ ] Empty folders might be ignored because they are added from items. Empty folders get lost
      during Vault conversion. Is that a problem?
- [ ] Is `includeSharedFolders` flag support needed?
- [ ] Can item be in more than one folder in Bitwarden?
- [ ] Legacy RecordV2 format is not supported. No test data available.
- [ ] Test custom fields with names ending in `Ref`. See if they get ignored. Explore record links.
- [x] When the import is done and successful, there's still an error message popping up.
- [x] What if there's 2FA but only the unsupported kind? Test.
- [ ] Verify that the error strings exist and map to the actual errors in
      `getValidationErrorI18nKey` in `libs/importer/src/components/keeper/import-keeper.component.ts`.
