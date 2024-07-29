use anyhow::Result;

pub fn hello_world(value: String) -> Result<String> {
    Ok(value)
}

#[cfg(test)]
mod tests {
    // use super::*;
}
