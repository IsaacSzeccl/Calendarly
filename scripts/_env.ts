// Shared setup for scripts: load .env like Next.js does, and allow server-only modules
// (`server-only` refuses to load outside Next.js; scripts are server-side by nature).
import { loadEnvConfig } from "@next/env";
import { createRequire } from "node:module";

loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = { exports: {} } as NodeJS.Module;
