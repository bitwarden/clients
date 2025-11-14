#![cfg(target_os = "windows")]

use std::{
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

use serial_test::serial;
use tracing::debug;

use windows::Win32::{
    Foundation::{COLORREF, HINSTANCE, HMODULE, HWND, LPARAM, LRESULT, WPARAM},
    Graphics::Gdi::{CreateSolidBrush, UpdateWindow, ValidateRect, COLOR_WINDOW},
    System::LibraryLoader::{GetModuleHandleA, GetModuleHandleW},
    UI::WindowsAndMessaging::*,
};
use windows_core::{s, w, Result, PCSTR, PCWSTR};

use autotype::{get_foreground_window_title, type_input};

struct TestWindow {
    hwnd: HWND,
    capture: Option<InputCapture>,
}

impl Drop for TestWindow {
    fn drop(&mut self) {
        // Clean up the InputCapture pointer
        unsafe {
            let capture_ptr = GetWindowLongPtrW(self.hwnd, GWLP_USERDATA) as *mut InputCapture;
            if !capture_ptr.is_null() {
                let _ = Box::from_raw(capture_ptr);
            }
            CloseWindow(self.hwnd).unwrap();
            DestroyWindow(self.hwnd).unwrap();
        }
    }
}

// state to capture keyboard input
#[derive(Clone)]
struct InputCapture {
    chars: Arc<Mutex<Vec<char>>>,
}

impl InputCapture {
    fn new() -> Self {
        Self {
            chars: Arc::new(Mutex::new(Vec::new())),
        }
    }

    fn get_chars(&self) -> Vec<char> {
        self.chars.lock().unwrap().clone()
    }
}

// Custom window procedure that captures input
unsafe extern "system" fn capture_input_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_CREATE => {
            // Store the InputCapture pointer in window data
            let create_struct = lparam.0 as *const CREATESTRUCTW;
            let capture_ptr = (*create_struct).lpCreateParams as *mut InputCapture;
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, capture_ptr as isize);
            LRESULT(0)
        }
        WM_CHAR => {
            // Get the InputCapture from window data
            let capture_ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut InputCapture;
            if !capture_ptr.is_null() {
                let capture = &*capture_ptr;
                if let Some(ch) = char::from_u32(wparam.0 as u32) {
                    capture.chars.lock().unwrap().push(ch);
                }
            }
            LRESULT(0)
        }
        WM_DESTROY => {
            PostQuitMessage(0);
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

type ProcType = unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM) -> LRESULT;

extern "system" fn show_window_proc(
    window: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    unsafe {
        match message {
            WM_PAINT => {
                debug!("WM_PAINT");
                let res = ValidateRect(Some(window), None);
                debug_assert!(res.ok().is_ok());
                LRESULT(0)
            }
            WM_DESTROY => {
                debug!("WM_DESTROY");
                PostQuitMessage(0);
                LRESULT(0)
            }
            _ => DefWindowProcA(window, message, wparam, lparam),
        }
    }
}

impl TestWindow {
    fn set_foreground(&self) -> Result<()> {
        unsafe {
            let _ = ShowWindow(self.hwnd, SW_SHOW);
            let _ = SetForegroundWindow(self.hwnd);
            let _ = UpdateWindow(self.hwnd);
            let _ = SetForegroundWindow(self.hwnd);
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
        Ok(())
    }

    fn wait_for_input(&self, timeout_ms: u64) {
        let start = std::time::Instant::now();
        while start.elapsed().as_millis() < timeout_ms as u128 {
            process_messages();
            thread::sleep(Duration::from_millis(10));
        }
    }
}

fn process_messages() {
    unsafe {
        let mut msg = MSG::default();
        while PeekMessageW(&mut msg, None, 0, 0, PM_REMOVE).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}

fn create_input_window(title: PCWSTR, proc_type: ProcType) -> Result<TestWindow> {
    unsafe {
        let instance = GetModuleHandleW(None).unwrap_or_else(|_| HMODULE(std::ptr::null_mut()));
        let instance: HINSTANCE = instance.into();
        debug_assert!(!instance.is_invalid());

        let window_class = w!("show_window");

        // Register window class with our custom proc
        let wc = WNDCLASSW {
            lpfnWndProc: Some(proc_type),
            hInstance: instance,
            lpszClassName: window_class,
            hbrBackground: CreateSolidBrush(COLORREF((COLOR_WINDOW.0 + 1).try_into().unwrap())),
            ..Default::default()
        };

        let _atom = RegisterClassW(&wc);

        let capture = InputCapture::new();

        // Pass InputCapture as lpParam
        let capture_ptr = Box::into_raw(Box::new(capture.clone()));

        // Create window
        let hwnd = CreateWindowExW(
            WINDOW_EX_STYLE(0),
            window_class,
            title,
            WS_OVERLAPPEDWINDOW | WS_VISIBLE,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            400,
            300,
            None,
            None,
            Some(instance),
            Some(capture_ptr as *const _),
        )
        .unwrap();

        // Process pending messages
        process_messages();
        thread::sleep(Duration::from_millis(100));

        Ok(TestWindow {
            hwnd,
            capture: Some(capture),
        })
    }
}

fn create_title_window(title: PCSTR, proc_type: ProcType) -> Result<TestWindow> {
    unsafe {
        let instance = GetModuleHandleA(None)?;
        let instance: HINSTANCE = instance.into();
        debug_assert!(!instance.is_invalid());

        let window_class = s!("input_window");

        // Register window class with our custom proc
        let wc = WNDCLASSA {
            hCursor: LoadCursorW(None, IDC_ARROW)?,
            hInstance: instance,
            lpszClassName: window_class,
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(proc_type),
            ..Default::default()
        };

        let _atom = RegisterClassA(&wc);

        // Create window
        let hwnd = CreateWindowExA(
            WINDOW_EX_STYLE::default(),
            window_class,
            title,
            WS_OVERLAPPEDWINDOW | WS_VISIBLE,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            800,
            600,
            None,
            None,
            Some(instance),
            None,
        )
        .unwrap();

        Ok(TestWindow {
            hwnd,
            capture: None,
        })
    }
}

#[serial]
#[test]
fn test_get_active_window_title_success() {
    let title;
    {
        let window = create_title_window(s!("TITLE_FOOBAR"), show_window_proc).unwrap();
        window.set_foreground().unwrap();
        title = get_foreground_window_title().unwrap();
    }

    assert_eq!(title, "TITLE_FOOBAR\0".to_owned());

    thread::sleep(Duration::from_millis(100));
}

#[serial]
#[test]
fn test_get_active_window_title_doesnt_fail_if_empty_title() {
    let title;
    {
        let window = create_title_window(s!(""), show_window_proc).unwrap();
        window.set_foreground().unwrap();
        title = get_foreground_window_title();
    }

    assert_eq!(title.unwrap(), "".to_owned());

    thread::sleep(Duration::from_millis(100));
}

#[serial]
#[test]
fn test_type_input_success() {
    const TAB: u16 = 0x09;
    let chars;
    {
        let window = create_input_window(w!("foo"), capture_input_proc).unwrap();
        window.set_foreground().unwrap();

        type_input(
            vec![
                0x66, 0x6F, 0x6C, 0x6C, 0x6F, 0x77, 0x5F, 0x74, 0x68, 0x65, TAB, 0x77, 0x68, 0x69,
                0x74, 0x65, 0x5F, 0x72, 0x61, 0x62, 0x62, 0x69, 0x74,
            ],
            vec!["Control".to_owned(), "Alt".to_owned(), "B".to_owned()],
        )
        .unwrap();

        // Wait for and process input messages
        window.wait_for_input(250);

        // Verify captured input
        let capture = window.capture.as_ref().unwrap();
        chars = capture.get_chars();
    }

    assert!(!chars.is_empty(), "No input captured");

    let input_str = String::from_iter(chars.iter());
    let input_str = input_str.replace("\t", "_");

    assert_eq!(input_str, "follow_the_white_rabbit");

    thread::sleep(Duration::from_millis(100));
}
