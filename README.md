# web
## Run on a till (standalone build)

The Windows hub till runs this same app against its own local POS service (offline sync, restiq-web#304).

```bash
RESTIQ_STANDALONE=1 pnpm build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
RESTIQ_API_URL=http://127.0.0.1:8180 PORT=3100 node .next/standalone/server.js
```

`RESTIQ_API_URL` is read when the server starts handling requests, so one build serves any API address. Without it the app uses `NEXT_PUBLIC_API_URL`, as on Vercel.
