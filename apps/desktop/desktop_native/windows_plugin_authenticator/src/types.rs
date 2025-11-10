/// User verification requirement as defined by WebAuthn spec
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserVerificationRequirement {
    Required,
    Preferred,
    Discouraged,
}

impl Default for UserVerificationRequirement {
    fn default() -> Self {
        UserVerificationRequirement::Preferred
    }
}

impl From<u32> for UserVerificationRequirement {
    fn from(value: u32) -> Self {
        match value {
            1 => UserVerificationRequirement::Required,
            2 => UserVerificationRequirement::Preferred,
            3 => UserVerificationRequirement::Discouraged,
            _ => UserVerificationRequirement::Preferred, // Default fallback
        }
    }
}

impl Into<String> for UserVerificationRequirement {
    fn into(self) -> String {
        match self {
            UserVerificationRequirement::Required => "required".to_string(),
            UserVerificationRequirement::Preferred => "preferred".to_string(),
            UserVerificationRequirement::Discouraged => "discouraged".to_string(),
        }
    }
}
