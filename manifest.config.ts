import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

/** Static host permissions: ONLY the four supported job boards. */
export const SUPPORTED_HOSTS = [
  'https://*.stepstone.de/*',
  'https://*.stepstone.at/*',
  'https://*.indeed.com/*',
  'https://*.linkedin.com/*',
  'https://*.xing.com/*',
];

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  description: '__MSG_extDescription__',
  default_locale: 'en',
  minimum_chrome_version: '116',
  version: pkg.version,
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_title: 'Sanjob',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
    },
  },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
  permissions: [
    'activeTab',
    'scripting',
    'storage',
    'sidePanel',
    'alarms',
    'tabs',
    'notifications',
  ],
  host_permissions: SUPPORTED_HOSTS,
  // Generic fallback mode: access to other sites is requested per origin at runtime.
  optional_host_permissions: ['https://*/*', 'http://*/*'],
});
