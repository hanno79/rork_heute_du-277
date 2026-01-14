const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude test-related packages from the bundle
config.resolver.blockList = [
  /node_modules[\/\\]jest[\/\\].*/,
  /node_modules[\/\\]@jest[\/\\].*/,
  /node_modules[\/\\]jest-.*[\/\\].*/,
  /node_modules[\/\\]@pkgr[\/\\].*/,
  /node_modules[\/\\]synckit[\/\\].*/,
  /node_modules[\/\\]ts-jest[\/\\].*/,
];

// Add resolver configuration to handle platform-specific modules
config.resolver.platforms = ['native', 'ios', 'android', 'web'];

// Block Stripe modules on web platform
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Custom resolver to block Stripe on web
const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Block Stripe modules on web platform
  if (platform === 'web' && moduleName.includes('@stripe/stripe-react-native')) {
    // Return a mock module path that exports empty objects
    return {
      filePath: require.resolve('./stripe-web-mock.js'),
      type: 'sourceFile',
    };
  }

  // Use the original resolver for all other cases
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }

  // Fallback to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
