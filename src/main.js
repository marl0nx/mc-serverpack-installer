// src/main.js
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawn } from 'node:child_process';
import { log } from './util/logger.js';
import { download, downloadWgetStyle } from './downloadFile.js';
import { unzip } from './unzipModpack.js';
import {
    getServerModpackUrl,
    getModpackMinecraftVersion
} from './getModpackInfo.js';
import { downloadManifestMods } from './downloadManifestMods.js';
import {
    downloadModrinthMods,
    moveModrinthOverrides,
    grabModrinthServerJars
} from './downloadModrinthMods.js';
import { getForgeOrFabricVersionFromManifest } from './getForgeOrFabricVersion.js';
import {
    upOneDirectory,
    deleteDirectory,
    deleteTreeDirectory
} from './util/fsHelpers.js';
import { changeInstallPath } from './serverstarter.js';

export async function runInstaller(opts) {
    let {
        provider,
        modpackId,
        modpackVersion,
        pterodactyl,
        cleanScripts,
        update,
        folderName: explicitFolderName,
        workingPath,
        manifestApiKey,
        wgetMode
    } = opts;

    const operatingSystem = os.platform().startsWith('win') ? 'Windows' : 'Linux';
    const architecture = os.arch();
    log.info(`Detected OS ${operatingSystem}, arch ${architecture}`);

    // Use explicit workingPath if provided, otherwise stay in the current directory
    const thisDir = workingPath || process.cwd();
    process.chdir(thisDir);


    // Minecraft version for logging – same as run.py
    let minecraftVersion;
    if (['curse', 'technic', 'ftb', 'modrinth'].includes(provider)) {
        minecraftVersion =
            (await getModpackMinecraftVersion(provider, modpackId)) || 'unknown';
    } else {
        minecraftVersion = 'unknown';
    }

    const [modpackName, modpackUrls, modpackNormalDownloadUrl] =
    (await getServerModpackUrl(
        provider,
        modpackId,
        modpackVersion,
        operatingSystem,
        architecture
    )) || [];

    if (!modpackName) {
        log.error('Modpack info not provided. Exiting.');
        process.exit(1);
    }

    log.info(`Modpack: ${modpackName} (MC ${minecraftVersion})`);
    log.info(modpackUrls);

    // Choose download URL in same priority order as run.py
    let downloadUrl = null;
    if (modpackUrls.SpecifiedVersion) {
        log.info(`Downloading specified version of ${modpackName}...`);
        downloadUrl = modpackUrls.SpecifiedVersion;
    } else if (modpackUrls.LatestReleaseServerpack) {
        log.info(`Downloading latest release serverpack of ${modpackName}...`);
        downloadUrl = modpackUrls.LatestReleaseServerpack;
    } else if (
        !modpackUrls.LatestReleaseServerpack &&
        modpackUrls.LatestBetaServerpack
    ) {
        log.info(`Downloading latest beta serverpack of ${modpackName}...`);
        downloadUrl = modpackUrls.LatestBetaServerpack;
    } else if (
        !modpackUrls.LatestReleaseServerpack &&
        !modpackUrls.LatestBetaServerpack &&
        modpackUrls.LatestAlphaServerpack
    ) {
        log.info(`Downloading latest alpha serverpack of ${modpackName}...`);
        downloadUrl = modpackUrls.LatestAlphaServerpack;
    } else if (
        !modpackUrls.LatestReleaseServerpack &&
        !modpackUrls.LatestBetaServerpack &&
        !modpackUrls.LatestAlphaServerpack &&
        modpackUrls.LatestReleaseNonServerpack
    ) {
        log.info(`Downloading latest non-serverpack of ${modpackName}...`);
        downloadUrl = modpackUrls.LatestReleaseNonServerpack;
    }

    if (!downloadUrl) {
        log.error('No download URL available, exiting.');
        process.exit(1);
    }

    // For FTB, run as binary (wget style); otherwise normal download+unzip
    let filename;
    if (provider === 'ftb' || wgetMode) {
        filename = await downloadWgetStyle(downloadUrl);
        await runExecutable(filename, thisDir);
        await fs.remove(filename);
        log.info('Finished running FTB server install binary.');
        return;
    } else {
        filename = await download(downloadUrl);
    }

    // Unzip archive
    log.info('Extracting downloaded modpack archive...');
    const fileExt = path.extname(filename);
    const extractedFolderName = await unzip(
        filename,
        modpackName,
        fileExt,
        thisDir,
        explicitFolderName || false
    );
    const modpackFolderPath = path.join(thisDir, extractedFolderName);

    // Handle nested folder / double-foldered zips (same logic as run.py)
    let existingSubdir = null;
    for (const name of await fs.readdir(modpackFolderPath)) {
        const full = path.join(modpackFolderPath, name);
        if (await fs.stat(full).then(s => s.isDirectory())) {
            const inner = await fs.readdir(full);
            if (
                inner.some(
                    f => f === 'mods' || f.endsWith('.sh') || f.endsWith('.bat')
                )
            ) {
                existingSubdir = full;
                break;
            }
        }
    }

    if (existingSubdir) {
        log.info('Found nested folder, moving contents to parent directory...');
        const subfolderName = path.basename(existingSubdir);
        await upOneDirectory(modpackFolderPath, subfolderName);
        await deleteDirectory(existingSubdir);
    }

    // Update mode: delete old mods/libs etc.
    if (update) {
        log.info('Update mode enabled. Cleaning old mods and libraries...');
        const patterns = ['libraries', 'mods', 'coremods', '.fabric'];
        for (const p of patterns) {
            const full = path.join(thisDir, p);
            if (await fs.pathExists(full)) {
                log.info(`Deleting ${full}...`);
                await deleteTreeDirectory(full);
            }
        }
    }

    // Manifest-based installer: look for manifest.json & download mods
    const manifestPath = path.join(modpackFolderPath, 'manifest.json');
    if (await fs.pathExists(manifestPath) && manifestApiKey) {
        log.info('Running manifest installer...');
        const modsDir = path.join(modpackFolderPath, 'mods');
        await fs.ensureDir(modsDir);
        process.chdir(modsDir);
        await downloadManifestMods(manifestPath, manifestApiKey);
        process.chdir(modpackFolderPath);
    }

    // Modrinth: find modrinth.index.json / overrides etc.
    const modrinthIndex = path.join(modpackFolderPath, 'modrinth.index.json');
    if (await fs.pathExists(modrinthIndex)) {
        log.info('Running Modrinth installer logic...');
        const modsDir = path.join(modpackFolderPath, 'mods');
        await fs.ensureDir(modsDir);
        process.chdir(modsDir);
        await downloadModrinthMods(modrinthIndex);
        process.chdir(modpackFolderPath);

        const overridesPath = path.join(modpackFolderPath, 'overrides');
        if (await fs.pathExists(overridesPath)) {
            await moveModrinthOverrides(overridesPath, modpackFolderPath);
        }

        const indexRaw = await fs.readFile(modrinthIndex, 'utf8');
        const indexData = JSON.parse(indexRaw);
        await grabModrinthServerJars(indexData.dependencies, modpackFolderPath);
    }

    // Detect forge/fabric version from manifest
    if (await fs.pathExists(manifestPath)) {
        const ff = await getForgeOrFabricVersionFromManifest(manifestPath);
        if (ff) {
            const [kind, version] = ff;
            log.info(`Detected ${kind} version from manifest: ${version}`);
        }
    }

    // Clean scripts if requested
    if (cleanScripts) {
        log.info('Removing startup scripts (.sh / .bat)...');
        const entries = await fs.readdir(modpackFolderPath);
        for (const e of entries) {
            if (e.endsWith('.sh') || e.endsWith('.bat')) {
                await fs.remove(path.join(modpackFolderPath, e));
            }
        }
    }

    log.info(`Finished downloading and installing modpack ${modpackName}! :)`);
}

async function runExecutable(filename, cwd) {
    return new Promise((resolve, reject) => {
        const proc = spawn(filename, {
            cwd,
            shell: true,
            stdio: 'inherit'
        });
        proc.on('exit', code => {
            if (code === 0) resolve();
            else {
                log.warn(`Installer exited with code ${code}, continuing.`);
                resolve();
            }
        });
        proc.on('error', reject);
    });
}
