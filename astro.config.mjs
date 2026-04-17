import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mansiondeseo.com',
  srcDir: './astro-src',
  publicDir: './astro-public',
  outDir: './dist-astro',
  build: {
    format: 'directory',
  },
});
