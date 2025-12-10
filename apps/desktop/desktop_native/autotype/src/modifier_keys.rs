use std::{collections::HashMap, sync::OnceLock};

// Electron modifier keys
// <https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts#cross-platform-modifiers>
pub(crate) const CONTROL_KEY_STR: &str = "Control";
pub(crate) const ALT_KEY_STR: &str = "Alt";
pub(crate) const SUPER_KEY_STR: &str = "Super";

// numeric values for modifier keys
pub(crate) const CONTROL_KEY: u16 = 0x11;
pub(crate) const ALT_KEY: u16 = 0x12;
pub(crate) const SUPER_KEY: u16 = 0x5B;

/// A mapping of <Electron modifier key string> to <numeric representation>
static MODIFIER_KEYS: OnceLock<HashMap<&str, u16>> = OnceLock::new();

/// Provides a mapping of the valid modifier keys' electron
/// string representation to the numeric representation.
pub(crate) fn get_modifier_keys() -> &'static HashMap<&'static str, u16> {
    MODIFIER_KEYS.get_or_init(|| {
        HashMap::from([
            (CONTROL_KEY_STR, CONTROL_KEY),
            (ALT_KEY_STR, ALT_KEY),
            (SUPER_KEY_STR, SUPER_KEY),
        ])
    })
}

#[cfg(test)]
mod test {
    use super::get_modifier_keys;

    #[test]
    fn valid_modifier_keys() {
        assert_eq!(get_modifier_keys().get("Control").unwrap(), &0x11);
        assert_eq!(get_modifier_keys().get("Alt").unwrap(), &0x12);
        assert_eq!(get_modifier_keys().get("Super").unwrap(), &0x5B);
    }

    #[test]
    fn does_not_contain_invalid_modifier_keys() {
        assert!(!get_modifier_keys().contains_key("Shift"));
    }
}
