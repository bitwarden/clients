use anyhow::Result;
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

pub async fn get_password(service: &str, account: &str) -> Result<String> {
    let result = String::from_utf8(get_generic_password(service, account)?)?;
    Ok(result)
}

pub async fn set_password(service: &str, account: &str, password: &str) -> Result<()> {
    set_generic_password(service, account, password.as_bytes())?;
    Ok(())
}

pub async fn delete_password(service: &str, account: &str) -> Result<()> {
    delete_generic_password(service, account)?;
    Ok(())
}

pub async fn is_available() -> Result<bool> {
    Ok(true)
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
            Err(e) => assert_eq!(
                "The specified item could not be found in the keychain.",
                e.to_string()
            ),
        }
    }

    #[tokio::test]
    async fn test_error_no_password() {
        match get_password("Unknown", "Unknown").await {
            Ok(_) => panic!("Got a result"),
            Err(e) => assert_eq!(
                "The specified item could not be found in the keychain.",
                e.to_string()
            ),
        }
    }
}
