//! Bitwarden SSH Agent implementation.
//!
//! Adheres to the protocol defined in the IETF spec:
//! <https://datatracker.ietf.org/doc/draft-ietf-sshm-ssh-agent/>
//!
//! # Architecture:
//! - `crypto` provides the raw cryptographic primitive objects and operations for supported SSH
//!   keys.
//! - `storage` provides data structures that bridge the primitive key types to Bitwarden's business
//!   logic, namely the concept of vault items. As well as  the implementations of the objects to
//!   manage and store the keys used in the agent's runtime.
//! - `server` provides the low-level implementation of the Server protocol. It uses an
//!   implementation of an `AuthPolicy` to get authorization for the various agent operations that
//!   are received by connections.
//! - `authorization` provides Bitwarden's business logic for the requested authorization from the
//!   server, for the various agent operations.
//! - `approval` provides an interface for the agent itself to request approval from an external
//!   entity (currently, Electron via napi) to approve requests.
//! - `agent` contains the store of keys, and the server, and uses the authorization and approval
//!   impelementation to orchestrate operations between the server and the external (Electron)
//!   entity.

#![allow(dead_code)] // TODO remove when all code is used in follow-up PR

mod agent;
mod approval;
mod authorization;
mod crypto;
mod server;
mod storage;

// external exports for napi
pub use agent::BitwardenSSHAgent;
pub use approval::{ApprovalError, ApprovalRequester, SignApprovalRequest};
pub use crypto::PublicKey;
pub use server::{AuthRequest, SIGNamespace, SignRequest};
pub use storage::{
    keydata::SSHKeyData,
    keystore::{InMemoryEncryptedKeyStore, KeyStore},
};
