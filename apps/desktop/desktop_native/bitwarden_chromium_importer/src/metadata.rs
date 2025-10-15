use std::collections::{HashMap, HashSet};

use crate::{chromium::InstalledBrowserRetriever, PLATFORM_SUPPORTED_BROWSERS};

#[napi(object)]
/// Mechanisms that load data into the importer
pub struct ImporterMetadata {
    /// Identifies the importer
    pub id: String,
    /// Describes the strategies used to obtain imported data
    pub loaders: Vec<&'static str>,
    /// Identifies the instructions for the importer
    pub instructions: &'static str,
}

/// Returns a map of supported importers based on the current platform.
///
/// Only browsers listed in PLATFORM_SUPPORTED_BROWSERS will have the "chromium" loader.
/// All importers will have the "file" loader.
pub fn get_supported_importers<T: InstalledBrowserRetriever>() -> HashMap<String, ImporterMetadata>
{
    let mut map = HashMap::new();

    // Check for installed browsers
    let installed_browsers = T::get_installed_browsers().unwrap_or_default();

    const IMPORTERS: [(&str, &str); 6] = [
        ("chromecsv", "Chrome"),
        ("chromiumcsv", "Chromium"),
        ("bravecsv", "Brave"),
        ("operacsv", "Opera"),
        ("vivaldicsv", "Vivaldi"),
        ("edgecsv", "Microsoft Edge"),
    ];

    let supported: HashSet<&'static str> =
        PLATFORM_SUPPORTED_BROWSERS.iter().map(|b| b.name).collect();

    for (id, browser_name) in IMPORTERS {
        let mut loaders: Vec<&'static str> = vec!["file"];
        if supported.contains(browser_name) {
            loaders.push("chromium");
        }

        if installed_browsers.is_empty() || installed_browsers.contains(&browser_name.to_string()) {
            map.insert(
                id.to_string(),
                ImporterMetadata {
                    id: id.to_string(),
                    loaders,
                    instructions: "chromium",
                },
            );
        }
    }

    map
}

/*
    Tests are cfg-gated based upon OS, and must be compiled/run on each OS for full coverage
*/
#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    use crate::chromium::{InstalledBrowserRetriever, SUPPORTED_BROWSER_MAP};

    pub struct MockInstalledBrowserRetriever {}

    impl InstalledBrowserRetriever for MockInstalledBrowserRetriever {
        fn get_installed_browsers() -> Result<Vec<String>, anyhow::Error> {
            Ok(SUPPORTED_BROWSER_MAP
                .keys()
                .map(|browser| browser.to_string())
                .collect())
        }
    }

    fn map_keys(map: &HashMap<String, ImporterMetadata>) -> HashSet<String> {
        map.keys().cloned().collect()
    }

    fn get_loaders(map: &HashMap<String, ImporterMetadata>, id: &str) -> HashSet<&'static str> {
        map.get(id)
            .map(|m| m.loaders.iter().copied().collect::<HashSet<_>>())
            .unwrap_or_default()
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_returns_all_known_importers() {
        let map = get_supported_importers::<MockInstalledBrowserRetriever>();

        let expected: HashSet<String> = HashSet::from([
            "chromecsv".to_string(),
            "chromiumcsv".to_string(),
            "bravecsv".to_string(),
            "operacsv".to_string(),
            "vivaldicsv".to_string(),
            "edgecsv".to_string(),
        ]);
        assert_eq!(map.len(), expected.len());
        assert_eq!(map_keys(&map), expected);

        for (key, meta) in map.iter() {
            assert_eq!(&meta.id, key);
            assert_eq!(meta.instructions, "chromium");
            assert!(meta.loaders.iter().any(|l| *l == "file"));
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_specific_loaders_match_const_array() {
        let map = get_supported_importers::<MockInstalledBrowserRetriever>();
        let ids = [
            "chromecsv",
            "chromiumcsv",
            "bravecsv",
            "operacsv",
            "vivaldicsv",
            "edgecsv",
        ];
        for id in ids {
            let loaders = get_loaders(&map, id);
            assert!(loaders.contains("file"));
            assert!(loaders.contains("chromium"), "missing chromium for {id}");
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn returns_all_known_importers() {
        let map = get_supported_importers::<MockInstalledBrowserRetriever>();

        let expected: HashSet<String> = HashSet::from([
            "chromecsv".to_string(),
            "chromiumcsv".to_string(),
            "bravecsv".to_string(),
            "operacsv".to_string(),
        ]);
        assert_eq!(map.len(), expected.len());
        assert_eq!(map_keys(&map), expected);

        for (key, meta) in map.iter() {
            assert_eq!(&meta.id, key);
            assert_eq!(meta.instructions, "chromium");
            assert!(meta.loaders.iter().any(|l| *l == "file"));
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_specific_loaders_match_const_array() {
        let map = get_supported_importers::<MockInstalledBrowserRetriever>();
        let ids = ["chromecsv", "chromiumcsv", "bravecsv", "operacsv"];

        for id in ids {
            let loaders = get_loaders(&map, id);
            assert!(loaders.contains("file"));
            assert!(loaders.contains("chromium"), "missing chromium for {id}");
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn returns_all_known_importers() {
        let map = get_supported_importers::<MockInstalledBrowserRetriever>();

        let expected: HashSet<String> = HashSet::from([
            "chromiumcsv".to_string(),
            "edgecsv".to_string(),
            "operacsv".to_string(),
            "vivaldicsv".to_string(),
        ]);
        assert_eq!(map.len(), expected.len());
        assert_eq!(map_keys(&map), expected);

        for (key, meta) in map.iter() {
            assert_eq!(&meta.id, key);
            assert_eq!(meta.instructions, "chromium");
            assert!(meta.loaders.iter().any(|l| *l == "file"));
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_specific_loaders_match_const_array() {
        let map = get_supported_importers::<MockInstalledBrowserRetriever>();
        let ids = ["chromiumcsv", "edgecsv", "operacsv", "vivaldicsv"];

        for id in ids {
            let loaders = get_loaders(&map, id);
            assert!(loaders.contains("file"));
            assert!(loaders.contains("chromium"), "missing chromium for {id}");
        }
    }
}
