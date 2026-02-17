## Direct Keeper importer

### Device approval

- [x] Email link click
- [x] Email code
- [x] Keeper push
- [ ] Keeper DNA

### 2FA

- [x] SMS
- [x] TOTP
- [-] Duo
- [-] WebAuthn
- [ ] Keeper DNA
- [ ] RSA?

### TODO

- [ ] Empty folders might be ignored because they are added from items. Empty folders get lost
      during Vault conversion. Is that a problem?
- [ ] Is `includeSharedFolders` flag support needed?
- [ ] Can item be in more than one folder in Bitwarden?
- [ ] Legacy RecordV2 format is not supported. No test data available.
- [ ] Test custom fields with names ending in `Ref`. See if they get ignored. Explore record links.
- [ ] When the import is done and successful, there's still an error message popping up.
