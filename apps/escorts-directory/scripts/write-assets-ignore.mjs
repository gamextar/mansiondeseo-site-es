import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await writeFile('dist/.assetsignore', '_worker.js\n_routes.json\n');
