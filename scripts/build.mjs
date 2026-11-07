// Renders src/index.html into public/index.html with the content sections
// filled in from src/data.js, then bundles the JS and CSS with esbuild.
import { readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { metricList, ledger, work, internal, matrix, study, legend } from '../src/render.js';
import { PERSON } from '../src/data.js';

const watch = process.argv.includes('--watch');
const version = Date.now().toString(36);

function page() {
  const name = [PERSON.first, PERSON.last]
    .map((w, wi) => `<span class="w" aria-hidden="true">${[...w].map((c, i) => `<span class="ch" style="--i:${wi * 7 + i}">${c}</span>`).join('')}</span>`)
    .join(' ');
  const { ed, certs } = study();
  const html = readFileSync('src/index.html', 'utf8')
    .replaceAll('@@VERSION@@', version)
    .replaceAll('@@FULLNAME@@', PERSON.name)
    .replaceAll('@@TITLE@@', `${PERSON.name}, ${PERSON.role.toLowerCase()} in ${PERSON.city}`)
    .replaceAll('@@DESCRIPTION@@', PERSON.description)
    .replaceAll('@@SITE@@', PERSON.site)
    .replaceAll('@@LEDE@@', PERSON.lede)
    .replaceAll('@@CITY@@', PERSON.city)
    .replaceAll('@@COUNTRYNAME@@', PERSON.countryName)
    .replaceAll('@@ROLE@@', PERSON.role)
    .replaceAll('@@EMAIL@@', PERSON.email)
    .replaceAll('@@PHONE@@', PERSON.phone)
    .replaceAll('@@PHONEHREF@@', PERSON.phoneHref)
    .replaceAll('@@LINKEDIN@@', PERSON.linkedin)
    .replaceAll('@@GITHUB@@', PERSON.github)
    .replaceAll('@@CV@@', PERSON.cv)
    .replaceAll('@@YEAR@@', String(new Date().getFullYear()))
    .replace('@@JSONLD@@', JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', name: PERSON.name, jobTitle: PERSON.role, address: { '@type': 'PostalAddress', addressLocality: PERSON.city, addressCountry: PERSON.country }, email: `mailto:${PERSON.email}`, url: PERSON.site, sameAs: [PERSON.linkedin, PERSON.github] }))
    .replace('@@NAME@@', name)
    .replace('@@LEGEND@@', legend())
    .replace('@@METRICS@@', metricList())
    .replace('@@LEDGER@@', ledger())
    .replace('@@WORK@@', work())
    .replace('@@INTERNAL@@', internal())
    .replace('@@MATRIX@@', matrix())
    .replace('@@EDUCATION@@', ed)
    .replace('@@CERTS@@', certs);
  if (html.includes('@@')) throw new Error('Unfilled placeholder in src/index.html');
  writeFileSync('public/index.html', html);
}

page();
await build({ entryPoints: ['src/main.js'], bundle: true, minify: !watch, format: 'esm', target: 'es2020', outfile: 'public/assets/app.js', sourcemap: watch, legalComments: 'none' });
await build({ entryPoints: ['src/site.css'], bundle: true, minify: !watch, outfile: 'public/assets/site.css', external: ['/assets/*'] });
console.log(`built ${version}`);
