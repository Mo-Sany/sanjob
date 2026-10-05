import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';

/**
 * CRXJS lists scripts imported with `?iife` under web_accessible_resources for all sites.
 * Sanjob injects its content script with chrome.scripting.executeScript, which does not need
 * that, and exposing it would let any website detect the extension. Remove the entry.
 */
function stripWebAccessibleResources(): Plugin & {
  renderCrxManifest: (manifest: Record<string, unknown>) => Record<string, unknown>;
} {
  return {
    name: 'sanjob:strip-web-accessible-resources',
    enforce: 'post',
    renderCrxManifest(manifest) {
      delete manifest['web_accessible_resources'];
      return manifest;
    },
  };
}

export default defineConfig({
  plugins: [preact(), tailwindcss(), crx({ manifest }), stripWebAccessibleResources()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    sourcemap: false,
  },
});
