import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const resolvedDirettoreEmail =
    process.env.VITE_DIRETTORE_EMAIL ||
    env.VITE_DIRETTORE_EMAIL ||
    '';

  const resolvedAppEnv =
    process.env.VITE_APP_ENV ||
    env.VITE_APP_ENV ||
    'test';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_DIRETTORE_EMAIL': JSON.stringify(resolvedDirettoreEmail),
      'import.meta.env.VITE_APP_ENV': JSON.stringify(resolvedAppEnv),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

