## Keeper JSON importer

### Conversions

The record types in the following Mappings section are supported by the current version of Keeper (as of this writing). Since we don't have access to older, legacy Keeper vaults, the importer will focus on supporting the current vault record types.

#### Mappings

The Keeper record type appears on the left, while the item it's converted to appears to the right of the arrow.

- [x] address -> `SecureNote`
- [x] bankAccount -> `Login` or `SecureNote`
- [x] bankCard -> `Card`
- [x] birthCertificate -> `SecureNote`
- [x] contact -> `SecureNote`
- [x] databaseCredentials -> `Login`
- [x] driverLicense -> `Identity`
- [x] encryptedNotes -> `SecureNote`
- [x] file -> `SecureNote`
- [x] general -> `Login`
- [x] healthInsurance -> `Login`
- [x] login -> `Login`
- [x] membership -> `Login`
- [x] passport -> `Identity`
- [x] photo -> `SecureNote`
- [x] serverCredentials -> `Login`
- [x] softwareLicense -> `SecureNote`
- [x] sshKeys -> `SshKey`
- [x] ssnCard -> `Identity`
- [x] wifiCredentials -> `Login`

#### Process

By default all records are converted to `Login`. If there is no login information on the entry, they are automatically converted to a `SecureNote` by the base importer. Additionally, some types are force-converted: `bankCard` → `Card`, `driverLicense`/`ssnCard`/`passport` → `Identity`, and
`sshKeys` → `SshKey` (falling back to `SecureNote` if the key is invalid).

### Gotchas, weirdnesses and questions

- [x] Do we disregard the IDs? Yes. The `uid` is only used internally to resolve references between records and is not assigned to the imported cipher.
- [x] Multiple TOTP (currently the first one used, others ignored)
- [x] Schema field is ignored. It declares the expected custom fields and their display order for a record type, but since all populated fields already appear in `custom_fields`, the only things lost are field ordering and empty fields — neither of which is useful for import.
- [x] Custom fields names/types are not parsed and used as-is
- [ ] Should `last_modified` be set on the cipher? It exists in the export and could map to
      `revisionDate` on `CipherView`, but is currently ignored.
- [x] The base importer has a special way of handling custom fields, not used in this importer. A custom implementation was built instead.
- [x] No fingerprint on ssh keys
- [x] login/password on ssh keys are stored as username/passphrase extra fields
- [x] Custom fields have a format like `$keyPair::1` — a `$type:name` prefix with an optional numeric suffix. The suffix is stripped and the type/name are decoded by `parseFieldKey`.
- [x] Legacy exports are similar but not exactly the same. Need to support variants.
- [x] When importing dates, should a specific locale be used in `toLocaleString`? No — the user's system locale and timezone are used intentionally.
- [ ] Phone number format is a bit funky: `(AF) 5415558723 ext. 5577 (Work)`. Would be good to replace the region with +code.
- [x] An invalid ssh key should be added as a secure note
- [x] Some items could be both arrays and single objects
- [ ] Some single/repeated items might get a generic name instead of the label in the vault

### Missing features

- [x] Shared folders
- [-] File attachments (not supported)
- [x] PAM record types
- [x] Some more enterprise record types
- [x] Custom record types
- [x] Referenced fields
