import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function isAssetRequest(pathname: string): boolean {
    return pathname.includes('.') || pathname.startsWith('/@') || pathname.startsWith('/src/') || pathname.startsWith('/node_modules/');
}

async function routeExists(root: string, pathname: string): Promise<boolean> {
    if (pathname === '/') {
        return true;
    }

    const htmlPath = resolve(root, `${pathname.replace(/^\//, '')}.html`);
    try {
        await access(htmlPath);
        return true;
    } catch {
        return false;
    }
}

function devNotFoundMiddleware() {
    return {
        name: 'run-calc-dev-not-found',
        apply: 'serve' as const,
        configureServer(server: import('vite').ViteDevServer) {
            server.middlewares.use(async (req, res, next) => {
                const method = req.method ?? 'GET';
                if (method !== 'GET' && method !== 'HEAD') {
                    next();
                    return;
                }

                const pathname = (req.url ?? '/').split('?')[0];
                if (isAssetRequest(pathname) || pathname === '/404' || pathname === '/404.html') {
                    next();
                    return;
                }

                if (await routeExists(server.config.root, pathname)) {
                    next();
                    return;
                }

                const notFoundPath = resolve(server.config.root, '404.html');
                const html = await readFile(notFoundPath, 'utf8');
                const transformed = await server.transformIndexHtml('/404.html', html, req.originalUrl);

                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/html');
                res.end(transformed);
            });
        },
    };
}

export default defineConfig({
    appType: 'mpa',
    plugins: [react(), devNotFoundMiddleware()],
    server: {
        port: 3001,
    },
});
