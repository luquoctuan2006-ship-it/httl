<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/10af7304-b19a-4915-bb94-20bb7685266d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` in the project root and replace the `GEMINI_API_KEY` placeholder with your key from Google AI Studio. Keep the key server-side; do not use a `VITE_*` variable or commit `.env`.
3. Set `GEMINI_MODEL` to the active Flash model (default: `gemini-3.8-flash`) and optionally set `GEMINI_FALLBACK_MODEL` (default: `gemini-3.7-flash`). The server automatically retries with the fallback model when the primary model is temporarily unavailable.
4. Set `GEMINI_CACHE_TTL_MS` to control the cache lifetime for equivalent itinerary and optimization requests (default: `300000`, or 5 minutes). The in-memory cache is scoped by authenticated user and is limited to 200 entries.
5. In Firebase Console, enable **Authentication > Email/Password**, register a Web app, and copy its `apiKey`, `authDomain`, `projectId`, and `appId` into the matching `VITE_FIREBASE_*` variables in `.env`.
6. Place the Firebase Admin service-account JSON at `secrets/firebase-service-account.json`, or set `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env`. Keep this file private and server-side.
7. Enable Cloud Firestore in the Firebase project. The app creates `trips/active` from its sample itinerary the first time an authenticated user opens it; only admins can save changes or call Gemini APIs.
8. Register an account in the app, find its Firebase Authentication UID, and grant the admin claim from this trusted server environment:
   `npm run set:role -- <firebase-user-uid> admin`
   Use `npm run set:role -- <firebase-user-uid> user` to revoke admin access. The user must sign out and sign in again for the updated role to take effect.
7. Run the app:
   `npm run dev`

New registrations receive the `user` role automatically. Admin access is determined by a Firebase custom claim and verified by the server for every protected API request; never set admin roles from client code.
