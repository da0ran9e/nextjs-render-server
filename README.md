# Deploy Next.js to Render

This is a Next.js template which can be deployed to [Render](https://render.com).

## Deploying to Render

This template can be used to deploy your Next.js application as a Node.js server.

## Album render quality

The album keeps original uploads in Supabase. Browser-facing `/media` responses are generated on demand, cached back into the same bucket under `_render/`, and can be tuned with these Render environment variables:

- `ALBUM_RENDER_IMAGE_MAX_EDGE` default `1600`
- `ALBUM_RENDER_IMAGE_QUALITY` default `72`
- `ALBUM_RENDER_VIDEO_MAX_WIDTH` default `960`
- `ALBUM_RENDER_VIDEO_CRF` default `30`
- `ALBUM_RENDER_VIDEO_PRESET` default `veryfast`
- `ALBUM_RENDER_VIDEO_TIMEOUT_MS` default `120000`
- `ALBUM_RENDER_CACHE_PREFIX` default `_render`

Use `/media?name=<file>&raw=1` to fetch the original file for debugging.

## Album background music

The portfolio can store one YouTube background track. The `/music` route reads and writes a small JSON settings file in Supabase Storage at `_settings/music.json` inside the album bucket. Saving a new track uses the same `UPLOAD_PASSCODE` as media uploads.

### Deploy in one click

1. Fork this repo.
1. In your new repo, click the button below.

<a href="https://render.com/deploy" referrerpolicy="no-referrer-when-downgrade" rel="nofollow">
  <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" />
</a>

Note: The button uses the `render.yaml` file in this repo to deploy your app. For more information about `render.yaml`, see [Render's guide](https://docs.render.com/infrastructure-as-code).

### Deploy manually

1. Fork this repo.
1. Create a new Web Service on Render.
1. Give Render permission to access your new repo.
1. Use the following values during Web Service creation.

- Runtime: Node
- Build Command: `pnpm install; pnpm build`
- Start Command: `pnpm start`

## Learn More
To learn more about deploying Next.js, take a look at the following resources:

- [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying#self-hosting)
- [Deploying Next.js on Render](https://docs.render.com/deploy-nextjs-app)

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
