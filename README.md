# Reddit Clone

CSE 343 Web Development — Fall 26 group project.

MERN stack Reddit clone: React client, Express + Socket.IO server, MongoDB via Mongoose.

## Structure

- `client/` — React frontend (Vite, React Router, Axios, Socket.IO client)
- `server/` — Express backend (Mongoose models, controllers, routes, Socket.IO chat)

See `reddit_clone_project_structure_v2.md` in the parent folder for the full architecture and API spec.

## Getting started

Install dependencies in each package once `package.json` files exist:

```bash
cd server && npm install
cd ../client && npm install
```

Create `server/.env` from `server/.env.example` and fill in the values, then:

```bash
cd server && npm run dev
cd client && npm run dev
```
