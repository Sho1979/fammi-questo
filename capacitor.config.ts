import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fammiquesto.app',
  appName: 'Fammi Questo',
  webDir: 'dist',
  android: {
    backgroundColor: '#6C5CE7',
    allowMixedContent: false,
  },
  ios: {
    backgroundColor: '#6C5CE7',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Fammi Questo',
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
};

export default config;
