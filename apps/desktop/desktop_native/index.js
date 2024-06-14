const { existsSync, readFileSync } = require('fs')
const { join } = require('path')

const { platform, arch } = process

let nativeBinding = null
let localFileExisted = false
let loadError = null

function isMusl() {
  // For Node 10
  if (!process.report || typeof process.report.getReport !== 'function') {
    try {
      return readFileSync('/usr/bin/ldd', 'utf8').includes('musl')
    } catch (e) {
      return true
    }
  } else {
    const { glibcVersionRuntime } = process.report.getReport().header
    return !glibcVersionRuntime
  }
}

switch (platform) {
  case 'android':
    switch (arch) {
      case 'arm64':
        localFileExisted = existsSync(join(__dirname, 'desktop_native.android-arm64.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./desktop_native.android-arm64.node')
          } else {
            nativeBinding = require('@bitwarden/desktop-native-android-arm64')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm':
        localFileExisted = existsSync(join(__dirname, 'desktop_native.android-arm-eabi.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./desktop_native.android-arm-eabi.node')
          } else {
            nativeBinding = require('@bitwarden/desktop-native-android-arm-eabi')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Android ${arch}`)
    }
    break
  case 'win32':
    switch (arch) {
      case 'x64':
        localFileExisted = existsSync(
          join(__dirname, 'desktop_native.win32-x64-msvc.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./desktop_native.win32-x64-msvc.node')
          } else {
            nativeBinding = require('@bitwarden/desktop-native-win32-x64-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'ia32':
        localFileExisted = existsSync(
          join(__dirname, 'desktop_native.win32-ia32-msvc.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./desktop_native.win32-ia32-msvc.node')
          } else {
            nativeBinding = require('@bitwarden/desktop-native-win32-ia32-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        localFileExisted = existsSync(
          join(__dirname, 'desktop_native.win32-arm64-msvc.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./desktop_native.win32-arm64-msvc.node')
          } else {
            nativeBinding = require('@bitwarden/desktop-native-win32-arm64-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Windows: ${arch}`)
    }
    break
  case 'darwin':
    switch (arch) {
      case 'x64':
        localFileExisted = existsSync(join(__dirname, 'desktop_native.darwin-x64.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./desktop_native.darwin-x64.node')
          } else {
            nativeBinding = require('@bitwarden/desktop-native-darwin-x64')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        localFileExisted = existsSync(
          join(__dirname, 'desktop_native.darwin-arm64.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./desktop_native.darwin-arm64.node')
          } else {
            nativeBinding = require('@bitwarden/desktop-native-darwin-arm64')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on macOS: ${arch}`)
    }
    break
  case 'freebsd':
    if (arch !== 'x64') {
      throw new Error(`Unsupported architecture on FreeBSD: ${arch}`)
    }
    localFileExisted = existsSync(join(__dirname, 'desktop_native.freebsd-x64.node'))
    try {
      if (localFileExisted) {
        nativeBinding = require('./desktop_native.freebsd-x64.node')
      } else {
        nativeBinding = require('@bitwarden/desktop-native-freebsd-x64')
      }
    } catch (e) {
      loadError = e
    }
    break
  case 'linux':
    switch (arch) {
      case 'x64':
        localFileExisted = existsSync(
          join(__dirname, 'desktop_native.linux-x64-musl.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./desktop_native.linux-x64-musl.node')
          } else {
            nativeBinding = require('@bitwarden/desktop-native-linux-x64-musl')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        localFileExisted = existsSync(
          join(__dirname, 'desktop_native.linux-arm64-musl.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./desktop_native.linux-arm64-musl.node')
          } else {
            nativeBinding = require('@bitwarden/desktop-native-linux-arm64-musl')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm':
        localFileExisted = existsSync(
          join(__dirname, 'desktop_native.linux-arm-gnueabihf.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./desktop_native.linux-arm-gnueabihf.node')
          } else {
            nativeBinding = require('@bitwarden/desktop-native-linux-arm-gnueabihf')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Linux: ${arch}`)
    }
    break
  default:
    throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`)
}

if (!nativeBinding) {
  if (loadError) {
    throw loadError
  }
  throw new Error(`Failed to load native binding`)
}

const { passwords, biometrics, clipboards, passkeyclients } = nativeBinding

module.exports.passwords = passwords
module.exports.biometrics = biometrics
module.exports.clipboards = clipboards
module.exports.passkeyclients = passkeyclients
