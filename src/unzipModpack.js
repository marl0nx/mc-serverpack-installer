// src/unzipModpack.js
import path from 'node:path';
import fs from 'fs-extra';
import AdmZip from 'adm-zip';
import { log } from './util/logger.js';

/**
 * Unzip downloaded archive.
 * Rough behavior: extract to <thisDir>/<output || modpackNameSanitized>
 * and return the folder name (not full path).
 */
export async function unzip(zipName, modpackName, fileExt, thisDir, output = false) {
    const extractDir = path.join(
        thisDir,
        output || modpackName.replace(/[:,\s]/g, '_')
    );

    const archive = path.join(thisDir, zipName);
    log.info(`Unpacking ${archive} -> ${extractDir}`);
    await fs.ensureDir(extractDir);

    const zip = new AdmZip(archive);
    zip.extractAllTo(extractDir, true);

    log.info('Extraction done, deleting zip');
    await fs.remove(archive);
    return path.basename(extractDir);
}
