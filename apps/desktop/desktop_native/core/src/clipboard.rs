use anyhow::Result;
use arboard::{Clipboard, Set};

pub fn read() -> Result<String> {
    let mut clipboard = Clipboard::new()?;

    Ok(clipboard.get_text()?)
}

pub fn write(text: &str, password: bool) -> Result<()> {
    let mut clipboard = Clipboard::new()?;

    let set = clipboard_set(clipboard.set(), password);

    set.text(text)?;
    Ok(())
}

// Exclude from windows clipboard history
#[cfg(target_os = "windows")]
fn clipboard_set(set: Set, password: bool) -> Set {
    use arboard::SetExtWindows;

    if password {
        set.exclude_from_cloud().exclude_from_history()
    } else {
        set
    }
}

// Wait for clipboard to be available on linux
#[cfg(target_os = "linux")]
fn clipboard_set(set: Set, _password: bool) -> Set {
    use arboard::SetExtLinux;

    set.wait()
}

#[cfg(target_os = "macos")]
fn clipboard_set(set: Set, password: bool) -> Set {
    use arboard::SetExtApple;

    if password {
        set.exclude_from_history()
    } else {
        set
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(any(feature = "manual_test", not(target_os = "linux")))]
    fn test_write_read() {
        let message = "Hello world!";

        write(message, false).unwrap();
        assert_eq!(message, read().unwrap());
    }
}
