# Data Recovery

The Data Recovery page (`/settings/data-recovery`) diagnoses, repairs, or removes account data that fails to
decrypt. Each check is a `RecoveryStep` in `steps/`. Steps run in order and share a
`RecoveryWorkingData` object, so later steps can use what earlier steps found:

1. `UserInfoStep`: user ID and user key
2. `SyncStep`: fetches items and folders from the server into the working data
3. `PrivateKeyStep`: the account's private key
4. `FolderStep`: folders
5. `CipherStep`: vault items; fills in `decryptedCiphers`
6. `AttachmentStep`: attachments of the items in `decryptedCiphers`

Repair runs each step's `runRecovery` in the same order. After a successful repair, diagnostics
run again.

## Which step owns which failure

| Failure                                                  | Owner            |
| -------------------------------------------------------- | ---------------- |
| An item's own data doesn't decrypt                       | `CipherStep`     |
| An attachment's file name, key or contents don't decrypt | `AttachmentStep` |

Each failure has exactly one owner, so a single Repair never acts on the same data twice. Repairing
single fields of an item (planned) must leave attachments to `AttachmentStep`.

## Why the login popup and this page can disagree

The vault decrypts an item in one of two ways:

- **List decryption** decrypts just enough to show the item in a list, including its attachment
  file names. The vault list and the decryption-failure popup at login use it.
- **Full decryption** decrypts the whole item. Data Recovery uses it. Attachments never make it
  fail: the SDK returns broken attachments separately, flagged with `hasDecryptionError`.

They react differently to a broken attachment. With the strict-decryption flag
(`pm-34500-strict-cipher-decryption`):

| What's broken        | Vault list and popup     | Data Recovery                            |
| -------------------- | ------------------------ | ---------------------------------------- |
| Attachment file name | **Item shows as failed** | Item decrypts; `AttachmentStep` re-saves |
| Attachment key       | Item shows normally      | Item decrypts; `AttachmentStep` deletes  |
| Attachment contents  | Item shows normally      | Item decrypts; `AttachmentStep` deletes  |

Without the flag, all three show normally in the vault list, and Data Recovery is unchanged.

So with the flag on, an item with a broken attachment file name appears in the popup but not
under `CipherStep`. That's expected: `AttachmentStep` repairs it, and afterwards the item shows
normally again. The user can't open the item to fix the attachment by hand, so Data Recovery is the
only way to clear it.

The flag also changes full decryption: an item with any broken field of its own (not an
attachment) fails as a whole instead of having that field blanked. `CipherStep` reports those
items, and `AttachmentStep` skips them.
