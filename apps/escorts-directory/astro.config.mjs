import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  site: 'https://mansiondeseo.com',
  image: {
    service: { entrypoint: 'astro/assets/services/noop' },
  },
});
