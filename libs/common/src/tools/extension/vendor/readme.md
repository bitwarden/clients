# Vendors

This folder contains vendor-specific logic that extends the
Bitwarden password manager.

## Vendor IDs

A vendor's ID is used to identify and trace the code provided by
a vendor across Bitwarden. There are a few rules that vendor ids
must follow:

1. They should be human-readable. (No UUIDs.)
2. They may only contain lowercase ASCII characters and numbers.
3. They must retain backwards compatibility with prior versions.

As such, any given ID may not not match the vendor's present
brand identity. Said branding may be stored in `VendorMetadata.name`.

## Core files

There are 4 vendor-independent files in this directory.

- `data.ts` - core metadata used for system initialization
- `index.ts` - exports vendor metadata
- `README.md` - this file

## Vendor definitions

Each vendor should have one and only one definition, whose name
MUST match their `VendorId`. The vendor is free to use either a
single file (e.g. `bitwarden.ts`) or a folder containing multiple
files (e.g. `bitwarden/extension.ts`, `bitwarden/forwarder.ts`) to
host their files.
