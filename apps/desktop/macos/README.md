# MacOS Extensions for Desktop Apps

This folder contains an Xcode project that builds macOS extensions for our desktop app. The extensions are used to provide additional functionality to the desktop app, such as autofill (password and passkeys).

## Manage loaded extensions

macOS automatically loads extensions from apps, even if they have never been used (especially if built with Xcode). This can be confusing when you have multiple copies of the same application. To see where an extension is loaded from, use the following command:

```bash
# To list all extensions
pluginkit -m -v

# To list a specific extension
pluginkit -m -v -i com.bitwarden.desktop.autofill-extension
```

To unregister an extension, you can either remove it from your filesystem, or use the following command:

```bash
pluginkit -r <path to .appex>
```

where the path to the .appex file can be found in the output of the first command.
