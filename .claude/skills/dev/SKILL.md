---
description: Start the dev server if needed and show the local URL to open in the browser
---

Check if the dev server is already running by curling http://localhost:3000. If it responds, just tell the user the links. If not, start it with `npm run dev` in the background, wait for it to be ready, then tell the user.

Always output these two links clearly:

- Employee form: http://localhost:3000
- Admin panel: http://localhost:3000/admin

Keep the response short — just the status and the links. No extra explanation.
