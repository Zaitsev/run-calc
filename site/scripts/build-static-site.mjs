import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const distDir = resolve(rootDir, 'dist');
const publicDir = resolve(rootDir, 'public');
const stylesPath = resolve(rootDir, 'src', 'styles.css');
const ssrTempDir = resolve(rootDir, '.ssr-temp');

async function findSsrEntry(dirPath) {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const entryPath = resolve(dirPath, entry.name);

        if (entry.isDirectory()) {
            const nestedMatch = await findSsrEntry(entryPath);
            if (nestedMatch) {
                return nestedMatch;
            }
            continue;
        }

        if (entry.name === 'staticSite.js' || entry.name === 'staticSite.mjs' || entry.name === 'staticSite.cjs') {
            return entryPath;
        }
    }

    for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs'))) {
            return resolve(dirPath, entry.name);
        }
    }

    return undefined;
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true, force: true });
await writeFile(resolve(distDir, 'styles.css'), await readFile(stylesPath, 'utf8'));

const ssrEntryPath = await findSsrEntry(ssrTempDir);

if (!ssrEntryPath) {
    throw new Error(`Could not locate the SSR output in ${ssrTempDir}.`);
}

const { staticPages, renderPageDocument } = await import(pathToFileURL(ssrEntryPath).href);

for (const page of staticPages) {
    const outputPath = resolve(distDir, page.fileName);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, renderPageDocument(page), 'utf8');
}

await rm(ssrTempDir, { recursive: true, force: true });
