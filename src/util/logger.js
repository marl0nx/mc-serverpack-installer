// src/util/logger.js
export const log = {
    info: (...args) => console.log('[MCI]', ...args),
    warn: (...args) => console.warn('[MCI][WARN]', ...args),
    error: (...args) => console.error('[MCI][ERROR]', ...args)
};
