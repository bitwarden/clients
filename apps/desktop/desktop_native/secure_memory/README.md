# secure_memory

This crate provides a hardened in-memory secret store that protects against user-space memory
dumping attacks.

Values placed in a store are kept encrypted in process memory: the plaintext is encrypted
with AES-256-GCM under a per-process key, and that key is itself protected by a per-platform mechanism.
This keeps secrets out of memory dumps, swap, and debugger reads.

## Key-protection backends

The key-store key is protected by the following backends:

- **Windows** — DPAPI (`CryptProtectMemory`).
- **Linux** — the kernel keyring (`keyctl`), or `memfd_secret` where available.
- **Fallback** — `mlock`ed, non-swappable allocation.

## Security note

This is defense-in-depth for a *running, locked* app: it raises the bar against userspace memory
inspection, but does not defend against a compromised kernel or administrator.