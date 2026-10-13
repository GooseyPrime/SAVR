import { defineConfig } from 'eslint/config';

const shared = { settings: { next: { rootDir: 'apps/*' } } };

export default defineConfig([{ files: ['**/*.js'], extends: [shared] }]);
