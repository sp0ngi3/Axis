import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildId = new Date().toISOString();

export default defineConfig({
  define: {
    __AXIS_BUILD_ID__: JSON.stringify(buildId)
  },
  plugins: [
    react(),
    {
      name: 'axis-build-info',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'build.json',
          source: JSON.stringify({ buildId, builtAt: buildId })
        });
      }
    }
  ],
  server: {
    port: 5174,
    strictPort: true
  }
});
