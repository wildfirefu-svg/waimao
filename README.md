# Hengda Overseas Lead CRM

Local MVP for managing overseas fiberglass yarn and fiberglass fabric leads.

## Requirements

- Node.js 26 or newer. The app uses `node:sqlite`.

## Run Locally

1. Install dependencies:

```bash
npm install
```

The MVP uses Node built-ins only. This command is still safe to run and can create a lockfile if needed.

2. Copy environment file:

```powershell
Copy-Item .env.example .env
```

3. Edit `.env` and fill SMTP credentials.

4. Initialize the database:

```bash
npm run init-db
```

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:5173`.

## Test

```bash
npm test
```

## Email Rules

The MVP sends one reviewed email at a time. It blocks sending to unsubscribed leads and blocks drafts that do not include unsubscribe language.

## AI Drafting

If `AI_API_KEY` is blank, the app uses template-based drafts. AI must not invent certifications, capacity, technical parameters, famous customers, or lowest-price claims.
