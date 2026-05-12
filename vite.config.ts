// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages用のベースパス（自分のリポジトリ名に書き換えてね）
  base: '/tsumugu/', 
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // PWAとしての基本設定
      manifest: {
        name: 'Tsumugu',
        short_name: 'Tsumugu',
        description: 'X(Twitter)やPixivへのアップに特化したシンプルな小説エディタ',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone', // これでブラウザのURLバーが消えてネイティブアプリみたいになるよ
        icons: [
          {
            src: 'pwa-192x192.png', // 後で public フォルダにアイコンを入れる必要があるよ
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0', // ローカルネットワークからアクセスできるようにする
  }
})