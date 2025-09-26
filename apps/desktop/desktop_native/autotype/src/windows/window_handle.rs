//! This module provides an interface to the `HWND` struct, which
//! is a Win32 handle (pointer), in the form of a light wrapper.
//!
//! Isolating the `WindowHandle` in a module is in part to ensure
//! that the handle is checked to be valid whenever it is used.

use anyhow::{anyhow, Result};
use windows::Win32::Foundation::HWND;

/// `WindowHandle` is a light wrapper over the `HWND` (a win32 pointer)
/// The internal raw pointer is only accessible via the `get()` method.
/// This ensures that the validity of the handle is checked before
/// usage.
pub struct WindowHandle {
    handle: HWND,
}

impl WindowHandle {
    /// Createa a new `WindowHandle`
    ///
    /// # Errors
    ///
    /// This function will return an Error if:
    ///   * The raw handle is not valid.
    pub fn new(handle: HWND) -> Result<Self> {
        let handle = Self { handle };
        handle.is_valid()?;
        Ok(handle)
    }

    /// Get the raw win32 handle.
    ///
    /// # Errors
    ///
    /// This function will return an Error if:
    ///   * The raw handle is not valid.
    pub fn get(&self) -> Result<&HWND> {
        self.is_valid()?;
        Ok(&self.handle)
    }

    /// Check if the raw win32 handle is valid.
    ///
    /// # Errors
    ///
    /// This function will return an Error if:
    ///   * The raw handle is not valid.
    pub fn is_valid(&self) -> Result<()> {
        if self.handle.is_invalid() {
            let error = "Window handle is invalid.";
            eprintln!("{error}"); // TODO: error
            return Err(anyhow!(error));
        }
        Ok(())
    }
}
