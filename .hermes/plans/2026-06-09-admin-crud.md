# Admin CRUD voor Gaar Rooster — Implementatieplan

> **Voor Hermes:** Elk task uitvoeren met `delegate_task` of direct tooling. Hou de implementatie clean en simpel.

**Doel:** Een beveiligde adminomgeving waarin Robert shifts kan toevoegen, aanpassen en verwijderen via een webinterface.

**Architectuur:** Flask REST API met SQLite op de Linux VM. Next.js `/admin` pagina als client-side SPA die de API aanroept. Publieke roostersite blijft ongewijzigd.

**Tech Stack:** Python 3 + Flask + SQLite (backend), Next.js 16 + TypeScript (frontend).

---

## Beveiligingsmodel (4 lagen)

```
Gebruiker → IP whitelist → Rate limit → Username/Wachtwoord → Telegram OTP → JWT session
```

| Laag | Mechanisme | Details |
|------|-----------|---------|
| 1 | **IP whitelist** | Alleen requests vanaf toegestane IP-ranges krijgen een loginpagina |
| 2 | **Rate limiting** | Max 3 pogingen per IP per 15 minuten; bij overschrijding lockout |
| 3 | **Credentials** | Username `robert` + sterk wachtwoord (`.env`) |
| 4 | **Telegram OTP** | 6-cijferige code via Telegram DM, 5 minuten geldig |

Authenticatie-flow:
1. Client doet `POST /api/auth/login` met `{username, password}`
2. API checkt IP whitelist + rate limit + credentials
3. Bij succes: genereert 6-cijferige OTP, stuurt via Telegram Bot API naar Robert's chat_id
4. API returned `{status: "otp_required", session_token: "<temp>"}`
5. Client toont OTP-invoerveld
6. Client doet `POST /api/auth/verify-otp` met `{session_token, otp}`
7. API valideert OTP, returned JWT access token
8. Alle CRUD requests dragen `Authorization: Bearer <jwt>`

---

## Architectuurschema

```
┌──────────────────────────┐     ┌──────────────────────────┐
│  gaar-rooster.vercel.app  │     │  Linux VM (clawbert)      │
│                          │     │                          │
│  /          (static)     │     │  Flask API :5050         │
│  /admin     (SPA)  ──────┼────>│  ├─ /api/auth/*          │
│                          │     │  ├─ /api/shifts (CRUD)   │
└──────────────────────────┘     │  ├─ SQLite gaar.db       │
                                 │  └─ Telegram Bot API     │
                                 └──────────────────────────┘
```

- Publieke roosterpagina (`/`) blijft statisch, leest `roster-data.json` ongewijzigd
- `/admin` is client-side SPA die eerst authenticeert, daarna CRUD doet
- Flask API op `:5050`, publiek bereikbaar via reverse proxy of direct port
- Telegram Bot API wordt door Flask aangeroepen om OTP te versturen

---

## Vereisten vooraf

- **Telegram Bot**: Maak een bot via [@BotFather](https://t.me/BotFather), noteer de token
- **Robert's chat_id**: Start een gesprek met de bot, stuur `/start`, noteer de chat_id
- **IP ranges**: Lijst van toegestane IP-ranges (thuis-IP, mobiel, etc.)
- **Wachtwoord**: Sterk wachtwoord voor admin, opgeslagen in `.env`

---

## Database-schema (SQLite)

```sql
CREATE TABLE weeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_number INTEGER NOT NULL UNIQUE,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL
);

CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    week_id INTEGER NOT NULL REFERENCES weeks(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT NOT NULL CHECK(location IN ('NEP', 'HCD')),
    UNIQUE(employee_id, date)
);

CREATE TABLE login_attempts (
    ip TEXT NOT NULL,
    attempted_at REAL NOT NULL
);

CREATE TABLE otp_sessions (
    token TEXT PRIMARY KEY,
    otp_hash TEXT NOT NULL,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL,
    attempts INTEGER DEFAULT 0
);
```

---

## API Endpoints

### Auth

| Methode | Pad | Beschrijving |
|---------|-----|-------------|
| `POST` | `/api/auth/login` | Login met username + wachtwoord → OTP trigger |
| `POST` | `/api/auth/verify-otp` | OTP verifiëren → JWT token |
| `POST` | `/api/auth/refresh` | JWT vernieuwen |

### CRUD (authenticated)

| Methode | Pad | Beschrijving |
|---------|-----|-------------|
| `GET` | `/api/health` | Health check (publiek) |
| `GET` | `/api/weeks` | Alle weken |
| `GET` | `/api/employees` | Alle medewerkers |
| `GET` | `/api/shifts?week_id=N` | Shifts per week |
| `POST` | `/api/shifts` | Shift toevoegen |
| `PUT` | `/api/shifts/<id>` | Shift aanpassen |
| `DELETE` | `/api/shifts/<id>` | Shift verwijderen |

Alle CRUD endpoints vereisen `Authorization: Bearer <jwt>`.

---

## Tasks

### Task 1: Projectstructuur en dependencies

**Bestanden:**
- Create: `/home/clawbert/gaar-admin/`
- Create: `/home/clawbert/gaar-admin/requirements.txt`

```txt
flask==3.1.2
flask-cors==5.0.1
flask-limiter==3.10.1
pyjwt==2.10.1
bcrypt==4.2.1
requests==2.32.4
```

Create `.env`:
```bash
ADMIN_USERNAME=robert
ADMIN_PASSWORD_HASH=<bcrypt hash>
JWT_SECRET=<random 64-char hex>
TELEGRAM_BOT_TOKEN=<van BotFather>
TELEGRAM_CHAT_ID=<Robert's chat ID>
ALLOWED_IPS=82.x.x.x/32,145.x.x.x/32,10.0.0.0/8,172.16.0.0/12
```

```bash
cd /home/clawbert/gaar-admin
mkdir -p /home/clawbert/gaar-admin
pip install -r requirements.txt  # of via uv
```

---

### Task 2: Database + seed

**Bestanden:**
- Create: `/home/clawbert/gaar-admin/database.py`
- Create: `/home/clawbert/gaar-admin/seed.py`

`database.py` — initialiseert alle tabellen (weeks, employees, shifts, matches, login_attempts, otp_sessions).

`seed.py` — importeert bestaande `roster-data.json` naar SQLite.

**Verificatie:**
```bash
sqlite3 /home/clawbert/gaar-admin/gaar.db "SELECT COUNT(*) FROM shifts;"
# > 0
```

---

### Task 3: Auth module

**Bestanden:**
- Create: `/home/clawbert/gaar-admin/auth.py`

Bevat:
- `check_ip_allowed(ip)` — checkt tegen `ALLOWED_IPS` (CIDR matching via `ipaddress`)
- `check_rate_limit(ip)` — max 3 pogingen in 15 min, anders lockout
- `verify_password(username, password)` — bcrypt check
- `generate_otp()` — 6-cijferige random code
- `send_telegram_otp(chat_id, otp)` — verstuurt OTP via Telegram Bot API
- `create_jwt(username)` — genereert JWT (15 min geldig)
- `verify_jwt(token)` — valideert JWT, returned username of None
- `require_auth(request)` — decorator/helper voor CRUD endpoints

**Telegram OTP bericht:**
```
🔐 Gaar Admin — verificatiecode

Je code is: 482 916

Deze code is 5 minuten geldig. Niet delen met anderen.
```

---

### Task 4: Flask API app

**Bestanden:**
- Create: `/home/clawbert/gaar-admin/app.py`

Endpoints: health, auth (login, verify-otp, refresh), CRUD (weeks, employees, shifts).

Auth-flow in `app.py`:
```python
@app.route("/api/auth/login", methods=["POST"])
@limiter.limit("3 per 15 minutes")
def login():
    # 1. IP whitelist check
    # 2. Rate limit check (automatisch via limiter)
    # 3. Credential check (bcrypt)
    # 4. Genereer OTP, sla hash op in otp_sessions
    # 5. Verstuur OTP via Telegram
    # 6. Return session_token (tijdelijk, 5 min)
    pass

@app.route("/api/auth/verify-otp", methods=["POST"])
def verify_otp():
    # 1. Zoek session in otp_sessions
    # 2. Check expiry + max 3 OTP attempts
    # 3. Vergelijk bcrypt hash
    # 4. Genereer JWT, return token
    pass
```

---

### Task 5: Admin page — Next.js

**Bestanden:**
- Create: `/home/clawbert/gaar-rooster/app/admin/page.tsx`
- Create: `/home/clawbert/gaar-rooster/app/admin/AdminClient.tsx`

**Login flow (AdminClient.tsx):**
1. Toont loginformulier: username + password
2. Bij submit → `POST /api/auth/login`
3. Bij `otp_required` → toont OTP-invoerveld
4. Bij OTP submit → `POST /api/auth/verify-otp`
5. Bij JWT → slaat op in `sessionStorage`, laadt admin dashboard

**Admin dashboard:**
- Week-selector dropdown
- Shift-tabel met inline editing
- Formulier voor nieuwe shift (medewerker dropdown, datum, tijden, locatie)
- Delete-knop per shift met bevestiging

**Styling:** Bestaande CSS-variabelen (`--ink-indigo`, `--muted-gold`, `--washi-cream`), zelfde rooster look-and-feel.

**Error handling:**
- 401 → redirect naar login
- 429 (rate limit) → toon "Te veel pogingen, wacht 15 minuten"
- Netwerkfouten → toon "Geen verbinding met server"

---

### Task 6: Service opstarten

**Bestand:**
- Create: `/home/clawbert/gaar-admin/start.sh`

```bash
#!/bin/bash
cd /home/clawbert/gaar-admin
set -a; source .env; set +a
exec python3 app.py
```

Start via background process op de VM:
```bash
chmod +x start.sh
# Start via terminal(background=True, notify_on_complete=False)
# Of via systemd voor permanente service
```

---

### Task 7: Build & deploy Next.js

```bash
cd /home/clawbert/gaar-rooster
npm run build
git add -A && git commit -m "feat: admin CRUD met 2FA, rate limiting, IP whitelist"
git push
```

---

## Risico's & aandachtspunten

1. **Telegram Bot setup**: Vereist eenmalige setup via BotFather. Token + chat_id in `.env`.
2. **API bereikbaarheid**: Flask API op `:5050` moet publiek bereikbaar zijn vanaf Vercel. IP whitelist biedt eerste verdedigingslinie.
3. **JWT expiry**: 15 minuten — na expiry opnieuw inloggen (met OTP). Refresh endpoint optioneel later toe te voegen.
4. **OTP expiry**: 5 minuten, max 3 foute pogingen per OTP.
5. **Data sync**: Bestaande cron jobs schrijven naar `roster-data.json`. Admin wijzigt alleen SQLite. Dit zijn voor nu gescheiden databronnen.
6. **bcrypt hash genereren**: Eénmalig een hash van het admin-wachtwoord genereren en in `.env` zetten.

## Vervolgstappen (buiten scope)

- Publieke roostersite live data laten lezen (client-side fetch)
- Cron sync naar SQLite ipv JSON
- Auto-rebuild op admin-wijzigingen
- Matches CRUD
- Annotaties beheren via admin
