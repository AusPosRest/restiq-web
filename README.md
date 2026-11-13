# web
## Run on a till (standalone build)

The Windows hub till runs this same app against its own local POS service (offline sync, restiq-web#304).

```bash
RESTIQ_STANDALONE=1 pnpm build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
RESTIQ_API_URL=http://127.0.0.1:8180 PORT=3100 node .next/standalone/server.js
```

`RESTIQ_API_URL` is read when the server starts handling requests, so one build serves any API address. Without it the app uses `NEXT_PUBLIC_API_URL`, as on Cloudflare Workers. (`opennextjs-cloudflare build` makes its own standalone build, so `RESTIQ_STANDALONE` does not affect it.)

## Deploying to Cloudflare Workers

Production (`niftypos.com.au` and every tenant subdomain) runs on Cloudflare Workers through
[OpenNext](https://opennext.js.org/cloudflare). Use Node 22 and pnpm.

```sh
pnpm preview     # build the Worker and serve it locally (needs .dev.vars, see .dev.vars.example)
pnpm run deploy  # build and publish the restiq-web Worker
```

- `PROXY_SHARED_SECRET` is a Worker secret, set once with `pnpm exec wrangler secret put PROXY_SHARED_SECRET`.
- `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_BASE_DOMAIN` are inlined at build time from the committed
  `.env.production`. `pnpm run deploy` refuses to run while `.env.local` exists, because Next and OpenNext
  would let it override `.env.production` and bundle it into the Worker.
- `wrangler.jsonc` routes `niftypos.com.au/*` and `*.niftypos.com.au/*` to the Worker. `api.niftypos.com.au` is
  the backend: a route for `api.niftypos.com.au/*` with no Worker, set in the Cloudflare dashboard, keeps
  those requests going to the origin.
