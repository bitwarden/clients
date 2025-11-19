use windows::{
    core::s,
    Win32::{
        Foundation::HWND,
        System::Threading::{AttachThreadInput, GetCurrentThreadId},
        UI::{
            Input::KeyboardAndMouse::{EnableWindow, SetActiveWindow, SetCapture, SetFocus},
            WindowsAndMessaging::{
                BringWindowToTop, FindWindowA, GetForegroundWindow, GetWindowThreadProcessId,
                SetForegroundWindow, SwitchToThisWindow, SystemParametersInfoW, SPIF_SENDCHANGE,
                SPIF_UPDATEINIFILE, SPI_GETFOREGROUNDLOCKTIMEOUT, SPI_SETFOREGROUNDLOCKTIMEOUT,
            },
        },
    },
};

pub(crate) struct HwndHolder(pub(crate) HWND);
unsafe impl Send for HwndHolder {}

pub(crate) fn get_active_window() -> Option<HwndHolder> {
    unsafe { Some(HwndHolder(GetForegroundWindow())) }
}

/// Searches for a window that looks like a security prompt and set it as focused.
/// Only works when the process has permission to foreground, either by being in foreground
/// Or by being given foreground permission https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow#remarks
pub fn focus_security_prompt() {
    let hwnd_result = unsafe { FindWindowA(s!("Credential Dialog Xaml Host"), None) };
    if let Ok(hwnd) = hwnd_result {
        set_focus(hwnd);
    }
}

/// Sets focus to a window using a few unstable methods
fn set_focus(hwnd: HWND) {
    unsafe {
        // Windows REALLY does not like apps stealing focus, even if it is for fixing Windows-Hello
        // bugs. The windows hello signing prompt NEEDS to be focused instantly, or it will
        // error, but it does not focus itself.

        // This function implements forced focusing of windows using a few hacks.
        // The conditions to successfully foreground a window are:
        // All of the following conditions are true:
        //   - The calling process belongs to a desktop application, not a UWP app or a Windows
        //     Store app designed for Windows 8 or 8.1.
        //  - The foreground process has not disabled calls to SetForegroundWindow by a previous
        //    call to the LockSetForegroundWindow function.
        //   - The foreground lock time-out has expired (see SPI_GETFOREGROUNDLOCKTIMEOUT in
        //     SystemParametersInfo). No menus are active.
        // Additionally, at least one of the following conditions is true:
        //   - The calling process is the foreground process.
        //   - The calling process was started by the foreground process.
        //   - There is currently no foreground window, and thus no foreground process.
        //   - The calling process received the last input event.
        //   - Either the foreground process or the calling process is being debugged.

        // Update the foreground lock timeout temporarily
        let mut old_timeout = 0;
        let _ = SystemParametersInfoW(
            SPI_GETFOREGROUNDLOCKTIMEOUT,
            0,
            Some(&mut old_timeout as *mut _ as *mut std::ffi::c_void),
            windows::Win32::UI::WindowsAndMessaging::SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        );
        let _ = SystemParametersInfoW(
            SPI_SETFOREGROUNDLOCKTIMEOUT,
            0,
            None,
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
        );
        let _scopeguard = scopeguard::guard((), |_| {
            let _ = SystemParametersInfoW(
                SPI_SETFOREGROUNDLOCKTIMEOUT,
                old_timeout,
                None,
                SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
            );
        });

        // Attach to the foreground thread once attached, we can foreground, even if in the
        // background
        let dw_current_thread = GetCurrentThreadId();
        let dw_fg_thread = GetWindowThreadProcessId(GetForegroundWindow(), None);

        let _ = AttachThreadInput(dw_current_thread, dw_fg_thread, true);
        let _ = SetForegroundWindow(hwnd);
        SetCapture(hwnd);
        let _ = SetFocus(Some(hwnd));
        let _ = SetActiveWindow(hwnd);
        let _ = EnableWindow(hwnd, true);
        let _ = BringWindowToTop(hwnd);
        SwitchToThisWindow(hwnd, true);
        let _ = AttachThreadInput(dw_current_thread, dw_fg_thread, false);
    }
}

/// When restoring focus to the application window, we need a less aggressive method so the electron
/// window doesn't get frozen.
pub(crate) fn restore_focus(hwnd: HWND) {
    unsafe {
        let _ = SetForegroundWindow(hwnd);
        let _ = SetFocus(Some(hwnd));
    }
}
