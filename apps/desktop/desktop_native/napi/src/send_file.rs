#[napi]
pub mod send_file {
    use napi::bindgen_prelude::Buffer;

    /// Metadata about a filesystem path.
    #[napi(object)]
    pub struct PathInfo {
        pub is_directory: bool,
        pub name: String,
        /// Size in bytes. Uses f64 because NAPI does not support u64.
        pub size: f64,
    }

    /// A single file entry within a directory.
    #[napi(object)]
    pub struct DirectoryEntry {
        /// Relative path using forward slashes.
        pub relative_path: String,
        /// Raw file contents.
        pub contents: Buffer,
    }

    /// Get metadata about a filesystem path.
    #[napi]
    pub fn get_path_info(path: String) -> napi::Result<PathInfo> {
        let info = desktop_core::send_file::get_path_info(&path)?;
        Ok(PathInfo {
            is_directory: info.is_directory,
            name: info.name,
            size: info.size as f64,
        })
    }

    /// Read a single file's contents.
    #[napi]
    pub fn read_file(path: String) -> napi::Result<Buffer> {
        let data = desktop_core::send_file::read_file(&path)?;
        Ok(data.into())
    }

    /// Recursively read all files in a directory. Skips symlinks. Enforces a
    /// 500 MB total size limit.
    #[napi]
    pub fn read_directory(path: String) -> napi::Result<Vec<DirectoryEntry>> {
        let entries = desktop_core::send_file::read_directory(&path)?;
        Ok(entries
            .into_iter()
            .map(|e| DirectoryEntry {
                relative_path: e.relative_path,
                contents: e.contents.into(),
            })
            .collect())
    }
}
