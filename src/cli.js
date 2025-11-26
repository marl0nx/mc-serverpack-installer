#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runInstaller } from './main.js';

const argv = yargs(hideBin(process.argv))
    .scriptName('mc-serverpack-installer')
    .usage('$0 -provider <provider> -modpack-id <id> [options]')
    .option('provider', {
        type: 'string',
        describe: 'curse | technic | ftb | modrinth | direct',
        demandOption: true
    })
    .option('modpack-id', {
        type: 'string',
        describe: 'Project ID / slug / URL depending on provider',
        demandOption: true
    })
    .option('modpack-version', {
        type: 'string',
        describe: 'Version/build identifier (not used for direct)',
        default: false
    })
    .option('pterodactyl', {
        describe: 'Pterodactyl mode (install directly into working path)',
        type: 'boolean',
        default: false
    })
    .option('clean-scripts', {
        describe: 'Remove .sh / .bat startup scripts after install',
        type: 'boolean',
        default: false
    })
    .option('update', {
        describe: 'Remove /mods, /.fabric, /libraries etc before installing',
        type: 'boolean',
        default: false
    })
    .option('folder-name', {
        describe: 'Explicit output folder name (ignored in pterodactyl mode)',
        type: 'string',
        default: false
    })
    .option('working-path', {
        describe: 'Directory to work in (default: script directory)',
        type: 'string',
        default: false
    })
    .option('manifest-api-key', {
        describe: 'API key for hypesrv manifest mod downloads',
        type: 'string',
        default: false
    })
    .option('wget-mode', {
        describe: 'Use wget-like download behavior (FTB)',
        type: 'boolean',
        default: false
    })
    .help()
    .alias('h', 'help')
    .argv;

runInstaller({
    provider: argv.provider,
    modpackId: argv['modpack-id'],
    modpackVersion: argv['modpack-version'] || false,
    pterodactyl: argv.pterodactyl,
    cleanScripts: argv['clean-scripts'],
    update: argv.update,
    folderName: argv['folder-name'] || false,
    workingPath: argv['working-path'] || false,
    manifestApiKey: argv['manifest-api-key'] || false,
    wgetMode: argv['wget-mode'] || false
}).catch(err => {
    console.error(err?.stack || err);
    process.exit(1);
});
