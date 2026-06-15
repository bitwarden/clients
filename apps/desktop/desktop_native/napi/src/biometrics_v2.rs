#[napi]
pub mod biometrics_v2 {
    use desktop_core::biometric_v2::BiometricTrait;

    #[napi]
    pub struct BiometricLockSystem {
        inner: desktop_core::biometric_v2::BiometricLockSystem,
    }

    #[napi]
    pub fn init_biometric_system() -> napi::Result<BiometricLockSystem> {
        Ok(BiometricLockSystem {
            inner: desktop_core::biometric_v2::BiometricLockSystem::new(),
        })
    }

    #[napi]
    pub async fn authenticate(
        biometric_lock_system: &BiometricLockSystem,
        hwnd: napi::bindgen_prelude::Buffer,
        message: String,
    ) -> napi::Result<bool> {
        Ok(biometric_lock_system
            .inner
            .authenticate(hwnd.into(), message)
            .await?)
    }

    #[napi]
    pub async fn authenticate_available(
        biometric_lock_system: &BiometricLockSystem,
    ) -> napi::Result<bool> {
        Ok(biometric_lock_system.inner.authenticate_available().await?)
    }

    #[napi]
    pub async fn enroll_persistent(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
        key: napi::bindgen_prelude::Buffer,
    ) -> napi::Result<()> {
        Ok(biometric_lock_system
            .inner
            .enroll_persistent(&user_id, &key)
            .await?)
    }

    #[napi]
    pub async fn provide_key(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
        key: napi::bindgen_prelude::Buffer,
    ) -> napi::Result<()> {
        biometric_lock_system
            .inner
            .provide_key(&user_id, &key)
            .await;
        Ok(())
    }

    #[napi]
    pub async fn unlock(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
        hwnd: napi::bindgen_prelude::Buffer,
    ) -> napi::Result<napi::bindgen_prelude::Buffer> {
        Ok(biometric_lock_system
            .inner
            .unlock(&user_id, hwnd.into())
            .await?
            .into())
    }

    #[napi]
    pub async fn unlock_available(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
    ) -> napi::Result<bool> {
        Ok(biometric_lock_system
            .inner
            .unlock_available(&user_id)
            .await?)
    }

    #[napi]
    pub async fn has_persistent(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
    ) -> napi::Result<bool> {
        Ok(biometric_lock_system.inner.has_persistent(&user_id).await?)
    }

    #[napi]
    pub async fn unenroll(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
    ) -> napi::Result<()> {
        Ok(biometric_lock_system.inner.unenroll(&user_id).await?)
    }
}
