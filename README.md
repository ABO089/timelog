# TimeLog — Deployment Guide

SAP Consultant Time Tracker · FastAPI + React PWA · Docker Compose

---

## 1. Voraussetzungen

### Auf dem Server (192.168.178.198) muss vorhanden sein

| Komponente | Prüfen mit |
|---|---|
| Docker | `docker --version` |
| Docker Compose v2 | `docker compose version` |
| Nginx Proxy Manager | läuft auf Port 81 |
| DuckDNS Account | [duckdns.org](https://duckdns.org) |

### Ports

| Dienst | Port | Erreichbar von |
|---|---|---|
| Frontend (React) | 3010 | intern + via NPM |
| Backend (FastAPI) | 8010 | intern + via NPM |

Beide Ports müssen in der UFW-Firewall **nicht** nach außen geöffnet werden — der Nginx Proxy Manager übernimmt den externen Zugang über 80/443.

### Mistral API Key

Konto anlegen und API Key generieren unter:
**https://console.mistral.ai**

Kostenloser Tier reicht für den Einstieg. Key liegt unter: `API Keys → Create new key`.

---

## 2. Projekt auf den Server kopieren

**Via GitHub (empfohlen):**

```bash
ssh aljoscha@192.168.178.198
git clone https://github.com/ABO089/timelog.git /srv/timelog
```

Verzeichnis prüfen:

```bash
ls /srv/timelog
```

Erwartete Ausgabe:
```
backend/   docker-compose.yml   frontend/   .env.example   README.md
```

---

## 3. .env Datei anlegen

```bash
ssh aljoscha@192.168.178.198
cd /srv/timelog
cp .env.example .env
nano .env
```

Inhalt von `.env.example`:

```env
MISTRAL_API_KEY=your_mistral_api_key_here
```

Vollständige `.env` mit allen Werten:

```env
# Pflichtfeld — von console.mistral.ai
MISTRAL_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Pfad zur SQLite-Datei im Container (nicht ändern)
DB_PATH=/data/timelog.db

# Erlaubte Origins für CORS — beide Domains eintragen
CORS_ORIGINS=https://timelog.duckdns.org,https://timelog-api.duckdns.org
```

**Erklärung der Variablen:**

| Variable | Bedeutung |
|---|---|
| `MISTRAL_API_KEY` | API-Schlüssel für die Sprachanalyse (Pflicht) |
| `DB_PATH` | Pfad zur SQLite-Datei im Container — zeigt auf das gemountete Volume `/data` |
| `CORS_ORIGINS` | Kommagetrennte Liste der erlaubten Frontend-Origins; wichtig damit der Browser API-Anfragen über Nginx durchlässt |

> **Hinweis:** `.env` niemals committen. Die Datei ist bereits in `.gitignore` ausgeschlossen.

---

## 4. Docker Build & Start

```bash
cd /srv/timelog
docker compose up -d --build
```

Build-Dauer beim ersten Mal: ~2–3 Minuten (Node.js Frontend-Build + Python-Pakete).

Status prüfen:

```bash
docker compose ps
```

Erwartete Ausgabe:
```
NAME                STATUS          PORTS
timelog-backend-1   Up              0.0.0.0:8010->8010/tcp
timelog-frontend-1  Up              0.0.0.0:3010->3010/tcp
```

Logs live beobachten:

```bash
# Beide Container
docker compose logs -f

# Nur Backend
docker compose logs -f backend

# Nur Frontend
docker compose logs -f frontend
```

API-Health-Check:

```bash
curl http://localhost:8010/health
# Erwartete Antwort: {"status":"ok"}
```

---

## 5. Nginx Proxy Manager einrichten

NPM UI öffnen: **http://192.168.178.198:81**

### 5a. Frontend-Proxy (timelog.duckdns.org → Port 3010)

1. **Proxy Hosts** → **Add Proxy Host**
2. **Details:**
   ```
   Domain Names:       timelog.duckdns.org
   Scheme:             http
   Forward Hostname:   192.168.178.198
   Forward Port:       3010
   Block Common Exploits: ✅
   Websockets Support:    ☐
   ```
3. **SSL-Tab:**
   ```
   SSL Certificate:    Request a new SSL Certificate
   Force SSL:          ✅
   HTTP/2 Support:     ✅
   Email:              aljoschaboss@googlemail.com
   ```
4. **Save** — Let's Encrypt stellt das Zertifikat automatisch aus.

### 5b. Backend-Proxy (timelog-api.duckdns.org → Port 8010)

1. **Proxy Hosts** → **Add Proxy Host**
2. **Details:**
   ```
   Domain Names:       timelog-api.duckdns.org
   Scheme:             http
   Forward Hostname:   192.168.178.198
   Forward Port:       8010
   Block Common Exploits: ✅
   ```
3. **SSL-Tab:**
   ```
   SSL Certificate:    Request a new SSL Certificate
   Force SSL:          ✅
   HTTP/2 Support:     ✅
   Email:              aljoschaboss@googlemail.com
   ```
4. **Save**

> **Warum zwei Domains?** Das Frontend (React) wird als statische App ausgeliefert und braucht beim Build keine API-URL — es nutzt den `/api`-Proxy in nginx.conf. Für externen Zugriff vom Browser direkt auf die API (z.B. Debugging via curl) ist `timelog-api.duckdns.org` praktisch, aber nicht zwingend.

---

## 6. DuckDNS Subdomains anlegen

1. **https://duckdns.org** → einloggen
2. Unter **"add domain"** folgende Subdomains anlegen:

   ```
   timelog
   timelog-api
   ```

3. Bei beiden die **aktuelle externe IP** eintragen (oder leer lassen — DuckDNS erkennt sie automatisch beim Speichern).

4. Der bestehende DuckDNS-Cron auf dem Server (`bobmedia.duckdns.org`) aktualisiert **alle** Domains unter dem Account automatisch alle 5 Minuten. Keine weitere Konfiguration nötig.

Prüfen ob die Domains auflösen (von Windows):

```powershell
nslookup timelog.duckdns.org
nslookup timelog-api.duckdns.org
```

Beide müssen auf die externe IP des Servers zeigen.

---

## 7. PWA auf dem iPhone installieren

1. **Safari** öffnen (kein anderer Browser — nur Safari kann PWAs auf iOS installieren)
2. `https://timelog.duckdns.org` aufrufen
3. Unten in der Mitte: **Teilen-Button** (Quadrat mit Pfeil nach oben) tippen
4. Im Menü nach unten scrollen → **"Zum Home-Bildschirm"** tippen
5. Namen bestätigen → **"Hinzufügen"**

Die App erscheint jetzt als Icon auf dem Home-Bildschirm und startet ohne Browser-UI.

**Push-Benachrichtigungen (tägliche Erinnerung 16:30):**

- Beim ersten Start der installierten PWA erscheint ein Berechtigungs-Dialog
- **"Erlauben"** tippen
- Die Benachrichtigung erscheint nur, wenn heute noch keine Einträge gespeichert wurden

> ⚠️ **iOS-Einschränkung:** Push-Benachrichtigungen funktionieren auf iOS **ausschließlich** wenn die App als PWA installiert ist. Im normalen Safari-Browser-Tab werden keine Notifications gesendet — das ist eine Apple-Restriktion.

---

## 8. PWA auf Android installieren

1. **Chrome** öffnen
2. `https://timelog.duckdns.org` aufrufen
3. Oben rechts: **drei Punkte** (⋮) tippen
4. **"App installieren"** oder **"Zum Startbildschirm hinzufügen"** tippen
5. Bestätigen

Alternativ erscheint bei Chrome automatisch ein **"App installieren"**-Banner am unteren Bildschirmrand, wenn die PWA-Kriterien erfüllt sind (HTTPS + manifest + Service Worker).

---

## 9. Update-Prozess

Neue Version deployen — alles über GitHub:

```bash
ssh aljoscha@192.168.178.198
cd /srv/timelog
git pull && docker compose up -d --build
```

Das ist der komplette Update-Prozess. Auf dem Entwicklungsrechner vorher committen und pushen:

```bash
ssh aljoscha@192.168.178.198
cd /srv/timelog
docker compose up -d --build
```

Alte Images aufräumen (spart Speicher):

```bash
docker image prune -f
```

---

## 10. Troubleshooting

### Backend nicht erreichbar

```bash
docker compose logs backend
# Häufigste Ursache: MISTRAL_API_KEY fehlt oder falsch in .env
```

Health-Check direkt auf dem Server:
```bash
curl http://localhost:8010/health
```

### Mikrofon funktioniert nicht / Spracherkennung startet nicht

**HTTPS ist Pflicht.** Die Web Speech API verweigert den Mikrofonzugriff auf unsicheren Verbindungen.

- ✅ `https://timelog.duckdns.org` — funktioniert
- ❌ `http://192.168.178.198:3010` — Mikrofon blockiert
- ✅ `http://localhost:5173` (lokale Dev-Umgebung) — funktioniert als Ausnahme

Browser-Kompatibilität: **Chrome/Edge empfohlen.** Firefox hat eingeschränkte Speech-API-Unterstützung, Safari (Desktop) keine.

### Push-Benachrichtigungen kommen nicht an

1. PWA muss **installiert** sein (nicht nur im Browser-Tab offen)
2. Unter iOS: Einstellungen → TimeLog → Mitteilungen → **Erlauben**
3. Unter Android: App-Info → Benachrichtigungen → **Aktiviert**
4. Benachrichtigung erscheint nur wenn **heute 0 Stunden** eingetragen sind — bereits gebuchte Tage lösen keinen Alert aus

### Neue Projekte werden vom Sprachparser nicht erkannt

Mistral matcht Projektnamen gegen `name`, `shortcode` und `aliases` aus der Datenbank.

Lösung: In der App unter **Projekte** das betroffene Projekt öffnen und im Feld **Aliase** alle alternativen Schreibweisen eintragen, z.B.:

```
Sim, Sims, ZIM AG, Stadtwerke
```

### Container startet immer wieder neu (Restart-Loop)

```bash
docker compose logs --tail=50 backend
# Typische Fehler:
# - "MISTRAL_API_KEY not configured" → .env prüfen
# - "unable to open database file" → Volume-Berechtigung prüfen
```

Volume-Berechtigung reparieren:
```bash
docker compose down
sudo mkdir -p /srv/timelog/data
sudo chown -R 1000:1000 /srv/timelog/data
docker compose up -d
```

---

## URL & Port Übersicht

| Dienst | Intern | Extern |
|---|---|---|
| Frontend (React PWA) | `http://192.168.178.198:3010` | `https://timelog.duckdns.org` |
| Backend (FastAPI) | `http://192.168.178.198:8010` | `https://timelog-api.duckdns.org` |
| API Docs (Swagger) | `http://192.168.178.198:8010/docs` | `https://timelog-api.duckdns.org/docs` |
| Nginx Proxy Manager | `http://192.168.178.198:81` | — |
| Portainer | `http://192.168.178.198:9000` | — |
