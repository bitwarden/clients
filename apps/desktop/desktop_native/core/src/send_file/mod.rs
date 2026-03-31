//! File and directory reading for Bitwarden Send creation.
//!
//! Provides utilities to read files and directories from the local filesystem
//! for creating Sends from the desktop context menu integration. Includes
//! validation and size limits.

use std::{fs, path::Path};

use anyhow::{bail, Context, Result};

/// Maximum total size for a folder send (500 MB).
const MAX_FOLDER_SIZE: u64 = 500 * 1024 * 1024;

/// Metadata about a filesystem path.
pub struct PathInfo {
    /// Whether the path is a directory.
    pub is_directory: bool,
    /// The file or directory name (last path component).
    pub name: String,
    /// The size in bytes (for files) or 0 (for directories).
    pub size: u64,
}

/// A single entry within a directory, with its contents read into memory.
pub struct DirectoryEntry {
    /// The path relative to the selected directory root, using forward slashes.
    pub relative_path: String,
    /// The file contents.
    pub contents: Vec<u8>,
}

/// Get metadata about a filesystem path.
///
/// Returns an error if the path does not exist or is inaccessible.
pub fn get_path_info(path: &str) -> Result<PathInfo> {
    let p = Path::new(path);
    let metadata = fs::metadata(p).with_context(|| format!("Cannot access path: {path}"))?;

    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(PathInfo {
        is_directory: metadata.is_dir(),
        name,
        size: if metadata.is_file() {
            metadata.len()
        } else {
            0
        },
    })
}

/// Read a single file's contents into memory.
pub fn read_file(path: &str) -> Result<Vec<u8>> {
    fs::read(path).with_context(|| format!("Cannot read file: {path}"))
}

/// Recursively read all files in a directory.
///
/// Skips symlinks to avoid loops. Enforces [`MAX_FOLDER_SIZE`] total size limit.
/// Returns entries with forward-slash relative paths.
pub fn read_directory(path: &str) -> Result<Vec<DirectoryEntry>> {
    let root = Path::new(path);
    if !root.is_dir() {
        bail!("Path is not a directory: {path}");
    }

    let mut entries = Vec::new();
    let mut total_size: u64 = 0;

    collect_files(root, root, &mut entries, &mut total_size)?;

    Ok(entries)
}

fn collect_files(
    root: &Path,
    current: &Path,
    entries: &mut Vec<DirectoryEntry>,
    total_size: &mut u64,
) -> Result<()> {
    let dir_entries = fs::read_dir(current)
        .with_context(|| format!("Cannot read directory: {}", current.display()))?;

    for entry in dir_entries {
        let entry = entry?;
        let path = entry.path();

        // Skip symlinks to avoid infinite loops
        if path.is_symlink() {
            continue;
        }

        if path.is_dir() {
            collect_files(root, &path, entries, total_size)?;
        } else if path.is_file() {
            let contents =
                fs::read(&path).with_context(|| format!("Cannot read file: {}", path.display()))?;

            *total_size += contents.len() as u64;
            if *total_size > MAX_FOLDER_SIZE {
                bail!(
                    "Folder exceeds maximum size of {} MB",
                    MAX_FOLDER_SIZE / (1024 * 1024)
                );
            }

            let relative = path
                .strip_prefix(root)
                .with_context(|| "Failed to compute relative path")?
                .to_string_lossy()
                .replace('\\', "/");

            entries.push(DirectoryEntry {
                relative_path: relative,
                contents,
            });
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn test_get_path_info_file() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        fs::write(&file_path, "hello").unwrap();

        let info = get_path_info(file_path.to_str().unwrap()).unwrap();
        assert!(!info.is_directory);
        assert_eq!(info.name, "test.txt");
        assert_eq!(info.size, 5);
    }

    #[test]
    fn test_get_path_info_directory() {
        let dir = tempfile::tempdir().unwrap();
        let info = get_path_info(dir.path().to_str().unwrap()).unwrap();
        assert!(info.is_directory);
    }

    #[test]
    fn test_read_directory() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(dir.path().join("a.txt"), "aaa").unwrap();
        fs::write(sub.join("b.txt"), "bbb").unwrap();

        let entries = read_directory(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 2);

        let paths: Vec<&str> = entries.iter().map(|e| e.relative_path.as_str()).collect();
        assert!(paths.contains(&"a.txt"));
        assert!(paths.contains(&"sub/b.txt"));
    }
}
