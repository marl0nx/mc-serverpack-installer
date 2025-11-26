// src/downloadFile.js
import fs from 'fs-extra';
import path from 'node:path';
import axios from 'axios';
import cliProgress from 'cli-progress';
import { log } from './util/logger.js';

/**
 * HEAD to resolve redirect (wget-style)
 */
export async function downloadWgetStyle(url) {
    const head = await axios.head(url, { maxRedirects: 10, validateStatus: null });
    const finalUrl = head.headers.location || head.request?.res?.responseUrl || url;
    return download(finalUrl);
}

/**
 * Download with progress bar, roughly like Python's requests + tqdm.
 * Returns filename.
 */
export async function download(url) {
    const res = await axios.get(url, {
        responseType: 'stream',
        maxRedirects: 10,
        validateStatus: status => status >= 200 && status < 400
    });

    let fileName = url.split('/').pop().split('?')[0] || 'modpack.zip';
    if (!fileName) fileName = 'download.bin';

    const total = Number(res.headers['content-length'] || 0);
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

    if (total > 0) bar.start(total, 0);

    await fs.ensureDir(process.cwd());
    const destPath = path.join(process.cwd(), fileName);
    const writer = fs.createWriteStream(destPath);

    let downloaded = 0;
    await new Promise((resolve, reject) => {
        res.data.on('data', chunk => {
            downloaded += chunk.length;
            if (total > 0) bar.update(downloaded);
            writer.write(chunk);
        });
        res.data.on('end', () => {
            writer.end();
            resolve();
        });
        res.data.on('error', reject);
    });

    if (total > 0) bar.stop();
    log.info(`Finished downloading ${fileName}`);
    return fileName;
}
