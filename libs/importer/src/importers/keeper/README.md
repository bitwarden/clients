## Keeper JSON importer

### Conversions

Currently these record types are supported by the current version of Keeper. It's not very clear
what could be in the legacy vaults and there's no way to test that, unless there old vaults to be
tested on.

By default all the records are converted to `Login` and then they might automatically convert to a
`SecureNote` by the base importer if there is no login information on the entry. Possibly we want to
handle some of the type conversion manually. Should the conversion types be forced?

- [ ] address -> `Identity`?
- [ ] bankAccount
- [ ] bankCard
- [ ] birthCertificate -> `Identity`?
- [ ] contact
- [ ] databaseCredentials
- [ ] driverLicense -> `Identity`?
- [ ] encryptedNotes
- [ ] file
- [ ] general
- [ ] healthInsurance
- [x] login -> `Login`
- [ ] membership
- [ ] passport
- [ ] photo
- [ ] serverCredentials
- [ ] softwareLicense
- [x] sshKeys -> `SshKey`
- [ ] ssnCard
- [ ] wifiCredentials

### Gotchas, weirdnesses and questions

- [ ] What to do with the IDs? Import them as is? Generate new ones? Leave out blank?
- [ ] Multiple TOTP (currently the first one used, others ignored)
- [ ] Schema is ignored (probably no use anyway)
- [ ] Custom fields names/types are not parsed and used as is
- [ ] Should `last_modified` be set on the cipher?
- [ ] The base importer has a special way of handling custom fields, not used in this importer.
      Figure this out!
- [ ] No fingerprint on ssh keys
- [ ] login/password on ssh keys are stored as username/passphrase extra fields

### Missing features

- [x] Shared folders
- [ ] File attachments
- [ ] PAM record types
- [ ] Some more enterprise record types
- [ ] Custom record types
