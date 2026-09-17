# Singalong

Singalong is a social karaoke app. Hosts create rooms, guests join with a
nickname, and participants can add songs to their personal room list.

## Live app

https://singalong-karaoke-20260916.web.app

## Current features

- Firebase email/password and Google authentication for hosts
- Host dashboard with previous sessions
- Firestore-backed session creation
- Anonymous participant sign-in
- Participant join links using a room code
- Nickname-only participant onboarding
- Participant availability and skip controls
- Realtime participant list for hosts
- Participants can add multiple songs with a YouTube URL
- YouTube oEmbed title lookup for better song entry UX
- Material UI responsive layouts
- Mobile-friendly participant room interface

## Project structure

```text
frontend/
  src/
    components/       Reusable Material UI components
    context/          Firebase authentication context
    hooks/            Firestore realtime hooks
    lib/              Firebase and data-access functions
    pages/            Landing, auth, dashboard, room, and join screens
firebase.json         Firebase Hosting and Firestore configuration
firestore.rules       Firestore security rules
firestore.indexes.json Firestore index configuration
```

## Local development

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Add the Firebase web app values to `frontend/.env`. The Firebase project is:

```text
singalong-karaoke-20260916
```

## Firebase setup

The following Authentication providers must be enabled in Firebase Console:

- Email/Password
- Google
- Anonymous

Firebase Console:

https://console.firebase.google.com/project/singalong-karaoke-20260916/overview

Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

## Firestore model

```text
sessions/{sessionId}
sessions/{sessionId}/participants/{participantId}
sessions/{sessionId}/participants/{participantId}/songs/{songId}
sessions/{sessionId}/queue/{queueItemId}
```

Songs currently stay under each participant. The shared queue collection is
reserved for the next queue-management step.

## Deployment

Build and deploy the frontend:

```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

The Hosting configuration serves `frontend/dist` and rewrites routes to the
Vite entry point so participant links such as `/join/ROOMCODE` work correctly.

## Checks

```bash
cd frontend
npm run typecheck
npm run build
```
