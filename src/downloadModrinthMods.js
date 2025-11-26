// src/downloadModrinthMods.js
import fs from 'fs-extra';
import path from 'node:path';
import axios from 'axios';
import { download } from './downloadFile.js';
import { log } from './util/logger.js';

/**
 * Download mods defined in a Modrinth pack index JSON.
 */
export async function downloadModrinthMods(indexPath) {
    const raw = await fs.readFile(indexPath, 'utf8');
    const data = JSON.parse(raw);

    log.info('Starting download of Modrinth modpack server mods...');
    for (const mod of data.files || []) {
        try {
            const modFilename = path.basename(mod.path);
            const url = mod.downloads?.[0];
            if (!url) {
                log.warn(`No download URL for ${modFilename}`);
                continue;
            }
            log.info(`Downloading ${modFilename} ...`);
            await download(url);
        } catch (err) {
            log.warn(`Error downloading Modrinth mod: ${err.message}`);
        }
    }
    log.info('Finished downloading Modrinth mods.');
}

/**
 * Move overrides folder (e.g., from .mrpack structure) into target root.
 */
export async function moveModrinthOverrides(overridesPath, targetRoot) {
    if (!(await fs.pathExists(overridesPath))) return;
    log.info(`Moving Modrinth overrides from ${overridesPath} to ${targetRoot}`);
    await fs.copy(overridesPath, targetRoot, { overwrite: true });
}

/**
 * Grab vanilla / loader server jars based on Modrinth dependencies.
 * This collapses some of the logic from the Python version but preserves behavior.
 */
export async function grabModrinthServerJars(dependencies, targetDir) {
    const dependencyNames = Object.keys(dependencies || {});
    const mcVersion = dependencies?.minecraft;

    if (!mcVersion) {
        log.warn('No minecraft dependency, skipping server jar download.');
        return;
    }

    // Download vanilla server jar from Mojang manifest:
    try {
        const manifestUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
        const manifest = (await axios.get(manifestUrl, { timeout: 60000 })).data;
        const version = manifest.versions.find(v => v.id === mcVersion);
        if (version) {
            const versionInfo = (await axios.get(version.url)).data;
            const serverUrl = versionInfo.downloads?.server?.url;
            if (serverUrl) {
                log.info(`Downloading vanilla server ${mcVersion}...`);
                const vanillaFile = await download(serverUrl);
                await fs.move(vanillaFile, path.join(targetDir, 'vanilla.jar'), { overwrite: true });
            }
        }
    } catch (err) {
        log.warn(`Error downloading vanilla server jar: ${err.message}`);
    }

    // Fabric loader
    if (dependencyNames.includes('fabric-loader')) {
        const fabricLoaderVersion = dependencies['fabric-loader'];
        log.info(`Found Fabric ${fabricLoaderVersion}, downloading installer...`);
        const installerUrl =
            'https://maven.fabricmc.net/net/fabricmc/fabric-installer/0.10.2/fabric-installer-0.10.2.jar';
        const installerFile = await download(installerUrl);
        await fs.move(installerFile, path.join(targetDir, 'fabric-installer.jar'), { overwrite: true });
    }

    // Forge / NeoForged can be wired similarly if needed.
}
