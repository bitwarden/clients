use anyhow::{anyhow, Result};
use libsecret::{password_clear_sync, password_lookup_sync, password_store_sync, Schema};
use std::collections::HashMap;

pub fn get_password(service: &str, account: &str) -> Result<String> {
    let res = password_lookup_sync(
        Some(&get_schema()),
        build_attributes(service, account),
        gio::Cancellable::NONE,
    )?;

    match res {
        Some(s) => Ok(String::from(s)),
        None => Err(anyhow!("No password found")),
    }
}

pub fn get_password_keytar(service: &str, account: &str) -> Result<String> {
    get_password(service, account)
}

pub fn set_password(service: &str, account: &str, password: &str) -> Result<()> {
    let result = password_store_sync(
        Some(&get_schema()),
        build_attributes(service, account),
        Some(&libsecret::COLLECTION_DEFAULT),
        &format!("{}/{}", service, account),
        password,
        gio::Cancellable::NONE,
    )?;
    Ok(result)
}

pub fn delete_password(service: &str, account: &str) -> Result<()> {
    let result = password_clear_sync(
        Some(&get_schema()),
        build_attributes(service, account),
        gio::Cancellable::NONE,
    )?;
    Ok(result)
}

pub fn is_available() -> Result<bool> {
    let result = password_clear_sync(
        Some(&get_schema()),
        build_attributes("bitwardenSecretsAvailabilityTest", "test"),
        gio::Cancellable::NONE,
    );
    match result {
        Ok(_) => Ok(true),
        Err(_) => {
            println!("secret-service unavailable: {:?}", result);
            Ok(false)
        }
    }
}

fn get_schema() -> Schema {
    let mut attributes = std::collections::HashMap::new();
    attributes.insert("service", libsecret::SchemaAttributeType::String);
    attributes.insert("account", libsecret::SchemaAttributeType::String);

    libsecret::Schema::new(
        "org.freedesktop.Secret.Generic",
        libsecret::SchemaFlags::NONE,
        attributes,
    )
}

fn build_attributes<'a>(service: &'a str, account: &'a str) -> HashMap<&'a str, &'a str> {
    let mut attributes = HashMap::new();
    attributes.insert("service", service);
    attributes.insert("account", account);

    attributes
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
            Err(e) => assert_eq!("No password found", e.to_string()),
        }
    }

    #[test]
    fn test_error_no_password() {
        match get_password("BitwardenTest", "BitwardenTest") {
            Ok(_) => panic!("Got a result"),
            Err(e) => assert_eq!("No password found", e.to_string()),
        }
    }
}
