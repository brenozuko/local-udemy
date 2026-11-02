# Conhecimento Liberta

Plataforma local de cursos: assista vídeos armazenados em um drive local e acompanhe seu progresso.

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Docker

```bash
docker compose up --build
```

O catálogo de cursos é lido do volume montado em `/courses` (veja `docker-compose.yml`).

## Stack

- [Next.js](https://nextjs.org) (App Router)
- Tailwind CSS 4 + shadcn/ui
- SQLite (better-sqlite3) para catálogo e progresso
