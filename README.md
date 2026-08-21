# AI App Builder (mxr-open-lovable)

Creador de apps React con IA: describes lo que quieres (o scrapea una web), se genera código en un sandbox remoto y lo ves en preview.

## Documentación completa

La guía técnica de **todos los procesos** (generación, apply, Morph, sandboxes, tiempos de vida, imágenes, preview, APIs, env vars) está en:

**[docs/ARQUITECTURA.md](./docs/ARQUITECTURA.md)**

## Setup rápido

1. **Instalar**
```bash
cd mxr-open-lovable
pnpm install  # o npm install / yarn install
```

2. **Crear `.env.local`** (ver también `.env.example`):
```bash
# Obligatoria — modelos vía OpenRouter
OPEN_ROUTER_API_KEY=your_key

# Sandbox: elige UNO
SANDBOX_PROVIDER=e2b
E2B_API_KEY=your_e2b_api_key
# — o —
# SANDBOX_PROVIDER=vercel
# + VERCEL_OIDC_TOKEN (vercel link && vercel env pull)
#   o VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID

# Opcional
FIRECRAWL_API_KEY=your_firecrawl_key   # Scrapper
MORPH_API_KEY=your_morph_key           # ediciones rápidas
```

3. **Arrancar**
```bash
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Flujo en una frase

`/` (prompt o Scrapper) → `/generation` → sandbox Vite → OpenRouter genera código → apply al sandbox → preview en iframe.
