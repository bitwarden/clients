/// High level composition of the other modules, to provide an interface that can be exported to
/// NAPI.
pub mod agent;
/// Known hosts scans and parses the hosts from a users home directory, that the user has
/// previously connected to and has trusted.
pub mod knownhosts;
/// In-memory storage for SSH keys. They are held in the desktop_native module while the agent is unlocked.
pub mod memory;
/// Parsing and serialization of the SSH agent protocol messages, and handling of requests
pub mod protocol;
/// SSH agent allows various transport mechanisms - Unix sockets, Windows named pipes, Putty's shared memory.
/// This module implements these transport mechanisms.
pub mod transport;
