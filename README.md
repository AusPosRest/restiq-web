# web

## Deploying to Cloudflare Workers

Production (`dailypos.shop` and every tenant subdomain) runs on Cloudflare Workers through
[OpenNext](https://opennext.js.org/cloudflare). Use Node 22 and pnpm.

```sh
pnpm preview     # build the Worker and serve it locally (needs .dev.vars, see .dev.vars.example)
pnpm run deploy  # build and publish the restiq-web Worker
```

- `PROXY_SHARED_SECRET` is a Worker secret, set once with `pnpm exec wrangler secret put PROXY_SHARED_SECRET`.
- `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_BASE_DOMAIN` are inlined at build time from the committed
  `.env.production`. `pnpm run deploy` refuses to run while `.env.local` exists, because Next and OpenNext
  would let it override `.env.production` and bundle it into the Worker.
- `wrangler.jsonc` routes `dailypos.shop/*` and `*.dailypos.shop/*` to the Worker. `api.dailypos.shop` is
  the backend: a route for `api.dailypos.shop/*` with no Worker, set in the Cloudflare dashboard, keeps
  those requests going to the origin.
