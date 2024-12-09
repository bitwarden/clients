use std::collections::HashMap;

#[derive(Clone)]
pub struct EphemeralValueStore {
    values: HashMap<String, String>,
}

impl EphemeralValueStore {
    pub fn new() -> Self {
        EphemeralValueStore {
            values: HashMap::new(),
        }
    }

    pub fn set(&mut self, key: String, value: String) {
        self.values.insert(key, value);
    }

    pub fn get(&self, key: &str) -> Option<&String> {
        self.values.get(key)
    }

    pub fn remove(&mut self, key: &str) {
        self.values.remove(key);
    }
}
