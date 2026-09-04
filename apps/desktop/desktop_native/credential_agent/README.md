# Bitwarden Credential Agent

Lets a local program ask the running Bitwarden desktop app for a login credential over IPC,
subject to the user's configured approval policy. It is the login-credential counterpart to
the SSH agent: same transport shape and approval model, but it returns
username/password/TOTP instead of performing a signature.

The companion client is the `credential_client` crate.

# Architecture

```text
credential_client ──[unix socket / named pipe]──▶ credential_agent (Rust)
                                                          │ napi callback
                                                          ▼
                                     MainCredentialAgentService (Electron main)
                                                          │ message
                                                          ▼
                                     CredentialAgentService (Angular renderer)
                                                  ├─ unlock, if locked
                                                  ├─ approval prompt, per setting
                                                  └─ vault lookup
```

The agent holds no vault data. Every request is resolved by a `CredentialProvider`, which
Electron implements over napi; approval and lookup both happen on the Electron side.

# Transport

- Unix: `$HOME/.bitwarden-credential-agent.sock`, mode `0600`. Override with
  `BITWARDEN_CREDENTIAL_SOCK`.
- Windows: the named pipe `\\.\pipe\bitwarden-credential-agent`.

# Protocol

Newline-delimited JSON. A client writes exactly one request line and reads exactly one
response line; the agent then closes the connection. One exchange per connection keeps the
lifetime of an approval unambiguous — an approved connection cannot be reused to ask for a
second, unapproved credential.

Request — `uri`, `name`, or both. When both are given the item must match both.

```json
{ "version": 1, "action": "getCredential", "uri": "https://github.com" }
```

Response — one of:

```json
{ "status": "ok", "credential": { "cipherId": "…", "name": "GitHub", "username": "…", "password": "…", "totp": null } }
{ "status": "denied" }
{ "status": "notFound" }
{ "status": "error", "message": "…" }
```

# Approval

The desktop setting **Credential agent approval** decides when the user is prompted:

| Setting               | Behavior                                                       |
| --------------------- | -------------------------------------------------------------- |
| Always ask            | Prompt on every request.                                        |
| Never ask             | Serve without prompting.                                        |
| Remember until lock   | Prompt once per vault item; forgotten on lock or account switch. |

A locked vault does not fail the request: the app asks the user to unlock and serves the
request once they do, or refuses it after a timeout.

# Usage

```console
$ credential_client --uri https://github.com
{"cipherId":"…","name":"GitHub","username":"me","password":"…","totp":null}

$ credential_client --name GitHub --field password
…
```

Exit codes: `0` granted, `2` denied, `3` not found, `4` error.
