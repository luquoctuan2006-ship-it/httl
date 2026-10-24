
## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` in the project root and replace the `GEMINI_API_KEY` placeholder with your key from Google AI Studio. Keep the key server-side; do not use a `VITE_*` variable or commit `.env`.
3. Set `GEMINI_MODEL` to the active Flash model (default: `gemini-3.8-flash`) and optionally set `GEMINI_FALLBACK_MODEL` (default: `gemini-3.7-flash`). The server automatically retries with the fallback model when the primary model is temporarily unavailable.
4. Set `GEMINI_CACHE_TTL_MS` to control the cache lifetime for equivalent itinerary and optimization requests (default: `300000`, or 5 minutes). The in-memory cache is scoped by authenticated user and is limited to 200 entries.
5. Set `GEMINI_TIMEOUT_MS` to control each Gemini request timeout. The default is `30000` milliseconds; values below `30000` are ignored.
6. In Firebase Console, enable **Authentication > Email/Password**, register a Web app, and copy its `apiKey`, `authDomain`, `projectId`, and `appId` into the matching `VITE_FIREBASE_*` variables in `.env`.
7. Place the Firebase Admin service-account JSON at `secrets/firebase-service-account.json`, or set `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env`. Keep this file private and server-side.
8. Enable Cloud Firestore in the Firebase project. The app creates `trips/active` from its sample itinerary the first time an authenticated user opens it; each signed-in user owns and can edit their own trips and can call the Gemini APIs (create/optimize tours); admins manage and monitor the system (users, rules, AI config, logs, all trips).
8. Register an account in the app, find its Firebase Authentication UID, and grant the admin claim from this trusted server environment:
   `npm run set:role -- <firebase-user-uid> admin`
   Use `npm run set:role -- <firebase-user-uid> user` to revoke admin access. The user must sign out and sign in again for the updated role to take effect.
7. Run the app:
   `npm run dev`

