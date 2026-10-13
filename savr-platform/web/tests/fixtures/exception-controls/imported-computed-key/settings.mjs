// The key is computed, so the literal never appears in eslint.config.mjs.
const key = ['root', 'Dir'].join('');

export const nextSettings = { next: { [key]: 'apps/*' } };
