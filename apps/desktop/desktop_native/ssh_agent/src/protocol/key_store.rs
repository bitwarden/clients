use crate::{
    memory::UnlockedSshItem,
    protocol::{
        connection::ConnectionInfo,
        requests::ParsedSignRequest,
        types::{PublicKey, PublicKeyWithName},
    },
};

pub(crate) trait Agent: Send + Sync {
    async fn request_can_list(
        &self,
        connection_info: &ConnectionInfo,
    ) -> Result<bool, anyhow::Error>;
    async fn list_keys(&self) -> Result<Vec<PublicKeyWithName>, anyhow::Error>;
    async fn request_can_sign(
        &self,
        public_key: &PublicKey,
        connection_info: &ConnectionInfo,
        parsed_sign_request: &ParsedSignRequest,
    ) -> Result<bool, anyhow::Error>;
    async fn find_ssh_item(
        &self,
        public_key: &PublicKey,
    ) -> Result<Option<UnlockedSshItem>, anyhow::Error>;
}
