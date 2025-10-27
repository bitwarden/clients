pub struct BiometricLockSystem {}

impl BiometricLockSystem {
    pub fn new() -> Self {
        Self {}
    }
}

impl Default for BiometricLockSystem {
    fn default() -> Self {
        Self::new()
    }
}

impl super::BiometricTrait for BiometricLockSystem {
    async fn authenticate(&self, _hwnd: Vec<u8>, _message: String) -> Result<bool, anyhow::Error> {
        unimplemented!()
    }

    async fn authenticate_available(&self) -> Result<bool, anyhow::Error> {
        unimplemented!()
    }

    async fn enroll_persistent(&self, _user_id: &str, _key: &[u8]) -> Result<(), anyhow::Error> {
        unimplemented!()
    }

    async fn provide_key(&self, _user_id: &str, _key: &[u8]) {
        unimplemented!()
    }

    async fn unlock(&self, _user_id: &str, _hwnd: Vec<u8>) -> Result<Vec<u8>, anyhow::Error> {
        unimplemented!()
    }

    async fn unlock_available(&self, _user_id: &str) -> Result<bool, anyhow::Error> {
        unimplemented!()
    }

    async fn has_persistent(&self, _user_id: &str) -> Result<bool, anyhow::Error> {
        unimplemented!()
    }

    async fn unenroll(&self, _user_id: &str) -> Result<(), anyhow::Error> {
        unimplemented!()
    }
}
