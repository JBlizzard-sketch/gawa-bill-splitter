# Gawa — Split Bills, Send Mpesa

> A mobile-first bill splitter built for the Kenyan market. Enter a bill, add friends' Mpesa numbers, and each person gets an STK push payment request instantly.

![Gawa Dashboard](https://img.shields.io/badge/status-active-brightgreen) ![Stack](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20PostgreSQL-blue) ![Market](https://img.shields.io/badge/market-Kenya%20🇰🇪-red)

---

## Features

- **Bill Splitting** — Equal, itemised, or custom splits across any number of people
- **Mpesa STK Push** — Each participant gets a payment prompt sent directly to their phone
- **Real-time Payment Status** — Track who has paid and who hasn't in one view
- **Trip Expense Tracker** — Group multiple events under a trip (e.g. Mombasa Weekend)
- **Recurring Bills** — Handle flatmate rent, utilities, and subscriptions on a schedule
- **Activity Feed** — Full audit log of all splits, payments, and status changes
- **Dashboard Analytics** — Outstanding amounts, collections, and active event counts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, TypeScript, TailwindCSS, shadcn/ui |
| Backend | Express 5, Node.js, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| API Contract | OpenAPI 3.0 → Orval codegen (React Query hooks + Zod schemas) |
| Payments | Safaricom Daraja API (Mpesa STK Push) |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
.
├── artifacts/
│   ├── gawa/              # React + Vite frontend (serves at /)
│   └── api-server/        # Express 5 API server (serves at /api)
├── lib/
│   ├── api-spec/          # OpenAPI spec + Orval codegen
│   ├── api-client-react/  # Generated React Query hooks
│   ├── api-zod/           # Generated Zod validation schemas
│   └── db/                # Drizzle ORM schema + migrations
└── scripts/               # Shared utility scripts
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `events` | A bill-splitting event (e.g. dinner, rent) |
| `participants` | People in an event with their share and payment status |
| `bill_items` | Line items for itemised splits |
| `payments` | Mpesa STK push records and their status |
| `trips` | Groups of related events |
| `recurring_bills` | Scheduled repeating bills |
| `activity_log` | Full audit trail of all actions |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/events` | List all events |
| POST | `/api/events` | Create a new split event |
| GET | `/api/events/:id` | Get event with participants |
| POST | `/api/events/:id/participants` | Add participant |
| POST | `/api/events/:id/items` | Add bill item |
| POST | `/api/events/:id/participants/:pid/request-payment` | Send Mpesa STK push |
| POST | `/api/events/:id/participants/:pid/mark-paid` | Mark as paid manually |
| GET | `/api/trips` | List all trips |
| POST | `/api/trips` | Create trip |
| GET | `/api/trips/:id` | Get trip with events |
| GET | `/api/recurring` | List recurring bills |
| POST | `/api/recurring` | Create recurring bill |
| GET | `/api/activity` | Activity feed |
| GET | `/api/dashboard/summary` | Dashboard analytics |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database

### Environment Variables

Copy `.env.example` and fill in your values:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gawa

# Session
SESSION_SECRET=your-session-secret

# Mpesa Daraja API (optional — falls back to sandbox simulation if not set)
MPESA_CONSUMER_KEY=your-consumer-key
MPESA_CONSUMER_SECRET=your-consumer-secret
MPESA_SHORTCODE=your-shortcode
MPESA_PASSKEY=your-passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/payments/mpesa/callback
MPESA_ENVIRONMENT=sandbox   # or "production"
```

### Install & Run

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm --filter @workspace/db run migrate

# Seed example data (optional)
pnpm --filter @workspace/db run seed

# Start API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Start frontend (port 21234)
pnpm --filter @workspace/gawa run dev
```

### Regenerate API Client

After changing the OpenAPI spec:

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## Mpesa Integration

Gawa uses the Safaricom Daraja API for STK Push payments.

- If `MPESA_CONSUMER_KEY` and related secrets are **not** set, the server falls back to a simulated sandbox response — useful for development.
- Set `MPESA_ENVIRONMENT=production` and real credentials to go live.
- The callback URL (`MPESA_CALLBACK_URL`) must be a publicly accessible HTTPS endpoint. Use the deployed URL in production.

---

## Deployment

The app is designed for Replit deployment:

1. Set all required environment secrets in the Replit Secrets panel
2. Click **Deploy** in the Replit workspace
3. Both the frontend and API server are served through a shared reverse proxy

---

## Roadmap

- [ ] User authentication (phone-number based, OTP via SMS)
- [ ] Push notifications for payment reminders
- [ ] WhatsApp share link for bill splits
- [ ] Mpesa C2B (receive payments to till/paybill)
- [ ] Multi-currency support (USD, UGX, TZS)
- [ ] Expense categories and tagging
- [ ] Export to PDF/CSV

---

## License

MIT © JBlizzard-sketch
