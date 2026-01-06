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
static MODIFIER_KEYS: [(&str, u16); 3] = [
    (CONTROL_KEY_STR, CONTROL_KEY),
    (ALT_KEY_STR, ALT_KEY),
    (SUPER_KEY_STR, SUPER_KEY),
];

/// Provides a mapping of the valid modifier keys' electron
/// string representation to the numeric representation.
pub(crate) fn get_numeric_modifier_key(modifier: &str) -> Option<u16> {
    for (modifier_str, modifier_num) in MODIFIER_KEYS {
        if modifier_str == modifier {
            return Some(modifier_num);
        }
    }
    None
}

#[cfg(test)]
mod test {
    use super::get_numeric_modifier_key;

    #[test]
    fn valid_modifier_keys() {
        assert_eq!(get_numeric_modifier_key("Control").unwrap(), 0x11);
        assert_eq!(get_numeric_modifier_key("Alt").unwrap(), 0x12);
        assert_eq!(get_numeric_modifier_key("Super").unwrap(), 0x5B);
    }

    #[test]
    fn does_not_contain_invalid_modifier_keys() {
        assert!(get_numeric_modifier_key("Shift").is_none());
    }
}
