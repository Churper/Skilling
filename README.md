# Skilling

Three.js web prototype deployed via GitHub Pages.

## Current Stack
- Three.js (module import map from jsDelivr)
- OrbitControls with isometric-style camera freedom
- Click/tap-to-move + camera-relative WASD
- Stylized water shader and low-poly environment
- `docs/` as static Pages target

## Controls
- Left click/tap terrain: Move
- `WASD` / arrow keys: Move (camera-relative)
- Middle mouse hold: Pan camera
- Right mouse hold: Rotate camera
- Mouse wheel: Zoom
- Mobile: One-finger pan, two-finger rotate/zoom

## GitHub Pages
1. Keep source in `docs/`.
2. Push to `main`.
3. Workflow at `.github/workflows/deploy-pages.yml` publishes the site.

## Local Dev
Serve `docs/` with any static server.

Example:
```powershell
cd docs
python -m http.server 8080
```
Then open `http://localhost:8080`.

## Online Play (Realtime Presence)
`Skilling` now supports live room presence with remote player movement sync over WebSocket.

### Run relay locally
```powershell
cd server
npm install
npm start
```
Relay listens on `ws://localhost:8081`.

### Run game client locally
```powershell
cd docs
python -m http.server 8080
```
Open `http://localhost:8080` in two tabs/devices. They auto-connect to `ws://localhost:8081` on localhost.

### Connect to hosted relay
Use URL params:
`?ws=wss://your-relay.example.com&room=main&name=YourName`

Example:
`https://<your-pages-site>/?ws=wss://relay.example.com&room=alpha`
