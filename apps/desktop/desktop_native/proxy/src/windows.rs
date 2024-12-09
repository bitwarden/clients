use std::sync::{atomic::{AtomicBool, Ordering}, Arc};

use windows::{
    core::s,
    Win32::{
        Foundation::HWND,
        UI::{
            Input::KeyboardAndMouse::SetFocus,
            WindowsAndMessaging::{FindWindowA, SetForegroundWindow},
        },
    },
};

pub fn allow_foreground() -> Arc<AtomicBool> {
    let should_foreground = Arc::new(AtomicBool::new(false));
    let should_foreground_clone = should_foreground.clone();
    let _ = tokio::task::spawn_blocking(move || {
        loop {
            if !should_foreground_clone.load(Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_millis(100));
                continue;
            }
            should_foreground_clone.store(false, Ordering::Relaxed);

            for _ in 0..60 {
                focus_security_prompt();
                std::thread::sleep(std::time::Duration::from_millis(1000));
            }
        }
    });

    should_foreground
}

fn focus_security_prompt() -> bool {
    unsafe fn try_find_and_set_focus(
        class_name: windows::core::PCSTR,
    ) -> bool {
        let hwnd = unsafe { FindWindowA(class_name, None) };
        if let Ok(hwnd) = hwnd {
            set_focus(hwnd);
            return true;
        }
       false
    }

    let class_name = s!("Credential Dialog Xaml Host");
    unsafe { try_find_and_set_focus(class_name) }
}


fn set_focus(window: HWND) {
    unsafe {
        SetForegroundWindow(window);
        SetFocus(window);
    }
}