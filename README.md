# Skyline portfolio template

A personal portfolio where the hero is a procedural city skyline rendered in WebGL. The waterfront towers are your real results, one tower per number, grouped by employer, with height set to log10 of the number. Scrolling dolly-zooms the camera until the city flattens into that bar chart.

Also included:

- **Run the pipeline**: a canvas replay of an ETL job, files in, database out.
- **Query console**: a real SQLite database (sql.js, WebAssembly) built in the browser from your data.
- **Skills matrix**: every dot carries the evidence behind it.
- **Offer sheet**: a contact form styled as a property sales offer that drafts an email in the visitor's own mail client.

No framework, no trackers, no cookies. Static output, deployable anywhere.

## Make it yours

1. `npm install`
2. Edit `src/data.js`. Everything on the page comes from this one file: your name and links (`PERSON`), employers and their colours (`PLACES`), the numbers that become towers (`METRICS`), roles, projects, skills, education and certificates. The sample content is fictional.
3. Put screenshots in `public/assets/shots/` as `.webp` (1600 x 1000 works well) and reference them by file name in `PROJECTS`. The four `sample-*.webp` files are placeholders.
4. Put your CV PDF in `public/` and set `PERSON.cv`.
5. Replace `public/og.jpg` (1200 x 630) with a screenshot of your own hero for link previews.
6. The pipeline section's heading and intro live in `src/index.html`; update the numbers to your own story.
7. `npm run build` renders `public/index.html` and bundles the JS and CSS. Commit `public/` and deploy it as a static site (a `netlify.toml` is included; Vercel and GitHub Pages work the same way).

`npm run serve` serves `public/` locally on port 8080.

## Structure

- `src/data.js`: all content.
- `src/index.html`: page structure, filled in at build time by `src/render.js` so the page reads without JavaScript.
- `src/skyline.js`: the Three.js skyline and its shaders.
- `src/pipeline.js`, `src/console.js`: the two interactive sections.
- `src/site.css`: styles. Employer colours are read from `data.js`.
- `scripts/build.mjs`: the build.

## Licence

MIT. Fonts are Big Shoulders and IBM Plex (SIL Open Font License). Three.js and sql.js are MIT.
