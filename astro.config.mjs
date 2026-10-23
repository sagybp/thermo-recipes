import { defineConfig } from 'astro/config';

// BASE_PATH is set by the GitHub Pages workflow ('/thermo-recipes').
// On Cloudflare Pages (or any host that serves the site at the root) it stays unset and the base is '/'.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
});
