use std::ffi::OsString;
use std::os::windows::ffi::OsStrExt;

use std::fs::{OpenOptions, create_dir_all};
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};
use std::path::Path;

use windows::Win32::Foundation::*;
use windows::Win32::System::LibraryLoader::*;
use windows_core::*;

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

pub trait WindowsString {
    fn into_win_utf8(self: Self) -> (*mut u8, u32);
    fn into_win_utf16(self: Self) -> (*mut u16, u32);
    fn into_win_utf16_wide(self: Self) -> (*mut u16, u32);
}

impl WindowsString for String {
    fn into_win_utf8(self: Self) -> (*mut u8, u32) {
        let mut v = self.into_bytes();
        v.push(0);

        (v.as_mut_ptr(), v.len() as u32)
    }

    fn into_win_utf16(self: Self) -> (*mut u16, u32) {
        let mut v: Vec<u16> = self.encode_utf16().collect();
        v.push(0);

        (v.as_mut_ptr(), v.len() as u32)
    }

    fn into_win_utf16_wide(self: Self) -> (*mut u16, u32) {
        let mut v: Vec<u16> = OsString::from(self).encode_wide().collect();
        v.push(0);

        (v.as_mut_ptr(), v.len() as u32)
    }
}

pub fn file_log(msg: &str) {
    let log_path = "C:\\temp\\bitwarden_com_debug.log";
    
    // Create the temp directory if it doesn't exist
    if let Some(parent) = Path::new(log_path).parent() {
        let _ = create_dir_all(parent);
    }
    
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path) 
    {
        let now = SystemTime::now();
        let timestamp = match now.duration_since(UNIX_EPOCH) {
            Ok(duration) => {
                let total_secs = duration.as_secs();
                let millis = duration.subsec_millis();
                let secs = total_secs % 60;
                let mins = (total_secs / 60) % 60;
                let hours = (total_secs / 3600) % 24;
                format!("{:02}:{:02}:{:02}.{:03}", hours, mins, secs, millis)
            },
            Err(_) => "??:??:??.???".to_string()
        };
        
        let _ = writeln!(file, "[{}] {}", timestamp, msg);
    }
}

pub fn message(message: &str) {
    file_log(message)
}

// Helper function to convert Windows wide string (UTF-16) to Rust String
pub unsafe fn wstr_to_string(wstr_ptr: *const u16) -> std::result::Result<String, std::string::FromUtf16Error> {
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