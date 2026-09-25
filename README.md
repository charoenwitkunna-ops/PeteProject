# Secondary School Lost & Found System

A clean, responsive, role-governed web application for secondary school lost and found operations at the Reception Desk.

## Features Included

### 1. Authentication & Role Access
- **Firebase Authentication**: Email/password accounts with browser session persistence.
- **Role-based access**: UI role hints come from signed Firebase custom claims; the server must enforce roles for protected reads and writes.
- **Account creation**: New users can create an account from the login screen.

### 2. Common Features (Both Students & Authorities)
- **Top Navigation Bar**: Dynamic tabs that change based on your role + user avatar badge and sign out.
- **Items List Grid**:
  - Item photograph with zoom preview
  - Date found
  - Location found (e.g. Building A Cafeteria, Gym Bleachers)
  - Claim deadline with automatic countdown days indicator
  - Owner name (if written on item)
- **AI-Assisted Search Bar**:
  - Keyword and semantic synonym expansion (e.g. searching "phone" matches "Apple AirPods" and "iPhone", "bottle" matches "flask").
  - Multi-field scoring across title, description, location, and item reference codes.
  - Category filters and High-Value toggles.
- **Item Detail Lightbox**: Full preview with enlarged photograph, date, and description.

### 3. Student Features
- **Lost-Item Reports**: Students can submit a missing-item report with category, last-seen location, date, and a private identifying clue. Reports persist in the same browser for authority review.
- **Student Instructions Page**: Visual 4-step claiming guide (Identify item -> Visit reception with Student ID -> Verify proof of ownership -> Collect item).
- **Ownership Clue Privacy**:
  - Student catalog views show only whether a name label is present; they do not display the name or initials.
  - Authorities can view the recorded owner name and private verification notes in the interface.
  - This front-end demo stores data in browser `localStorage`; it is not secure authentication or production-grade access control.

### 4. Authority Features (Kru Jane & Reception)
- **Lost-Report Inbox**: Review student reports, check the catalog, and mark reports reviewed.
- **Add Found Item Form**:
  - Photo upload with instant preview (supports device camera or file selection)
  - Physical reception sheet reference (`sheetRefNo`, e.g. "Sheet #12, Row 3")
  - Physical storage bin / shelf identifier (e.g. "Bin B-02")
  - High-Value item flag (for phones, laptops, wallets)
  - Public description vs Private verification notes
  - Retention deadline calculator (defaults to 45 days)
- **Claim Verification Handshake**:
  - Authority can click **"Claim"** on any active item.
  - Form records Student Name, Student ID, Verification Method (Student ID match, device unlock, secret feature description), and Staff sign-off notes.
  - Automatically archives item from active student view.
- **Status Filter**: Switch between Active, Claimed, and All items.
- **Authority SOP & Protocol Page**: Comprehensive guide covering physical reception intake, photo security, handover verification, and disposal timelines.
- **Monday Email Digest Preview**:
  - Mockup of the weekly automated email sent every Monday morning highlighting unclaimed high-value items and recently found items.

## Project Structure

- `index.html` — application screens and forms.
- `style.css` — visual styles and responsive layout.
- `app.js` — navigation, rendering, and form event handlers.
- `data.js` — sample inventory and static configuration.
- `state.js` — browser-local state and persistence.
- `search.js` — catalog keyword and synonym search.
- `photo.js` — WebP image validation, resizing, compression, and metadata-stripping re-encode.
- `ui-effects.js` — toast and decorative animation helpers.
- `firebase-auth.js` — browser Firebase Authentication initialization and session persistence.
- `api.js` — authenticated browser-to-server API client.
- `server.js` — Node/Express application server and Firebase Admin API.
- `.env.example` — server-side Firebase Admin credential template.

## Server and Database

The browser signs in with Firebase Authentication. Passwords are managed by Firebase Authentication and are never stored in Firestore or application code. The application server verifies the Firebase ID token before handling protected API requests. Firestore is the permanent database; the server keeps a short-lived in-memory read cache.

New item documents record the uploader for audit purposes using `registeredByUid`, `registeredByEmail`, and `registeredByName`. They never record the user's password.

Firestore rules are deny-all for browser clients:

```text
allow read, write: if false;
```

All Firestore access must go through `server.js` using the Firebase Admin SDK. Admin SDK calls are trusted server calls and do not use browser security rules.

### Item image schema

Newly registered items store one compressed WebP image inside the item document:

```json
{
  "image": {
    "kind": "embedded",
    "contentType": "image/webp",
    "byteLength": 248000,
    "data": "data:image/webp;base64,..."
  }
}
```

The browser resizes images to a maximum 960px edge and compresses them before upload. The server rejects non-WebP images and images larger than 450 KB. Authority submissions use the authenticated `api.js` client and send the embedded image to the server; the server writes the image object to Firestore. Base64 image data is stored only in Firestore; Firebase Storage is not required for the current single-photo workflow. Seed/demo records may use an external `image.url` value until they are replaced by uploaded records.

The API currently provides:

- `GET /api/health`
- `GET /api/me`
- `GET /api/items`
- `GET /api/items/:itemId`
- `POST /api/items` — authority only; accepts one embedded WebP image
- `GET /api/lost-reports` — authority only
- `POST /api/lost-reports`
- `PATCH /api/lost-reports/:reportId` — authority only
- `POST /api/handovers` — authority only

Required server environment variables are documented in `.env.example`. Never put the Firebase Admin private key in `index.html` or any browser JavaScript.

## How to Run

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill in the Firebase Admin service-account values. Do not use the public Firebase web API key as the Admin credential.

3. Start the application server:

```bash
npm start
```

4. Open `http://localhost:3000`.

5. Create the staff account through the sign-up screen, then grant its authority role from the project terminal:

```bash
npm run set-authority -- staff@example.com
```

The staff member must sign out and sign in again after this command.

The normal student accounts can browse and report lost items. Authority accounts can register found items through the backend. Opening `index.html` directly still works as a browser-local demo, but backend uploads require the server at `http://localhost:3000`.
