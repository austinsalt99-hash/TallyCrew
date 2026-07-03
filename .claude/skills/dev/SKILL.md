---
description: Start the Next.js dev server and show the local URL to open in the browser
---

1. Check if the dev server is already running by curling http://localhost:3000.
2. If it responds, just tell the user the links below — don't start another server.
3. If it is NOT running, start it with `npm run dev` using `run_in_background: true` so terminal output (hot reload, errors) stays visible. Wait until localhost:3000 responds before showing the links.

Always output these two links clearly:

- **App (employee view):** http://localhost:3000
- **Admin panel:** http://localhost:3000/admin

Keep the response short — just the status and the links.
