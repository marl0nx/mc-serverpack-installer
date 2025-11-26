// src/downloadManifestMods.js
import fs from 'fs-extra';
import axios from 'axios';
import path from 'node:path';
import { download } from './downloadFile.js';
import { log } from './util/logger.js';

export async function downloadManifestMods(manifestPath, apiKey) {
    const raw = await fs.readFile(manifestPath, 'utf8');
    const data = JSON.parse(raw);

    log.info('Starting download of manifest server mods...');
    for (const mod of data.files || []) {
        let modId, fileId;
        try {
            modId = mod.projectID || mod.projectId || mod.projectId;
            fileId = mod.fileID || mod.fileId;
        } catch {
            continue;
        }
        if (!modId || !fileId) continue;

        try {
            const url = `https://api.hypesrv.net/v2/modpack/fileUrl/${modId}/${fileId}`;
            log.info(url);
            const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
            const resp = await axios.get(url, { timeout: 60000, headers });
            const info = resp.data?.data;
            if (!info?.downloadUrl) {
                log.warn(`No downloadUrl for mod ${modId}/${fileId}`);
                continue;
            }
            log.info(`Downloading ${info.displayName || info.fileName}...`);
            await download(info.downloadUrl);
        } catch (err) {
            log.warn(`Error downloading mod ${modId}/${fileId}: ${err.message}`);
        }
    }
    log.info('Finished downloading all server mods from modpack manifest.');
}
