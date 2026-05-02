/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_HELP_SITE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
