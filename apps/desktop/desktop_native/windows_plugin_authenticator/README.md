# windows-plugin-authenticator

This is an internal crate that's meant to be a safe abstraction layer over the generated Rust bindings for the Windows WebAuthn Plugin Authenticator API's.

You can find more information about the Windows WebAuthn API's [here](https://github.com/microsoft/webauthn).

## Building

To build this crate, set the following environment variables:

- `LIBCLANG_PATH` -> the path to the `bin` directory of your LLVM install ([more info](https://rust-lang.github.io/rust-bindgen/requirements.html?highlight=libclang_path#installing-clang))

### Bash Example

```
export LIBCLANG_PATH='C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\Llvm\x64\bin'
```

### PowerShell Example

```
$env:LIBCLANG_PATH = 'C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\Llvm\x64\bin'
```
