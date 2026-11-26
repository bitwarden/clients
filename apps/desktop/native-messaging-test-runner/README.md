# Native messaging test runner

> **Deprecated.** DuckDuckGo dropped support for the integration here
> https://github.com/duckduckgo/apple-browsers/pull/7877. We will drop support after a transition
> period.

Stands in for the DuckDuckGo browser: speaks the versioned native-messaging protocol to the desktop
app over stdio, through `desktop_proxy`.

```
runner ──stdio──▶ desktop_proxy ──IPC socket──▶ desktop main ──▶ renderer
```

Each command runs a handshake, then one request:

| Script              | Message                   |
| ------------------- | ------------------------- |
| `npm run handshake` | `bw-handshake`            |
| `npm run status`    | `bw-status`               |
| `npm run retrieve`  | `bw-credential-retrieval` |
| `npm run create`    | `bw-credential-create`    |
| `npm run update`    | `bw-credential-update`    |
| `npm run generate`  | `bw-generate-password`    |

The protocol it exercises has no other consumer. When the integration is removed, this package goes
with it.
