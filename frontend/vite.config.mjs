import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom' },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor';
          if (id.includes('react-markdown') || id.includes('remark-') || id.includes('rehype-') || id.includes('unified')) return 'markdown';
          if (id.includes('lucide-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 9001,
    proxy: {
      '/api': 'http://127.0.0.1:9002',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 9001,
  },
});
