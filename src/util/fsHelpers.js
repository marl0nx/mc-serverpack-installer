// src/util/fsHelpers.js
import fs from 'fs-extra';
import path from 'node:path';

export async function upOneDirectory(rootDir, subDir) {
    const subPath = path.join(rootDir, subDir);
    const entries = await fs.readdir(subPath);
    for (const entry of entries) {
        const from = path.join(subPath, entry);
        const to = path.join(rootDir, entry);
        await fs.move(from, to, { overwrite: true });
    }
}

export async function deleteDirectory(dir) {
    await fs.remove(dir);
}

export async function deleteTreeDirectory(dir) {
    await fs.remove(dir);
}
