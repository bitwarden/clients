use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

pub fn allow_foreground() -> Arc<AtomicBool> {
    let should_foreground = Arc::new(AtomicBool::new(false));
    let should_foreground_clone = should_foreground.clone();
    let _ = std::thread::spawn(move || loop {
        if !should_foreground_clone.load(Ordering::Relaxed) {
            std::thread::sleep(std::time::Duration::from_millis(100));
            continue;
        }
        should_foreground_clone.store(false, Ordering::Relaxed);

        for _ in 0..60 {
            desktop_core::biometric::windows_focus::focus_security_prompt();
            std::thread::sleep(std::time::Duration::from_millis(1000));
        }
    });

    should_foreground
}
