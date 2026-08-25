# Naynaknots — Complete Full-Stack Master Build

This ZIP contains the cumulative build through UI/UX v10.

## Phase map

1. Foundation — React + Vite + Express
2. Store — Home, Shop, Product Details
3. Customer — Register, Login, Account
4. Cart & Orders — protected checkout/order flow
5. Custom Orders — custom product request flow
6. Security — password hashing, rate limiting, authorization, security headers
7. Communication — Instagram/WhatsApp handoff, order details, admin search
8. Database — SQLite tables for users/products/orders/custom orders/messages/wishlists
9. Production — build/start scripts, Docker, Render config, environment settings
10. UI/UX — responsive polish, accessibility, error boundary, Vite proxy

## Main folders

src/
  pages/                 Website pages
  components/            Shared UI
  styles/                Global and page styling
server/
  index.js               API + authentication + database + admin API
  migrate-json.js        Optional migration from old data.json

## Product editing

Admin login -> Admin dashboard -> Products.

Product CRUD is server protected. Customers cannot call admin product endpoints successfully.

## Accounts

Each account is tied to its own user ID. Customer order/wishlist APIs filter by authenticated user.

## Default fresh admin

Email: admin@naynaknots.com
Password: Admin@123

Change this password before public deployment.

## Local development

npm install
npm run dev

Frontend:
http://127.0.0.1:5173

API:
http://127.0.0.1:5000

## Existing v7 JSON migration

If you still have an old `server/data.json` containing important data:

npm install
npm run migrate
npm run dev

Do this before deleting the old JSON database.

## Production

Copy `.env.example` to `.env` and set a long random NAYNAKNOTS_SECRET.

Then:

npm ci
npm run build
npm start

Production serves the built frontend from the Express server.

## Important deployment storage

Keep persistent storage for:
- server/naynaknots.sqlite
- server/uploads/

Never commit:
- .env
- server/naynaknots.sqlite
- server/data.json
- server/uploads/
- node_modules/

## Real business settings

Update the placeholder Instagram username and WhatsApp number in:
server/index.js

## Where to edit common things

Products:
Admin dashboard or server/database.

Colors/fonts/layout:
src/styles/global.css

Navbar:
src/components/Navbar.jsx and its stylesheet if present.

Home:
src/pages/Home.jsx

Shop:
src/pages/Shop.jsx

Product:
src/pages/ProductDetails.jsx

Login:
src/pages/Login.jsx

Register:
src/pages/Register.jsx

Account:
src/pages/Account.jsx

Cart:
src/pages/Cart.jsx

Custom order:
src/pages/CustomOrder.jsx

Contact:
src/pages/Contact.jsx

Admin:
src/pages/admin/AdminDashboard.jsx

API/security/database:
server/index.js

## Build check

npm run build

If build succeeds, the frontend production bundle is valid. Then use the production start command to test the full app.
