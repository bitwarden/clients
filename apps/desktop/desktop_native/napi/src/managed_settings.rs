#[cfg(windows)]
#[napi]
pub mod managed_settings {
    use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
    use windows::{
        core::HSTRING,
        Win32::{
            Foundation::{CloseHandle, ERROR_SUCCESS, WAIT_OBJECT_0},
            System::{
                Registry::{
                    RegCloseKey, RegNotifyChangeKeyValue, RegOpenKeyExW, HKEY_LOCAL_MACHINE,
                    KEY_NOTIFY, REG_NOTIFY_CHANGE_LAST_SET,
                },
                Threading::{CreateEventW, WaitForSingleObject, INFINITE},
            },
        },
    };

    #[allow(clippy::unused_async)]
    #[napi]
    pub async fn watch_registry(
        subkey: String,
        callback: ThreadsafeFunction<()>,
    ) -> napi::Result<()> {
        std::thread::spawn(move || watch_loop(subkey, callback));
        Ok(())
    }

    fn watch_loop(subkey: String, callback: ThreadsafeFunction<()>) {
        let hkey = unsafe {
            let mut hkey = Default::default();
            let err = RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                &HSTRING::from(subkey.as_str()),
                None,
                KEY_NOTIFY,
                &mut hkey,
            );
            if err != ERROR_SUCCESS {
                tracing::error!(
                    "managed_settings: RegOpenKeyExW failed ({:?}); watcher not started",
                    err
                );
                return;
            }
            hkey
        };

        let event = unsafe {
            match CreateEventW(None, false, false, None) {
                Ok(h) => h,
                Err(e) => {
                    tracing::error!(
                        "managed_settings: CreateEventW failed: {e}; watcher not started"
                    );
                    let _ = RegCloseKey(hkey);
                    return;
                }
            }
        };

        loop {
            let err = unsafe {
                RegNotifyChangeKeyValue(hkey, false, REG_NOTIFY_CHANGE_LAST_SET, Some(event), true)
            };
            if err != ERROR_SUCCESS {
                tracing::error!(
                    "managed_settings: RegNotifyChangeKeyValue failed ({:?}); watcher stopping",
                    err
                );
                break;
            }

            let wait = unsafe { WaitForSingleObject(event, INFINITE) };
            if wait != WAIT_OBJECT_0 {
                tracing::error!(
                    "managed_settings: WaitForSingleObject returned {:?}; watcher stopping",
                    wait
                );
                break;
            }

            callback.call(Ok(()), ThreadsafeFunctionCallMode::NonBlocking);
        }

        unsafe {
            let _ = CloseHandle(event);
            let _ = RegCloseKey(hkey);
        }
    }
}

#[cfg(not(windows))]
#[napi]
pub mod managed_settings {}
