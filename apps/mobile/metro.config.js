const { getDefaultConfig } = require("expo/metro-config")

const config = getDefaultConfig(__dirname)

// react-native 0.83.x has broken `exports` entries (e.g. LoadingView) and
// react-native-webrtc references event-target-shim/index outside its exports map.
// Metro warns and falls back to file-based resolution in both cases — which works fine.
// Disabling exports resolution makes file-based resolution the default, silencing the noise.
config.resolver.unstable_enablePackageExports = false

module.exports = config
