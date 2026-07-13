//! Contains structures that bridge between raw cryptographic keys and Bitwarden's business logic
//! data.

use anyhow::{anyhow, Result};

use crate::crypto::{PrivateKey, PublicKey};

/// Represents SSH key that is queryable.
///
/// Allows abstracting over different key data implementations,
/// for mocking in tests without requiring actual cryptographic keys.
#[cfg_attr(test, mockall::automock)]
pub trait QueryableKeyData: Send + Sync {
    /// # Returns
    ///
    /// A reference to the [`PublicKey`].
    fn public_key(&self) -> &PublicKey;

    /// # Returns
    ///
    /// A reference to the human-readable name for this key.
    fn name(&self) -> &String;

    /// # Returns
    ///
    /// A reference to the cipher ID that links this key to a vault entry.
    fn cipher_id(&self) -> &String;
}

/// Represents an SSH key and its associated metadata.
#[derive(Clone)]
pub struct SSHKeyData {
    /// Private key of the key pair
    pub(super) private_key: PrivateKey,
    /// Public key of the key pair
    pub(super) public_key: PublicKey,
    /// Human-readable name
    pub(super) name: String,
    /// Vault cipher ID associated with the key pair
    pub(super) cipher_id: String,
}

impl SSHKeyData {
    /// Creates a new `SSHKeyData` instance.
    ///
    /// # Arguments
    ///
    /// * `private_key` - The private key component
    /// * `public_key` - The public key component
    /// * `name` - A human-readable name for the key
    /// * `cipher_id` - The vault cipher identifier associated with this key
    #[must_use]
    pub fn new(
        private_key: PrivateKey,
        public_key: PublicKey,
        name: String,
        cipher_id: String,
    ) -> Self {
        Self {
            private_key,
            public_key,
            name,
            cipher_id,
        }
    }

    /// Parses an OpenSSH PEM private key string and constructs an [`SSHKeyData`] instance.
    ///
    /// # Errors
    ///
    /// Returns an error if the PEM string cannot be parsed, the public key blob cannot be
    /// encoded, or the key algorithm is unsupported.
    pub fn from_private_key_pem(pem: &str, name: String, cipher_id: String) -> Result<Self> {
        let ssh_key = ssh_key::PrivateKey::from_openssh(pem)
            .map_err(|e| anyhow!("Failed to parse private key: {e}"))?;

        let blob = ssh_key
            .public_key()
            .to_bytes()
            .map_err(|e| anyhow!("Failed to encode public key: {e}"))?;

        let alg = ssh_key.algorithm().to_string();
        let private_key = PrivateKey::try_from(ssh_key)?;

        Ok(Self::new(
            private_key,
            PublicKey { alg, blob },
            name,
            cipher_id,
        ))
    }

    /// # Returns
    ///
    /// A reference to the [`PrivateKey`].
    #[must_use]
    pub fn private_key(&self) -> &PrivateKey {
        &self.private_key
    }
}

impl QueryableKeyData for SSHKeyData {
    fn public_key(&self) -> &PublicKey {
        &self.public_key
    }

    fn name(&self) -> &String {
        &self.name
    }

    fn cipher_id(&self) -> &String {
        &self.cipher_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_ED25519_PEM: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACAOYor3+kyAsXYs2sGikmUuhpxmVf2hAGd2TK7KwN4N9gAAAJj79ujB+/bo
wQAAAAtzc2gtZWQyNTUxOQAAACAOYor3+kyAsXYs2sGikmUuhpxmVf2hAGd2TK7KwN4N9g
AAAEAgAQkLDKjON00XO+Y09BoIBuQsAXAx6HUhQoTEodVzig5iivf6TICxdizawaKSZS6G
nGZV/aEAZ3ZMrsrA3g32AAAAEHRlc3RAZXhhbXBsZS5jb20BAgMEBQ==
-----END OPENSSH PRIVATE KEY-----";

    const TEST_ECDSA_P256_PEM: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAaAAAABNlY2RzYS
1zaGEyLW5pc3RwMjU2AAAACG5pc3RwMjU2AAAAQQTxTFl3YbkQx1hDBpxzYXjxtxbWALAX
l0J/uTOH7xp26qd/ZGDhXRyA9rev8RSYWUOHCeXWM1UfBD+/O6Q//Bg1AAAAsMdG2sXHRt
rFAAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBPFMWXdhuRDHWEMG
nHNhePG3FtYAsBeXQn+5M4fvGnbqp39kYOFdHID2t6/xFJhZQ4cJ5dYzVR8EP787pD/8GD
UAAAAhAKXjTrT6GTWhZjcgIDXAqy+WfYZfcPn7qN2+KvztRxwhAAAAEHRlc3RAZXhhbXBs
ZS5jb20BAgMEBQYH
-----END OPENSSH PRIVATE KEY-----";

    const TEST_ECDSA_P384_PEM: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAiAAAABNlY2RzYS
1zaGEyLW5pc3RwMzg0AAAACG5pc3RwMzg0AAAAYQT/SPsICrjmTLm23gbxFnlXVWHssN+u
l/xsmWByfXe69mFpZ51JZBixP+D/3RIHY8BGJtI63WTGT5ufZrA3WoqQxanfz1uloieBuD
mQaCa63p0BnXiN1LeEXIn2KV8pzfUAAADgFQsp3BULKdwAAAATZWNkc2Etc2hhMi1uaXN0
cDM4NAAAAAhuaXN0cDM4NAAAAGEE/0j7CAq45ky5tt4G8RZ5V1Vh7LDfrpf8bJlgcn13uv
ZhaWedSWQYsT/g/90SB2PARibSOt1kxk+bn2awN1qKkMWp389bpaIngbg5kGgmut6dAZ14
jdS3hFyJ9ilfKc31AAAAMQCG/ISb7T9VU6GgQcX1Rgg7W8vTe8gOV7GC7eN+99fb0hkAHM
PVZD+gsWkn/amWSqYAAAAQdGVzdEBleGFtcGxlLmNvbQECAwQFBgc=
-----END OPENSSH PRIVATE KEY-----";

    const TEST_ECDSA_P521_PEM: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAArAAAABNlY2RzYS
1zaGEyLW5pc3RwNTIxAAAACG5pc3RwNTIxAAAAhQQAryIPEoVINPnTwKClFZzKsQZL1zSN
L2Ym0RCgCLynP3/HHWm83bGJZSduxxbaZWWqLsbkqZC5Vol5IvlaY7afJMIB4d7g8kx+VA
GWTPdaIE212/5MzpLSeO+CZfmx0stYR2mJvlcAoJEAVdHHrluGQHbQOCr9m4y/TgCLrgMU
DUaw5J0AAAEQuqcPQ7qnD0MAAAATZWNkc2Etc2hhMi1uaXN0cDUyMQAAAAhuaXN0cDUyMQ
AAAIUEAK8iDxKFSDT508CgpRWcyrEGS9c0jS9mJtEQoAi8pz9/xx1pvN2xiWUnbscW2mVl
qi7G5KmQuVaJeSL5WmO2nyTCAeHe4PJMflQBlkz3WiBNtdv+TM6S0njvgmX5sdLLWEdpib
5XAKCRAFXRx65bhkB20Dgq/ZuMv04Ai64DFA1GsOSdAAAAQgE5o4px5ogVApLd4CId9HoD
q0pHQsJZqdLrnH8xAUB24nkyl0y5VBN+vSiK0gXbkKl++pWdihdvcmOWLVxJrbpBvAAAAB
B0ZXN0QGV4YW1wbGUuY29tAQI=
-----END OPENSSH PRIVATE KEY-----";

    const TEST_RSA_PEM: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAQEA8nnAt1NQAzh5C6lybBVgdfmhxL96Jddpl0Z4vlb7iysdW5oj7b09
rWUpQmPrW+Qpc+pJWVF++FQvjyEtTQwV/FHJsqYMZIpS98dQVWC1IZeQbPdsa3Ey5YmM3S
/tf9UpqCcKG5J2ZJYeayVSerfRZFKgMhu8wmLaGxPk153Z5lj6RkBFE28j058ivN55IZcX
hd0qvbDIpvCV9W1Qo4x/ia7es3se3kJc+IwXu/rkE5KM0RDVzLmuZ5R1wOMXcTZ4ceG9by
viJXvSIb6CYE1zGMt5gFvLtNHTyzExqtpsLe3DfufzSl5wN1HcRDcLyU949Lvf6XxHqWfc
aWm26q3nYQAAA8j0V6qC9FeqggAAAAdzc2gtcnNhAAABAQDyecC3U1ADOHkLqXJsFWB1+a
HEv3ol12mXRni+VvuLKx1bmiPtvT2tZSlCY+tb5Clz6klZUX74VC+PIS1NDBX8Ucmypgxk
ilL3x1BVYLUhl5Bs92xrcTLliYzdL+1/1SmoJwobknZklh5rJVJ6t9FkUqAyG7zCYtobE+
TXndnmWPpGQEUTbyPTnyK83nkhlxeF3Sq9sMim8JX1bVCjjH+Jrt6zex7eQlz4jBe7+uQT
kozRENXMua5nlHXA4xdxNnhx4b1vK+Ile9IhvoJgTXMYy3mAW8u00dPLMTGq2mwt7cN+5/
NKXnA3UdxENwvJT3j0u9/pfEepZ9xpabbqredhAAAAAwEAAQAAAQBQ/yLFGmtr5/1nS98R
A8MJJa5IDr46zc5T3hKPYnb8chaIduDxlXl45oX1y3Lfa0P9mJGP6I1FXrnUUfzT8+mUM6
3wo08YdqxoYIgRPRDEe+CexbfN3C5oRp5rdIsdXJNhvEjAFRi/WPYoTHtUyvqDTKZ+lo1j
UaoRyX90FyKmswPR9dcG130M4MrKYWA8rz7XtnMaR1IbLb3AnlfOhfMKsOWklgNPBpDAoH
HMeYVBhva+LN2+VpRVnLaZ2yM747UEMJymLR6gvVN+uAyOMZscOJ8wNKhnf59UfEZummA1
k1Q+H+bkCoOcpx8MqT7mad+5dMCvU5oyGnjhZ00srEzBAAAAgDVKPCR0n4IC/wUCaPmniw
x+H5HxG4NPRxdKQegRxCZjpZxxNFFbO3Kxfu/kppkAR9kI3y7OEszYJvDnnz69h+S2UBww
Bdnv6VzEtAysx98X70KyoA4fUa8l1D6wNwwjC1Mfty6vsJ7fH8NylzlhkpiBt2ZmqvD4fz
rJoMCqGE2PAAAAgQD7Vx7zZ+1xr+fzdmVEA5/NVFXLd7BmSDndUeUmOX1dlc1MH93PYtC6
eoByaz9J/bibbJtExyBPq2J7yQbx/6tp4BJ1WkJNhNKfc1gNYiY0mhbV5/TOZOu33IcOk+
USl3hJCuja+cL5O+txPUoxp+5CWx0yb69jTbYdjiz5eCj7dQAAAIEA9viPLqCgGdXoNXWS
8y/XETvN4EVFg2kleUcabSb2jrJ9hEr6ERJ1bRWtIbnwHC2QUNjXF+41MYBbjpbf+BVEsl
SP5DsnXG3RJCI4fE9sUM81avDnDXKbDH7IgbqRc8hHnhQnE2d2wBnpiDedVu4m6BKTGWKM
vt8T5DsruwPs+r0AAAAQdGVzdEBleGFtcGxlLmNvbQECAw==
-----END OPENSSH PRIVATE KEY-----";

    // Synthetic sk-ssh-ed25519@openssh.com key (FIDO2 resident key).
    // Generated with zeroed dummy key data — valid wire format, not a real keypair.
    const TEST_SK_ED25519_PEM: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAASgAAABpzay1zc2
gtZWQyNTUxOUBvcGVuc3NoLmNvbQAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAARzc2g6AAAAiHneT6B53k+gAAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY2
9tAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABHNzaDoAAAAAEAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAE3NrLXRlc3RAZXhhbXBsZS5jb20BAgMEBQY=
-----END OPENSSH PRIVATE KEY-----";

    #[test]
    fn test_from_private_key_pem_safely_rejects_unsupported_key_type() {
        let result = SSHKeyData::from_private_key_pem(
            TEST_SK_ED25519_PEM,
            "sk-test".to_string(),
            "cipher-sk-1".to_string(),
        );

        assert!(result.is_err(), "sk-ssh-ed25519 key type must be rejected");
    }

    #[test]
    fn from_private_key_pem_ed25519_sets_correct_algorithm_string() {
        let data =
            SSHKeyData::from_private_key_pem(TEST_ED25519_PEM, "k".into(), "id".into()).unwrap();
        assert_eq!(data.public_key().alg(), "ssh-ed25519");
    }

    #[test]
    fn from_private_key_pem_ecdsa_p256_sets_correct_algorithm_string() {
        let data =
            SSHKeyData::from_private_key_pem(TEST_ECDSA_P256_PEM, "k".into(), "id".into()).unwrap();
        assert_eq!(data.public_key().alg(), "ecdsa-sha2-nistp256");
    }

    #[test]
    fn from_private_key_pem_ecdsa_p384_sets_correct_algorithm_string() {
        let data =
            SSHKeyData::from_private_key_pem(TEST_ECDSA_P384_PEM, "k".into(), "id".into()).unwrap();
        assert_eq!(data.public_key().alg(), "ecdsa-sha2-nistp384");
    }

    #[test]
    fn from_private_key_pem_ecdsa_p521_sets_correct_algorithm_string() {
        let data =
            SSHKeyData::from_private_key_pem(TEST_ECDSA_P521_PEM, "k".into(), "id".into()).unwrap();
        assert_eq!(data.public_key().alg(), "ecdsa-sha2-nistp521");
    }

    #[test]
    fn from_private_key_pem_rsa_sets_correct_algorithm_string() {
        let data = SSHKeyData::from_private_key_pem(TEST_RSA_PEM, "k".into(), "id".into()).unwrap();
        assert_eq!(data.public_key().alg(), "ssh-rsa");
    }
}
