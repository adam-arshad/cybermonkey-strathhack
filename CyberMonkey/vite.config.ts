import { defineConfig } from 'vite';
export default defineConfig({base:'./',cacheDir:'.cache/vite',server:{host:'127.0.0.1',port:8080},build:{rollupOptions:{output:{manualChunks:{phaser:['phaser']}}}}});
