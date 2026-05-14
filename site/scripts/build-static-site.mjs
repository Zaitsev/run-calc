import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const distDir = resolve(rootDir, 'dist');
const publicDir = resolve(rootDir, 'public');
const stylesPath = resolve(rootDir, 'src', 'styles.css');
const ssrEntryPath = resolve(rootDir, '.ssr-temp', 'staticSite.js');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true, force: true });
await writeFile(resolve(distDir, 'styles.css'), await readFile(stylesPath, 'utf8'));

const { staticPages, renderPageDocument } = await import(pathToFileURL(ssrEntryPath).href);

for (const page of staticPages) {
    const outputPath = resolve(distDir, page.fileName);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, renderPageDocument(page), 'utf8');
}

await rm(resolve(rootDir, '.ssr-temp'), { recursive: true, force: true });
