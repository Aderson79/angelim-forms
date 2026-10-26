import { defineConfig, devices } from "@playwright/test";

// Chaves do Supabase e login de teste (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD) vêm do .env.local.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: usa só as variáveis do ambiente
}

const PORT = 3123;
// E2E_BASE_URL permite rodar contra o site publicado (ex.: https://angelim-natal.vercel.app).
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // os testes compartilham doações criadas no banco real
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    channel: "msedge", // usa o Edge instalado, sem baixar navegador
    locale: "pt-BR",
    timezoneId: "America/Fortaleza",
    permissions: ["clipboard-read", "clipboard-write"],
    acceptDownloads: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- -p ${PORT}`,
        url: baseURL,
        timeout: 240_000,
        reuseExistingServer: true,
      },
});
