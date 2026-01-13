use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{de::Visitor, Deserializer};

pub(crate) fn deserialize_b64<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<Vec<u8>, D::Error> {
    deserializer.deserialize_str(Base64Visitor {})
}

struct Base64Visitor;
impl Visitor<'_> for Base64Visitor {
    type Value = Vec<u8>;

    fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        f.write_str("A valid base64 string")
    }

    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        STANDARD.decode(v).map_err(|err| E::custom(err))
    }
}
