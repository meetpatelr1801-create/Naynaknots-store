# Naynaknots Production Deployment

## Local production test

PowerShell:

```powershell
npm ci
copy .env.example .env
# Edit .env and set NAYNAKNOTS_SECRET
npm run build
$env:NODE_ENV="production"
npm start
```

Open:
http://localhost:5000

Health check:
http://localhost:5000/api/health

## Existing v8 data

Keep `server/naynaknots.sqlite` and `server/uploads/`.
Do not commit `.env`.

## Render

This project includes `render.yaml`.

Build:
`npm ci && npm run build`

Start:
`npm start`

Set a persistent disk for:
- `server/naynaknots.sqlite`
- `server/uploads/`

Without persistent storage, local SQLite data/uploads can be lost on redeploy.

## Docker

```powershell
docker compose up --build
```

## Before public launch

- Change the default admin password.
- Set a strong `NAYNAKNOTS_SECRET`.
- Replace placeholder Instagram and WhatsApp settings.
- Configure persistent storage/backups for SQLite and uploads.
- Use HTTPS at the hosting layer.
- Test registration, login, admin product CRUD, checkout and order status.
- Test image upload and mobile layout.
- Remove test/demo products and accounts.
