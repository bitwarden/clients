/// Declares multiple napi mirror types under a single namespace string.
///
/// Use this inside a `#[napi] pub mod` to generate mirrored napi types without repeating
/// the namespace on every declaration. The namespace is written once and applied to every
/// entry in the block.
///
/// Each entry is prefixed with either `string_enum` or `object` to select the kind of
/// mirror. Entries may carry outer attributes (`#[doc = "..."]` etc.).
///
/// Because `#[napi] pub mod` proc macros run before inner `macro_rules!` expand, generated
/// items would not be seen by the module proc macro and would end up at the TypeScript root.
/// This macro works around that by attaching `namespace = "..."` directly to each generated
/// `#[napi(...)]` attribute.
///
/// # Example
///
/// ```rust
/// // Inside a `#[napi] pub mod my_module`:
/// napi_mirrors! {
///     "my_module" => {
///         string_enum Direction from some_crate::Direction {
///             North, South,
///         }
///         object Point from some_crate::Point {
///             x: f64,
///             y: f64,
///             label: Option<String>,
///         }
///     }
/// }
/// ```
macro_rules! napi_mirrors {
    // Base case — nothing left to process.
    ($ns:literal => {}) => {};

    // string_enum entry.
    (
        $ns:literal => {
            $(#[$meta:meta])*
            string_enum $Name:ident from $Source:path {
                $( $Variant:ident ),* $(,)?
            }
            $($rest:tt)*
        }
    ) => {
        napi_mirror_string_enum! {
            $(#[$meta])*
            enum $Name from $Source {
                $($Variant,)*
            } in $ns
        }
        napi_mirrors!($ns => { $($rest)* });
    };

    // object entry.
    (
        $ns:literal => {
            $(#[$meta:meta])*
            object $Name:ident from $Source:path {
                $($fields:tt)*
            }
            $($rest:tt)*
        }
    ) => {
        napi_mirror_object! {
            $(#[$meta])*
            struct $Name from $Source {
                $($fields)*
            } in $ns
        }
        napi_mirrors!($ns => { $($rest)* });
    };
}

/// Generates an `#[napi(string_enum)]` enum and a `From<Source>` impl that maps
/// each variant by name.
///
/// Called internally by [`napi_mirrors!`] — prefer that macro at call sites.
///
/// The `} in "namespace"` suffix (after the closing brace) is required. It supplies the
/// namespace explicitly via `#[napi(string_enum, namespace = "...")]`, working around the
/// limitation that `#[napi] pub mod` proc macros cannot see through `macro_rules!`
/// expansions.
macro_rules! napi_mirror_string_enum {
    // The `in "..."` goes after the closing brace because `path` cannot be followed by `in`.
    (
        $(#[$meta:meta])*
        enum $Name:ident from $Source:path {
            $( $Variant:ident ),* $(,)?
        } in $ns:literal
    ) => {
        #[napi(string_enum, namespace = $ns)]
        #[derive(Debug, Clone, PartialEq)]
        $(#[$meta])*
        pub enum $Name {
            $($Variant,)*
        }

        impl From<$Source> for $Name {
            fn from(val: $Source) -> Self {
                use $Source as __Src;
                match val {
                    $(__Src::$Variant => Self::$Variant,)*
                }
            }
        }
    };
}

/// Generates an `#[napi(object)]` struct and a `From<Source>` impl via push-down
/// accumulation, so that the `#[napi(object)]` proc macro sees a complete struct
/// definition rather than an inner macro call.
///
/// Called internally by [`napi_mirrors!`] — prefer that macro at call sites.
///
/// - Plain fields use `.into()`, relying on Rust's identity blanket impl for same-type fields and
///   any explicit `From` impls for mirrored types.
/// - `Option<T>` fields automatically use `.map(Into::into)`, since std has no blanket `impl<T, U:
///   From<T>> From<Option<T>> for Option<U>`.
/// - `Vec<T>` fields automatically use `.into_iter().map(Into::into).collect()`, for the same
///   reason.
///
/// The `} in "namespace"` suffix (after the closing brace) is required. It supplies the
/// namespace explicitly via `#[napi(object, namespace = "...")]`, working around the
/// limitation that `#[napi] pub mod` proc macros cannot see through `macro_rules!`
/// expansions.
macro_rules! napi_mirror_object {
    // Entry point — the `in "..."` goes after the closing brace because `path` cannot be
    // followed by `in`.
    (
        $(#[$meta:meta])*
        struct $Name:ident from $Source:path {
            $($fields:tt)*
        } in $ns:literal
    ) => {
        napi_mirror_object!(
            @collect
            attrs  = [$(#[$meta])*],
            name   = [$Name],
            source = [$Source],
            param  = [val],
            ns     = [$ns],
            sf     = [],
            ff     = [],
            rest   = [$($fields)*]
        );
    };

    // Base case: all fields consumed — emit the struct and From impl.
    (
        @collect
        attrs  = [$($attr:tt)*],
        name   = [$Name:ident],
        source = [$($src:tt)*],
        param  = [$param:ident],
        ns     = [$ns:literal],
        sf     = [$($sf:tt)*],
        ff     = [$($ff:tt)*],
        rest   = []
    ) => {
        #[napi(object, namespace = $ns)]
        #[derive(Debug, Clone, PartialEq)]
        $($attr)*
        pub struct $Name {
            $($sf)*
        }

        impl From<$($src)*> for $Name {
            fn from($param: $($src)*) -> Self {
                Self { $($ff)* }
            }
        }
    };

    // Option<T> field — converted via `.map(Into::into)`, which handles the case where
    // std has no blanket `impl<T, U: From<T>> From<Option<T>> for Option<U>`.
    // This arm must appear before the plain-field arm since `$ty:ty` would also match `Option<T>`.
    (
        @collect
        attrs  = [$($attr:tt)*],
        name   = [$Name:ident],
        source = [$($src:tt)*],
        param  = [$param:ident],
        ns     = [$ns:literal],
        sf     = [$($sf:tt)*],
        ff     = [$($ff:tt)*],
        rest   = [$field:ident : Option<$inner:ty>, $($rest:tt)*]
    ) => {
        napi_mirror_object!(
            @collect
            attrs  = [$($attr)*],
            name   = [$Name],
            source = [$($src)*],
            param  = [$param],
            ns     = [$ns],
            sf     = [$($sf)* pub $field: Option<$inner>,],
            ff     = [$($ff)* $field: $param.$field.map(Into::into),],
            rest   = [$($rest)*]
        );
    };

    // Vec<T> field — converted via `.into_iter().map(Into::into).collect()`, which handles the
    // case where std has no blanket `impl<T, U: From<T>> From<Vec<T>> for Vec<U>`.
    // This arm must appear before the plain-field arm since `$ty:ty` would also match `Vec<T>`.
    (
        @collect
        attrs  = [$($attr:tt)*],
        name   = [$Name:ident],
        source = [$($src:tt)*],
        param  = [$param:ident],
        ns     = [$ns:literal],
        sf     = [$($sf:tt)*],
        ff     = [$($ff:tt)*],
        rest   = [$field:ident : Vec<$inner:ty>, $($rest:tt)*]
    ) => {
        napi_mirror_object!(
            @collect
            attrs  = [$($attr)*],
            name   = [$Name],
            source = [$($src)*],
            param  = [$param],
            ns     = [$ns],
            sf     = [$($sf)* pub $field: Vec<$inner>,],
            ff     = [$($ff)* $field: $param.$field.into_iter().map(Into::into).collect(),],
            rest   = [$($rest)*]
        );
    };

    // Plain field — converted via `.into()` (trailing comma required).
    (
        @collect
        attrs  = [$($attr:tt)*],
        name   = [$Name:ident],
        source = [$($src:tt)*],
        param  = [$param:ident],
        ns     = [$ns:literal],
        sf     = [$($sf:tt)*],
        ff     = [$($ff:tt)*],
        rest   = [$field:ident : $ty:ty, $($rest:tt)*]
    ) => {
        napi_mirror_object!(
            @collect
            attrs  = [$($attr)*],
            name   = [$Name],
            source = [$($src)*],
            param  = [$param],
            ns     = [$ns],
            sf     = [$($sf)* pub $field: $ty,],
            ff     = [$($ff)* $field: $param.$field.into(),],
            rest   = [$($rest)*]
        );
    };
}

#[cfg(test)]
mod tests {
    // ── source types ─────────────────────────────────────────────────────────
    // Simulate types defined in a foreign crate that we want to mirror via napi.

    enum SourceStatus {
        Active,
        Inactive,
    }

    struct SourceRecord {
        id: String,
        active: bool,
        status: Option<SourceStatus>,
        note: Option<String>,
        tags: Vec<SourceStatus>,
        counts: Vec<u32>,
    }

    // ── mirror types ─────────────────────────────────────────────────────────

    napi_mirrors! {
        "test" => {
            string_enum Status from SourceStatus {
                Active, Inactive,
            }
            object Record from SourceRecord {
                id: String,
                active: bool,
                status: Option<Status>,
                note: Option<String>,
                tags: Vec<Status>,
                counts: Vec<u32>,
            }
        }
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    fn make_source(
        status: Option<SourceStatus>,
        note: Option<&str>,
        tags: Vec<SourceStatus>,
    ) -> SourceRecord {
        SourceRecord {
            id: String::new(),
            active: false,
            status,
            note: note.map(str::to_string),
            tags,
            counts: vec![],
        }
    }

    #[test]
    fn string_enum_converts_each_variant() {
        assert_eq!(Status::from(SourceStatus::Active), Status::Active);
        assert_eq!(Status::from(SourceStatus::Inactive), Status::Inactive);
    }

    #[test]
    fn object_plain_fields_are_transferred() {
        let source = SourceRecord {
            id: "abc".to_string(),
            active: true,
            status: None,
            note: None,
            tags: vec![],
            counts: vec![],
        };
        let record = Record::from(source);
        assert_eq!(record.id, "abc");
        assert!(record.active);
    }

    #[test]
    fn object_option_mirrored_type_some_converts() {
        let record = Record::from(make_source(Some(SourceStatus::Active), None, vec![]));
        assert_eq!(record.status, Some(Status::Active));
    }

    #[test]
    fn object_option_none_passes_through() {
        let record = Record::from(make_source(None, None, vec![]));
        assert!(record.status.is_none());
        assert!(record.note.is_none());
    }

    #[test]
    fn object_option_same_type_some_passes_through() {
        let record = Record::from(make_source(None, Some("a note"), vec![]));
        assert_eq!(record.note, Some("a note".to_string()));
    }

    #[test]
    fn object_vec_mirrored_type_converts() {
        let source = make_source(
            None,
            None,
            vec![SourceStatus::Active, SourceStatus::Inactive],
        );
        let record = Record::from(source);
        assert_eq!(record.tags, vec![Status::Active, Status::Inactive]);
    }

    #[test]
    fn object_vec_same_type_passes_through() {
        let mut source = make_source(None, None, vec![]);
        source.counts = vec![1, 2, 3];
        let record = Record::from(source);
        assert_eq!(record.counts, vec![1u32, 2, 3]);
    }

    #[test]
    fn object_vec_empty_passes_through() {
        let record = Record::from(make_source(None, None, vec![]));
        assert!(record.tags.is_empty());
    }
}
