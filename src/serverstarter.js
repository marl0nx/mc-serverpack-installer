// src/serverstarter.js
import fs from 'fs-extra';
import YAML from 'yaml';

/**
 * Change install.baseInstallPath in serverstarter.yml (or similar).
 */
export async function changeInstallPath(yamlFile, installPath) {
    const raw = await fs.readFile(yamlFile, 'utf8');
    const data = YAML.parse(raw);
    if (!data.install) data.install = {};
    data.install.baseInstallPath = installPath;
    const out = YAML.stringify(data);
    await fs.writeFile(yamlFile, out, 'utf8');
}
