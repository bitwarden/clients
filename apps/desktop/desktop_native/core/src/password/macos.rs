use anyhow::Result;
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

pub fn get_password(service: &str, account: &str) -> Result<String> {
    let result = String::from_utf8(get_generic_password(&service, &account)?)?;
    Ok(result)
}

pub fn get_password_keytar(service: &str, account: &str) -> Result<String> {
    get_password(service, account)
}

pub fn set_password(service: &str, account: &str, password: &str) -> Result<()> {
    let result = set_generic_password(&service, &account, password.as_bytes())?;
    Ok(result)
}

pub fn delete_password(service: &str, account: &str) -> Result<()> {
    let result = delete_generic_password(&service, &account)?;
    Ok(result)
}

pub fn is_available() -> Result<bool> {
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test() {
        scopeguard::defer!(delete_password("BitwardenTest", "BitwardenTest").unwrap_or({}););
        set_password("BitwardenTest", "BitwardenTest", "Random").unwrap();
        assert_eq!(
            "Random",
            get_password("BitwardenTest", "BitwardenTest").unwrap()
        );
        delete_password("BitwardenTest", "BitwardenTest").unwrap();

        // Ensure password is deleted
        match get_password("BitwardenTest", "BitwardenTest") {
            Ok(_) => panic!("Got a result"),
            Err(e) => assert_eq!(
                "The specified item could not be found in the keychain.",
                e.to_string()
            ),
        }
    }

    #[test]
    fn test_error_no_password() {
        match get_password("Unknown", "Unknown") {
            Ok(_) => panic!("Got a result"),
            Err(e) => assert_eq!(
                "The specified item could not be found in the keychain.",
                e.to_string()
            ),
        }
    }
}
