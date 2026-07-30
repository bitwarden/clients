use crate::password::PASSWORD_NOT_FOUND;
use anyhow::Result;
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

#[allow(clippy::unused_async)]
pub async fn get_password(service: &str, account: &str) -> Result<String> {
    let password = get_generic_password(service, account).map_err(convert_error)?;
    let result = String::from_utf8(password)?;
    Ok(result)
}

#[allow(clippy::unused_async)]
pub async fn set_password(service: &str, account: &str, password: &str) -> Result<()> {
    set_generic_password(service, account, password.as_bytes())?;
    Ok(())
}

#[allow(clippy::unused_async)]
pub async fn delete_password(service: &str, account: &str) -> Result<()> {
    delete_generic_password(service, account).map_err(convert_error)?;
    Ok(())
}

#[allow(clippy::unused_async)]
pub async fn is_available() -> Result<bool> {
    Ok(true)
}

fn convert_error(e: security_framework::base::Error) -> anyhow::Error {
    match e.code() {
        security_framework_sys::base::errSecItemNotFound => {
            anyhow::anyhow!(PASSWORD_NOT_FOUND)
        }
        _ => anyhow::anyhow!(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test() {
        set_password("BitwardenTest", "BitwardenTest", "Random")
            .await
            .unwrap();
        assert_eq!(
            "Random",
            get_password("BitwardenTest", "BitwardenTest")
                .await
                .unwrap()
        );
        delete_password("BitwardenTest", "BitwardenTest")
            .await
            .unwrap();

        // Ensure password is deleted
        match get_password("BitwardenTest", "BitwardenTest").await {
            Ok(_) => panic!("Got a result"),
            Err(e) => assert_eq!(PASSWORD_NOT_FOUND, e.to_string()),
        }
    }

    #[tokio::test]
    async fn test_error_no_password() {
        match get_password("Unknown", "Unknown").await {
            Ok(_) => panic!("Got a result"),
            Err(e) => assert_eq!(PASSWORD_NOT_FOUND, e.to_string()),
        }
    }
}
