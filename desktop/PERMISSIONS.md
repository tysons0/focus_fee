# Focus Fee — Permissions & Setup

## Important: Use the Desktop App, Not the Browser

**Real focus detection only works in the Electron desktop app.** When you run the app in a web browser (`npm run dev:web`), it cannot detect other windows — that's a browser security restriction. Always run:

```bash
npm run dev
```

This launches the Electron desktop app, which can read window titles.

---

## Windows Permissions

On Windows, **no special permissions are required**. The `active-win` library uses standard Windows APIs to read window titles and doesn't need:

- Administrator rights
- Accessibility settings
- Screen recording permission
- Any changes in Windows Settings

If detection is flaky, try:

1. **Run as normal user** — Don't run Electron as Administrator (can cause issues)
2. **Antivirus** — Some antivirus software may block low-level window access; add an exception for the app if needed
3. **Windows Defender** — Usually fine; if you have third-party security, it might interfere

---

## Chrome / Google (Browser) — Not Applicable

There are **no Chrome or Google permissions** to configure for window titles. Here's why:

- **In the browser:** Web pages cannot read other windows' titles — it's a security feature. The browser version of Focus Fee cannot do real detection.
- **In the Electron app:** The app reads Windows system APIs directly. Chrome is not involved. When you have Chrome open with YouTube, the Electron app sees the window title (e.g. "YouTube - Google Chrome") from Windows, not from Chrome.

**You do not need to enable anything in Chrome settings.**

---

## If Focus Detection Is Still Flaky

1. Check the **console** when running the desktop app (View → Toggle Developer Tools, or the terminal where you ran `npm run dev`). Debug logs print every ~15 seconds:
   - Blacklist
   - Active window title & owner
   - Why it matched or didn't match

2. Check the **blacklist** shown in the app UI — make sure terms match your window titles (e.g. "youtube" matches "YouTube - Google Chrome").

3. Ensure you're running the **Electron app**, not the web version.
