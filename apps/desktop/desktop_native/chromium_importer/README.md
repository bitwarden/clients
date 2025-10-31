# Chromium Direct Importer

A rust library that allows you to directly import credentials from Chromium-based browsers.

## Windows ABE Architecture

On Windows chrome has additional protection measurements which needs to be circumvented in order to
get access to the passwords.

### Overview

The Windows **Application Bound Encryption (ABE)** subsystem consists of two main components that work together:

- **client library** — a library that is part of the desktop client application
- **bitwarden_chromium_import_helper.exe** — a password decryptor running as **ADMINISTRATOR** and later as **SYSTEM**

See the last section for a concise summary of the entire process.

### Goal

The goal of this subsystem is to decrypt the master encryption key used to encrypt login information on the local
Windows system. This applies to the most recent versions of Chrome, Brave, and (untested) Edge that use the ABE/v20
encryption scheme for some local profiles.

The general idea of this encryption scheme is as follows:

1. Chrome generates a unique random encryption key.
2. This key is first encrypted at the **user level** with a fixed key.
3. It is then encrypted at the **user level** again using the Windows **Data Protection API (DPAPI)**.
4. Finally, it is sent to a special service that encrypts it with DPAPI at the **system level**.

This triply encrypted key is stored in the `Local State` file.

The following sections describe how the key is decrypted at each level.

### 1. Client Library

This is a Rust module that is part of the Chromium importer. It compiles and runs only on Windows (see `abe.rs` and
`abe_config.rs`). Its main task is to launch `bitwarden_chromium_import_helper.exe` with elevated privileges, presenting
the user with the UAC prompt. See the `abe::decrypt_with_admin` call in `windows.rs`.

This function takes two arguments:

1. Absolute path to `bitwarden_chromium_import_helper.exe`
2. Base64 string of the ABE key extracted from the browser's local state

First, `bitwarden_chromium_import_helper.exe` is launched by calling a variant of `ShellExecute` with the `runas` verb.
This displays the UAC screen. If the user accepts, `bitwarden_chromium_import_helper.exe` starts with **ADMINISTRATOR**
privileges.

> **The user must approve the UAC prompt or the process is aborted.**

Because it is not possible to read the standard output of an application launched in this way, a named pipe server is
created at the user level before `bitwarden_chromium_import_helper.exe` is launched. This pipe is used to send the
decryption result from `bitwarden_chromium_import_helper.exe` back to the client.

The data to be decrypted are passed via the command line to `bitwarden_chromium_import_helper.exe` like this:

```bat
bitwarden_chromium_import_helper.exe --encrypted "QVBQQgEAAADQjJ3fARXREYx6AMBPwpfrAQAAA..."
```

### 2. Admin Executable

Although the process starts with **ADMINISTRATOR** privileges, its ultimate goal is to elevate to **SYSTEM**. To achieve
this, it uses a technique to impersonate a system-level process.

First, `bitwarden_chromium_import_helper.exe` ensures that the `SE_DEBUG_PRIVILEGE` privilege is enabled by calling
`RtlAdjustPrivilege`. This allows it to enumerate running system-level processes.

Next, it finds an instance of `services.exe` or `winlogon.exe`, which are known to run at the **SYSTEM** level. Once a
system process is found, its token is duplicated by calling `DuplicateToken`.

With the duplicated token, `ImpersonateLoggedOnUser` is called to impersonate a system-level process.

> **At this point `bitwarden_chromium_import_helper.exe` is running as SYSTEM.**

The received encryption key can now be decrypted using DPAPI at the system level.

The decrypted result is sent back to the client via the named pipe. `bitwarden_chromium_import_helper.exe` connects to
the pipe and writes the result.

The response can indicate success or failure:

- On success: a Base64-encoded string.
- On failure: an error message prefixed with `!`.

In either case, the response is sent to the named pipe server created by the client. The client responds with `ok`
(ignored).

Finally, `bitwarden_chromium_import_helper.exe` exits.

### 3. Back to the Client Library

The decrypted Base64-encoded string is returned from `bitwarden_chromium_import_helper.exe` to the named pipe server at
the user level. At this point it has been decrypted only once—at the system level.

Next, the string is decrypted at the **user level** with DPAPI.

Finally, for Google Chrome (but not Brave), it is decrypted again with a hard-coded key found in `elevation_service.exe`
from the Chrome installation. Based on the version of the encrypted string (encoded within the string itself), this step
uses either **AES-256-GCM** or **ChaCha20-Poly1305**. See `windows.rs` for details.

After these steps, the master key is available and can be used to decrypt the password information stored in the
browser’s local database.

### TL;DR Steps

1. **Client side:**

    1. Extract the encrypted key from Chrome’s settings.
    2. Create a named pipe server.
    3. Launch `bitwarden_chromium_import_helper.exe` with **ADMINISTRATOR** privileges, passing the key to be decrypted
       via CLI arguments.
    4. Wait for the response from `bitwarden_chromium_import_helper.exe`.

2. **Admin side:**

    1. Start.
    2. Ensure `SE_DEBUG_PRIVILEGE` is enabled (not strictly necessary in tests).
    3. Impersonate a system process such as `services.exe` or `winlogon.exe`.
    4. Decrypt the key using DPAPI at the **SYSTEM** level.
    5. Send the result or error back via the named pipe.
    6. Exit.

3. **Back on the client side:**
    1. Receive the encryption key.
    2. Shutdown the pipe server.
    3. Decrypt it with DPAPI at the **USER** level.
    4. (For Chrome only) Decrypt again with the hard-coded key.
    5. Obtain the fully decrypted master key.
    6. Use the master key to read and decrypt stored passwords from Chrome, Brave, Edge, etc.
