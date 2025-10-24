const path = require('path')

module.exports = {
  reactStrictMode: true,
  output: 'standalone',
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'shims/async-storage.ts'),
    }
    return config
  },
}
