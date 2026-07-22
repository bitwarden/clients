# Bitwarden SSH Agent

The SSH Agent feature is a Desktop client feature that acts as a drop in replacement for native SSH Agents, and utilizes the Vault for the secure and encrypted storage of SSH keys.

# Functionality

The agent currently supports the following high level functionalities:

- Listing keys (`ssh-add -L`, to display the public key and it’s name)
- Request signing (used when signing files, git commits, authenticating with a remote host)
- Agent forwarding (`ssh -A`, allowing a remote host you’ve authenticated with to use your keys)
- Supported key types:
    - Ed25519
    - RSA SHA-256 and SHA-512
    - ECDSA

# Architecture

```mermaid
  flowchart TB
      subgraph Electron
          RenderSvc[Render SSH Agent svc]
          MainSvc[Main SSH Agent svc]
          RenderSvc <-->|Electron IPC| MainSvc
      end

      subgraph DesktopNative[Desktop Native]
          direction TB
          subgraph Napi
              ApprovalRequester[Electron Approval Requester]
              AgentState[SSH Agent State]
          end
          BitwardenSSHAgent[BitwardenSSHAgent]
          Napi ~~~ BitwardenSSHAgent
          BitwardenSSHAgent -.->|has a| ApprovalRequester
          AgentState -.->|has a| BitwardenSSHAgent
      end

      MainSvc <-->|Node-API| ApprovalRequester
      MainSvc -.->|has a| AgentState
```

Bitwarden’s SSH Agent is primarily implemented in the Rust language, as a server that accepts ssh
client connections over the SSH Agent protocol. This server interfaces with the Desktop UI through
napi bindings and the Electron services.

Our agent is unique from native OS ones in that:

- true storage of keys is on a (remote) server which individual Desktop clients interface with
- users of the agent manage keys with a UI
- users of the agent (optionally) approve requests with a UI

---

## End to end data flow

```mermaid
  flowchart TB
      BW((BW Server))
      Client[SSH Client]
      User((User))

      subgraph BWD[Bitwarden Desktop]
          Agent[SSH Agent]
          Electron[Electron app]
      end

      BW -.->|network| Electron
      Client <-.->|network| Agent
      Agent <--> Electron
      Electron <-.->|reality| User
```

When the user enables the SSH Agent feature in user settings, the SSH key vault items are retrieved
from the vault and sent to the agent. The agent server is started and its keystore populated with
the new keys.

The Bitwarden SSH Agent server spawns a thread to handle each new client connection. Each
connection results in an async callback chain.

The Electron app replaces the keys in the agent’s keystore when there are vault changes to SSH key
items.

---

## The SSH Agent

```mermaid
  flowchart LR

      subgraph crypto
          PubKey[PublicKey]
          PrivKey[PrivateKey]
      end

      BWAgent{Bitwarden SSH Agent}

      subgraph approval
          ApprovalTrait{{ApprovalRequester Trait}}
      end

      subgraph storage
          KeyStore[InMemoryEncryptedKeyStore]
          KeyStoreTrait{{KeyStore Trait}}
      end

      subgraph auth
          BWAuthPolicy[BitwardenAuthPolicy]
      end

      subgraph server
          SSHServer[SSH Agent Server]
          Listener[Listener]
          Connection[Connection]
          AuthPolicyTrait{{AuthPolicy Trait}}
      end

      BWAgent -->|owns| KeyStore
      BWAgent -->|owns| BWAuthPolicy
      BWAgent -->|owns| SSHServer

      crypto -.-> storage
      approval -.-> auth
      storage -.-> server
      auth -.-> server
```

The core agent implementation itself is part of the Rust Desktop Native layer in the Desktop client.
It is an almost entirely self-contained workspace crate within desktop_native.

The architecture of the agent was designed with these goals:

- efficient adherence to the SSH agent protocol spec
- clean interfaces isolating the server protocol, Bitwarden’s business logic, and user interface
- maintainability
- testability

### Modules

#### server

Low level agent protocol implementation. It is responsible for listening for and managing new
connections (clients), handling requests from connections and returning responses.

#### crypto

Cryptographic primitive type definitions for public and private key types that we support and
handling of the signing of requests and any key-based operation.

#### storage

Logic that handles the storage and management of data that the agent uses, effectively the SSH keys.
Currently our implementation of a key store is in-memory.

#### authorization

Defines the concrete policy which our agent enforces for authorization of requests. The
authorization of requests is requested by the server.

#### approval

Interface for our agent to get approval for requests via an external entity (in our present case,
Electron).

#### agent

The agent crate itself is the orchestrator of all the above components. It starts and stops the
server, updates the storage of keys, enforces the authorization policy, and interfaces with the
external approver of requests.

## Abstractions

There are two critical abstractions to understand about the agent implementation. These abstractions
both serve two purposes:

1. Low coupling ; high cohesion

2. Testability

### AuthPolicy

The server requests authorization for requests that it receives from client connections.

The server does not need to know about the business logic that goes into whether a request is
authorized.

This interface provides an abstraction from the raw server and the agent’s business logic.

```rust
pub trait AuthPolicy: Send + Sync {
    async fn authorize(&self, request: &AuthRequest) -> Result<bool, AuthError>;
}
```

### ApprovalRequester

The agent requests approval from an external entity, when needed based on its authorization policy.

The agent does not need to know about the logic or complexities of the external entity that it
requests approvals through.

```rust
 pub trait ApprovalRequester: Send + Sync {
    async fn request_sign_approval(
        &self,
        request: SignApprovalRequest,
    ) -> Result<bool, ApprovalError>;

    async fn request_list_approval(&self) -> Result<bool, ApprovalError>;
}
```

---

## Napi bindings

The `sshagent_v2` module contains the definitions for the napi bindings which act as the bridge
between the Rust implementation of the agent, and the Electron UI.

This layer is intentionally a pass-through. There is no unique logic. A wrapper around the agent is
provided to expose it to Electron.

The ElectronApprovalRequester is our concrete implementation of the ApprovalRequester trait. It
simply provides a mechanism to wire-up the async callbacks that we use in the Electron services to
answer the approval requests that are cascaded up from the server.

---

## Electron services

### Main service

The Main SSH Agent service is primarily a pass-through for exchanging request/response calls between
Render and agent.

It maintains a request ID counter and stores the pending requests keyed by that ID.

### Render service

The Render SSH Agent service is the primary business logic that interfaces between the vault data,
the user interactions, and the downstream agent.

It has the following responsibilities:

- subscribes to changes in the user setting for enabling the ssh agent feature, and correspondingly
  starts/stops the agent.
- receives the vault ssh key items when any ssh key item is changed, and updates the agent with the
  new key data.
- subscribes to active account changes, and either updates the key data or stops the server
  depending on the new account’s state.
- receives authorization requests via the main service, and depending on the user’s setting for
  authorization requests, may prompt the user to authorize the request, or grant it based on cached
  approval, or automatically approve if authorizations aren’t configured.

---

## Vault lock state behavior

The agent behaves differently when in the various [vault states](https://contributing.bitwarden.com/architecture/deep-dives/lock-states/). For
simplicity, assume only one account is active on the client and that the feature is enabled in user
settings.

### Logged out

The agent is not running.

### Locked Before First Unlock (BFU)

The agent is running. All requests result in a toast prompt to unlock the vault.

### Locked After First Unlock (AFU)

The agent is running. List requests are supported. Sign requests are supported- if authorization is
required based on user setting, user is prompted to unlock their vault first, then prompted to
approve the request.

### Unlocked

The agent is running, all functionality supported.
