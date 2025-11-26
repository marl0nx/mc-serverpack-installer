// src/getModpackInfo.js
import axios from 'axios';
import { log } from './util/logger.js';

export async function getModpackMinecraftVersion(provider, modpackId) {
    try {
        if (provider === 'modrinth') {
            const url = `https://api.modrinth.com/v2/project/${modpackId}/version`;
            const resp = await axios.get(url, {
                headers: {
                    'user-agent':
                        'Mozilla/5.0 (compatible; mc-serverpack-installer-node)',
                    referer: 'https://api.modrinth.com/'
                },
                timeout: 60000
            });
            return resp.data?.[0]?.game_versions?.[0] || false;
        }

        // For curse / technic / ftb, you can reproduce the full logic if you like.
        // Here we just stub to "unknown" to keep parity with run.py behavior when failing.
        return false;
    } catch {
        return false;
    }
}

/**
 * Return [modpackName, urlsMap, normalDownloadUrl]
 */
export async function getServerModpackUrl(
    provider,
    modpackId,
    modpackVersion,
    operatingSystem,
    architecture
) {
    if (provider === 'direct') {
        const name = 'Direct_Download';
        const urls = {
            SpecifiedVersion: modpackId,
            LatestReleaseServerpack: '',
            LatestBetaServerpack: '',
            LatestAlphaServerpack: '',
            LatestReleaseNonServerpack: ''
        };
        return [name, urls, modpackId];
    }

    // The Python version has rather detailed logic; here we follow
    // the same *shape* so run/main.js can behave identically.
    // You can extend each provider later with precise API calls.

    if (provider === 'modrinth') {
        const project = (await axios.get(
            `https://api.modrinth.com/v2/project/${modpackId}`,
            { timeout: 60000 }
        )).data;

        const name = project.title || project.name || project.slug || modpackId;
        const versions = (await axios.get(
            `https://api.modrinth.com/v2/project/${modpackId}/version`,
            { timeout: 60000 }
        )).data;

        let chosen = null;
        if (modpackVersion) {
            chosen =
                versions.find(v => v.version_number === modpackVersion) ||
                versions.find(v => v.id === modpackVersion);
        }
        if (!chosen) chosen = versions[0];

        const normalDownloadUrl = chosen?.files?.[0]?.url || '';
        const urls = {
            SpecifiedVersion: normalDownloadUrl,
            LatestReleaseServerpack: '',
            LatestBetaServerpack: '',
            LatestAlphaServerpack: '',
            LatestReleaseNonServerpack: ''
        };

        return [name, urls, normalDownloadUrl];
    }

    // For curse / technic / ftb, stub the same shape for now
    // using your own API or CurseForge / modpacks.ch / Technic.
    // The Python library uses hypesrv + official APIs; you can
    // map those calls directly if you want.
    const urls = {
        SpecifiedVersion: '',
        LatestReleaseServerpack: '',
        LatestBetaServerpack: '',
        LatestAlphaServerpack: '',
        LatestReleaseNonServerpack: ''
    };

    const name = `${provider}_${modpackId}`;
    const normalDownloadUrl = '';
    return [name, urls, normalDownloadUrl];
}
