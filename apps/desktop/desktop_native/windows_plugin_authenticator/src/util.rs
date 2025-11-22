use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use windows::Win32::UI::HiDpi::GetDpiForWindow;
use windows::{
    core::PCSTR,
    Win32::{Foundation::*, System::LibraryLoader::*, UI::WindowsAndMessaging::GetWindowRect},
};

use crate::com_buffer::ComBuffer;

const BASE_DPI: u32 = 96;

pub trait HwndExt {
    fn center_position(&self) -> windows::core::Result<(i32, i32)>;
}

impl HwndExt for HWND {
    fn center_position(&self) -> windows::core::Result<(i32, i32)> {
        let mut window: RECT = RECT::default();
        unsafe {
            GetWindowRect(*self, &mut window)?;

            // Calculate center in physical pixels
            let center = (
                (window.right + window.left) / 2,
                (window.bottom + window.top) / 2,
            );

            // Convert from physical to logical pixels
            let dpi = GetDpiForWindow(*self);
            if dpi == BASE_DPI {
                return Ok(center);
            }
            let scaling_factor: f64 = dpi as f64 / 96.0;
            let scaled_center = (
                center.0 as f64 / scaling_factor,
                center.1 as f64 / scaling_factor,
            );

            Ok((scaled_center.0 as i32, scaled_center.1 as i32))
        }
    }
}

pub unsafe fn delay_load<T>(library: PCSTR, function: PCSTR) -> Option<T> {
    let library = LoadLibraryExA(library, None, LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);

    let Ok(library) = library else {
        return None;
    };

    let address = GetProcAddress(library, function);

    if address.is_some() {
        return Some(std::mem::transmute_copy(&address));
    }

    _ = FreeLibrary(library);

    None
}

/// Trait for converting strings to Windows-compatible wide strings using COM allocation
pub trait WindowsString {
    /// Converts to null-terminated UTF-16 using COM allocation
    fn to_com_utf16(&self) -> (*mut u16, u32);
    /// Converts to Vec<u16> for temporary use (caller must keep Vec alive)
    fn to_utf16(&self) -> Vec<u16>;
}

impl WindowsString for str {
    fn to_com_utf16(&self) -> (*mut u16, u32) {
        let mut wide_vec: Vec<u16> = self.encode_utf16().collect();
        wide_vec.push(0); // null terminator
        let wide_bytes: Vec<u8> = wide_vec.iter().flat_map(|&x| x.to_le_bytes()).collect();
        let (ptr, byte_count) = ComBuffer::from_buffer(&wide_bytes);
        (ptr as *mut u16, byte_count)
    }

    fn to_utf16(&self) -> Vec<u16> {
        let mut wide_vec: Vec<u16> = self.encode_utf16().collect();
        wide_vec.push(0); // null terminator
        wide_vec
    }
}

pub fn file_log(msg: &str) {
    let log_path = "C:\\temp\\bitwarden_com_debug.log";

    // Create the temp directory if it doesn't exist
    if let Some(parent) = Path::new(log_path).parent() {
        let _ = create_dir_all(parent);
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let now = SystemTime::now();
        let timestamp = match now.duration_since(UNIX_EPOCH) {
            Ok(duration) => {
                let total_secs = duration.as_secs();
                let millis = duration.subsec_millis();
                let secs = total_secs % 60;
                let mins = (total_secs / 60) % 60;
                let hours = (total_secs / 3600) % 24;
                format!("{:02}:{:02}:{:02}.{:03}", hours, mins, secs, millis)
            }
            Err(_) => "??:??:??.???".to_string(),
        };

        let _ = writeln!(file, "[{}] {}", timestamp, msg);
    }
}

// Helper function to convert Windows wide string (UTF-16) to Rust String
pub unsafe fn wstr_to_string(
    wstr_ptr: *const u16,
) -> std::result::Result<String, std::string::FromUtf16Error> {
    if wstr_ptr.is_null() {
        return Ok(String::new());
    }

    // Find the length of the null-terminated wide string
    let mut len = 0;
    while *wstr_ptr.add(len) != 0 {
        len += 1;
    }

    // Convert to Rust string
    let wide_slice = std::slice::from_raw_parts(wstr_ptr, len);
    String::from_utf16(wide_slice)
}
