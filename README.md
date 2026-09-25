# FOUND@ANS — Secondary School Lost & Found System

A clean, responsive, role-governed web application designed for secondary school lost and found operations at the Reception Desk. Aligned with the **FOUND@ANS** brand, the system streamlines custody tracking, student claim verification, and inventory transparency.

## Core Highlights & Recent Updates

### 1. Public & Guest Catalog
- **Frictionless Browsing**: Unauthenticated students and visitors can browse, search, and filter custody items directly without signing in.
- **Privacy Partitioning**: Public views display general descriptors, found locations, dates, and categories. Sensitive details—such as private owner verification clues and claimed records—remain strictly protected and accessible only to verified reception authorities.

### 2. In-App Camera Viewfinder & Photo Processing
- **Live Viewfinder**: Integrated WebRTC camera interface (`photo.js`) with instant frame capture and seamless hardware fallbacks for mobile and desktop browsers.
- **High-Capacity Intake**: Accepts source photos up to **25MB** (including direct camera roll uploads, RAW formats, and high-res JPEG/PNG phone captures).
- **Progressive Multi-Tier Compression**: Automatic canvas-based pipeline preserves aspect ratios while dynamically stepping down dimensions and quality, producing metadata-stripped WebP images (< 450 KB) that fit comfortably within Firestore document thresholds.

### 3. Minimalist Linear-Style Catalog
- **Unified 1-Line Search & Filter Bar**: Compact, distraction-free search bar combining instant fuzzy keyword filtering, semantic synonym expansion, category tags, and active status toggles into a single sleek row.
- **Quiet Metadata Layout**: Streamlined cards prioritizing visual recognition, essential location/date stamps, and clean item reference tags without visual clutter.
- **Fluid 2-Column Responsive Gallery**: Adaptive layout that balances dense inventory browsing on desktop with balanced 2-column cards on tablets and larger viewports.

### 4. Native Mobile Enhancements
- **Touch-First Bottom-Sheet Modals**: Dialogs and preview drawers slide up as native bottom-sheets on touch viewports for effortless one-handed dismissal.
- **Horizontal Tab Snapping**: Smooth horizontal scrolling navigation bar with snap indicators and touch padding.
- **Single-Column & Compact Flows**: Forms, item details, and submission flows automatically collapse into focused single-column layouts on compact mobile screens.

### 5. Real-Time Dynamic Analytics
- **Live Landing Ribbon**: Connected directly to Firestore real-time metrics, dynamically calculating:
  - **Reunited Items**: Total successfully verified handovers.
  - **Waiting in Custody**: Current active items awaiting collection.
  - **Average Return Turnaround**: Computed elapsed days between intake and claim handover.
- **Zero Static Seed Data**: Metrics reflect actual custody inventory without hardcoded placeholder targets.

### 6. Security Hardening
- **XSS Sanitization**: Strict HTML entity escaping across card titles, category tags, locations, descriptions, and user inputs before rendering into the DOM.
- **Rate-Limiting Protection**: Sliding-window in-memory rate limiting applied to all write endpoints (`POST /api/items`, `DELETE /api/items/:itemId`, report creation) to defend against burst submissions.
- **Atomic Transactions**: Handover verification (`POST /api/handovers`) executes inside Firestore atomic transactions (`firestore.runTransaction`), preventing double-claiming race conditions and guaranteeing synchronized item archival and handover auditing.

---

## Key Features

### Role-Based Access
- **Guest / Student View**: Immediate public catalog browsing, keyword & synonym search, visual claiming instructions, and missing-item report filing.
- **Authority View (Reception Staff)**:
  - Secure item registration with live camera capture or file dropzone.
  - Storage bin assignment, physical reception sheet reference logging, and retention countdown tracking (default 45 days).
  - Private verification notes and student report review inbox.
  - One-click Claim Verification Handshake (records student ID, claim method, staff sign-off).
  - Weekly Monday digest preview for unclaimed high-value items.
- **Firebase Authentication & Custom Claims**: Secure token verification via the Firebase Admin SDK on the backend server; browser client-side rules reject direct unauthorized Firestore operations.

---

## Project Structure

- `index.html` — FOUND@ANS application interface, modals, bottom sheets, and view templates.
- `style.css` — modern design system, responsive media queries, bottom-sheet animations, and themes.
- `app.js` — routing, catalog rendering, DOM events, and modal controllers.
- `data.js` — default categories and static configuration.
- `state.js` — client-side state management and caching.
- `search.js` — multi-field catalog search with semantic synonym expansion.
- `photo.js` — WebRTC camera viewfinder, intake validation, and progressive WebP compression pipeline.
- `ui-effects.js` — toast notifications, ribbon animations, and micro-interactions.
- `firebase-auth.js` — browser Firebase Authentication client and session persistence.
- `api.js` — unified API client handling guest requests and authenticated token injection.
- `server.js` — Express API server, sliding-window rate limiters, Firestore Admin integration, and transaction handlers.
- `.env.example` — environment configuration template for Firebase Admin credentials.

---

## Server & API Endpoints

All Firestore mutations and private reads are guarded by the Express backend (`server.js`). Firestore rules strictly reject direct browser modifications:

```text
allow read, write: if false;
```

### Endpoints Overview

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Server uptime and service health check |
| `GET` | `/api/me` | Authenticated | Current user profile and role verification |
| `GET` | `/api/items` | Public / Guest | Active public catalog (filters out private notes & bin info) |
| `GET` | `/api/items/:itemId` | Public / Role-aware | Item detail; private fields included only for authorities |
| `POST` | `/api/items` | Authority Only | Register found item (Rate-limited, accepts WebP image) |
| `DELETE` | `/api/items/:itemId` | Authority Only | Remove item from custody (Rate-limited) |
| `GET` | `/api/lost-reports` | Authority Only | Retrieve submitted student missing reports |
| `POST` | `/api/lost-reports` | Public / Student | Submit missing-item report (Rate-limited) |
| `PATCH` | `/api/lost-reports/:reportId`| Authority Only | Update report status (e.g. marked reviewed) |
| `POST` | `/api/handovers` | Authority Only | Atomic claim verification and handover archival |

---

## How to Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and provide your Firebase project details and service account credentials:
```bash
cp .env.example .env
```

### 3. Start the Server
```bash
npm start
```
The application will be live at `http://localhost:3000`.

### 4. Assigning Authority Roles
Create a staff account via the sign-up form in the UI, then grant the authority claim via the CLI:
```bash
npm run set-authority -- staff@example.com
```
*Note: The staff member must sign out and sign in again to refresh their token claims.*
