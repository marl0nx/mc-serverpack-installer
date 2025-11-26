// src/getForgeOrFabricVersion.js
import fs from 'fs-extra';

/**
 * Reads Curse manifest.json and returns [type, version] like Python:
 *  - fabric: ("fabric", minecraft_version)
 *  - forge: ("forge", minecraft_version + "-" + loaderVersion)
 */
export async function getForgeOrFabricVersionFromManifest(path) {
    const raw = await fs.readFile(path, 'utf8');
    const data = JSON.parse(raw);

    const modloaders = data?.minecraft?.modLoaders || [];
    const minecraftVersion = data?.minecraft?.version;

    for (const ml of modloaders) {
        if (!ml.primary) continue;
        const id = (ml.id || '').toLowerCase();
        if (id.includes('fabric')) {
            return ['fabric', minecraftVersion];
        }
        if (id.includes('forge')) {
            const loaderPart = ml.id.slice('forge-'.length);
            return ['forge', `${minecraftVersion}-${loaderPart}`];
        }
    }
    return null;
}
