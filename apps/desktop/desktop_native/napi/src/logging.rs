#[napi]
pub mod logging {
    //! `logging` is the interface between the native desktop's usage of the `tracing` crate
    //!  for logging, to intercept events and write to the JS space.
    //!
    //! # Example
    //!
    //! [Elec] 14:34:03.517 › [NAPI] [INFO] desktop_core::ssh_agent::platform_ssh_agent: Starting
    //! SSH Agent server {socket=/Users/foo/.bitwarden-ssh-agent.sock}

    use std::{fmt::Write, sync::OnceLock};

    use napi::{
        bindgen_prelude::FnArgs,
        threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
    };
    use tracing::Level;
    use tracing_subscriber::{
        filter::EnvFilter,
        fmt::format::{DefaultVisitor, Writer},
        layer::SubscriberExt,
        util::SubscriberInitExt,
        Layer,
    };

    struct JsLogger(OnceLock<ThreadsafeFunction<FnArgs<(LogLevel, String)>>>);
    static JS_LOGGER: JsLogger = JsLogger(OnceLock::new());

    #[napi]
    pub enum LogLevel {
        Trace,
        Debug,
        Info,
        Warn,
        Error,
    }

    impl From<&Level> for LogLevel {
        fn from(level: &Level) -> Self {
            match *level {
                Level::TRACE => LogLevel::Trace,
                Level::DEBUG => LogLevel::Debug,
                Level::INFO => LogLevel::Info,
                Level::WARN => LogLevel::Warn,
                Level::ERROR => LogLevel::Error,
            }
        }
    }

    // JsLayer lets us intercept events and write them to the JS Logger.
    struct JsLayer;

    impl<S> Layer<S> for JsLayer
    where
        S: tracing::Subscriber,
    {
        // This function builds a log message buffer from the event data and
        // calls the JS logger with it.
        //
        // For example, this log call:
        //
        // ```
        // mod supreme {
        //   mod module {
        //     let foo = "bar";
        //     info!(best_variable_name = %foo, "Foo done it again.");
        //   }
        // }
        // ```
        //
        // , results in the following string:
        //
        // [INFO] supreme::module: Foo done it again. {best_variable_name=bar}
        fn on_event(
            &self,
            event: &tracing::Event<'_>,
            _ctx: tracing_subscriber::layer::Context<'_, S>,
        ) {
            let mut buffer = String::new();

            // create the preamble text that precedes the message and vars. e.g.:
            //     [INFO] desktop_core::ssh_agent::platform_ssh_agent:
            let level = event.metadata().level().as_str();
            let module_path = event.metadata().module_path().unwrap_or_default();

            write!(&mut buffer, "[{level}] {module_path}:")
                .expect("Failed to write tracing event to buffer");

            let writer = Writer::new(&mut buffer);

            // DefaultVisitor adds the message and variables to the buffer
            let mut visitor = DefaultVisitor::new(writer, false);
            event.record(&mut visitor);

            let msg = (event.metadata().level().into(), buffer);

            if let Some(logger) = JS_LOGGER.0.get() {
                let _ = logger.call(Ok(msg.into()), ThreadsafeFunctionCallMode::NonBlocking);
            };
        }
    }

    #[napi]
    pub fn init_napi_log(js_log_fn: ThreadsafeFunction<FnArgs<(LogLevel, String)>>) {
        let _ = JS_LOGGER.0.set(js_log_fn);

        // the log level hierarchy is determined by:
        //    - if RUST_LOG is detected at runtime
        //    - if RUST_LOG is provided at compile time
        //    - default to INFO
        let filter = EnvFilter::builder()
            .with_default_directive(
                option_env!("RUST_LOG")
                    .unwrap_or("info")
                    .parse()
                    .expect("should provide valid log level at compile time."),
            )
            // parse directives from the RUST_LOG environment variable,
            // overriding the default directive for matching targets.
            .from_env_lossy();

        // With the `tracing-log` feature enabled for the `tracing_subscriber`,
        // the registry below will initialize a log compatibility layer, which allows
        // the subscriber to consume log::Records as though they were tracing Events.
        // https://docs.rs/tracing-subscriber/latest/tracing_subscriber/util/trait.SubscriberInitExt.html#method.init
        tracing_subscriber::registry()
            .with(filter)
            .with(JsLayer)
            .init();
    }
}
