# Run-Calc Help Site

React + Vite help app for Firebase Hosting.

## Local development

1. Install dependencies:
   - `cd site`
   - `npm install --no-audit --no-fund`
2. Start dev server:
   - `npm run dev`

## Production build

1. Build static assets:
   - `cd site`
   - `npm run build`
2. Output is generated to `site/dist`.

## Firebase setup

1. Install Firebase CLI if needed:
   - `npm install -g firebase-tools`
2. Set your project id in `.firebaserc`:
   - replace `YOUR_FIREBASE_PROJECT_ID`
3. Login:
   - `firebase login`
4. Build and deploy:
   - `cd site && npm run build`
   - `firebase deploy --only hosting`

## Notes

- Hosting root is configured as `site/dist` in `firebase.json`.
- Core help content lives in `site/src/content/helpContent.ts` and is reused by in-app Help.
