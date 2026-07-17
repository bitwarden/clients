# biometric

Biometric vault unlock for the Bitwarden desktop native layer. A platform implementation protects a
user key and releases it only after the user authenticates with the OS biometric prompt (Windows
Hello today; Linux via polkit).

## Security note

The security goal is that a *locked, running* app cannot be unlocked while the device's userspace is
compromised.
