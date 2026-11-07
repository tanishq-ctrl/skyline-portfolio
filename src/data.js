// Single source of truth for the whole site. The skyline, the experience
// ledger, the SQL console and the skills matrix all read from this file.
// Replace every entry with your own facts. The sample content below is
// fictional and exists only to show the shape of each section.

export const PERSON = {
  name: 'Alex Example',
  first: 'Alex',
  last: 'Example',
  role: 'Data Analyst',
  city: 'Dubai',
  country: 'AE',
  countryName: 'UAE',
  email: 'alex@example.com',
  phone: '+971 50 000 0000',
  phoneHref: 'tel:+971500000000',
  linkedin: 'https://www.linkedin.com/in/your-handle',
  github: 'https://github.com/your-handle',
  site: 'https://your-site.example',
  cv: '/CV.pdf', // put your PDF in public/ and update this path
  lede: 'Data analyst in Dubai. I turn operational data into numbers leadership can trust, and build the tools that keep them that way.',
  description: 'Data analyst in Dubai working in SQL, Python and Power BI. Sample portfolio template.',
};

// Employers in time order. `hue` is the colour each one carries everywhere:
// skyline towers, ledger rows, matrix columns.
export const PLACES = [
  { id: 'alpha', name: 'Alpha Training', full: 'Alpha Training Institute', years: '2022–23', hue: '#86B6E0' },
  { id: 'beta', name: 'Beta Realty', full: 'Beta Realty Brokerage', years: '2024', hue: '#FFB45E' },
  { id: 'gamma', name: 'Gamma Developments', full: 'Gamma Developments', years: '2024–now', hue: '#EE8FB0' },
  { id: 'study', name: 'MSc & projects', full: 'MSc study and own projects', years: '2023–25', hue: '#B9A7E8' },
];
export const placeById = Object.fromEntries(PLACES.map((p) => [p.id, p]));

// One tower per result. `v` drives the height (log10), `show` is the label.
export const METRICS = [
  { place: 'alpha', v: 150, show: '150+', short: '150', what: 'leads a month', more: 'handled by the automated enquiry platform' },
  { place: 'alpha', v: 6, show: '6', short: '6', what: 'courses sold online', more: 'through the student portal, with card payments' },
  { place: 'alpha', v: 30, show: '30%', short: '30%', what: 'rise in enrolments', more: 'in the first quarter after the portal launched' },

  { place: 'beta', v: 800, show: '800', short: '800', what: 'spreadsheets consolidated', more: 'each with its own layout, merged into one database' },
  { place: 'beta', v: 1200000, show: '1.2M', short: '1.2M', what: 'records in one database', more: 'finding a record went from days to minutes' },
  { place: 'beta', v: 3500, show: '3,500', short: '3.5k', what: 'listings analysed', more: 'across 6 communities, with regression analysis' },
  { place: 'beta', v: 1000, show: '1,000+', short: '1k', what: 'calls tracked a day', more: 'on a real-time telesales dashboard' },

  { place: 'gamma', v: 50000, show: '50,000', short: '50k', what: 'transaction records', more: 'turned into competitor benchmarking packs' },
  { place: 'gamma', v: 900, show: '900+', short: '900', what: 'automated checks', more: 'that recompute every published figure from source' },
  { place: 'gamma', v: 120, show: '120', short: '120', what: 'DAX measures', more: 'in a Power BI model for the sales team' },
  { place: 'gamma', v: 400, show: '400+', short: '400', what: 'unit tests', more: 'guarding the business rules of the internal portal' },
  { place: 'gamma', v: 110, show: '110', short: '110', what: 'employees on the leave planner', more: 'built on SharePoint and Power Automate' },
];

export const ROLES = [
  {
    place: 'gamma', title: 'Data Analyst', company: 'Gamma Developments',
    from: '2024-08', to: null, dates: 'Aug 2024 – now',
    figure: '50,000', figureLabel: 'records benchmarked',
    summary: 'Market research and internal tools for the sales and people teams.',
    points: [
      'Turned about 50,000 transaction records into competitor benchmarking packs for three projects.',
      'Built a verification layer of 900+ checks that recomputes every published figure from source.',
      'Built a Power BI sales suite with 120 DAX measures covering a six-stage funnel.',
      'Built an internal training portal (Next.js, TypeScript, PostgreSQL) with 400+ unit tests.',
    ],
  },
  {
    place: 'beta', title: 'Data Analyst', company: 'Beta Realty Brokerage',
    from: '2024-02', to: '2024-08', dates: 'Feb – Aug 2024',
    figure: '1.2M', figureLabel: 'records consolidated',
    summary: 'Sole data hire at a brokerage, owning the data function end to end.',
    points: [
      'Built a Python ETL pipeline that merged 800 spreadsheets into a validated 1.2 million record database.',
      'Analysed 3,500 live listings across 6 communities with regression and distribution analysis.',
      'Delivered a real-time telesales dashboard tracking 1,000+ calls a day.',
    ],
  },
  {
    place: 'alpha', title: 'Data Associate', company: 'Alpha Training Institute',
    from: '2022-05', to: '2023-12', dates: 'May 2022 – Dec 2023',
    figure: '5 min', figureLabel: 'onboarding, down from 24 h',
    summary: 'First technical hire at a training company.',
    points: [
      'Replaced a manual enquiry process with an automated platform and CRM sync handling 150+ leads a month.',
      'Built a student portal for 6 courses with online payments, contributing to a 30% rise in enrolments.',
    ],
  },
];

// Screenshots live in public/assets/shots/<name>.webp (1600 x 1000 works well).
export const PROJECTS = [
  {
    id: 'search', name: 'Property search', place: 'beta', year: 2024,
    line: 'Property search in plain language.',
    body: 'Listings arrive through webhooks. A natural-language parser turns a typed search into filters, and a vector index reranks the results by meaning.',
    stack: 'Next.js, TypeScript, PostgreSQL, pgvector',
    result: 'A production property portal',
    url: 'https://example.com',
    shots: ['sample-1', 'sample-2'],
  },
  {
    id: 'calls', name: 'Telesales dashboard', place: 'beta', year: 2024,
    line: 'Live call analytics for sales leadership.',
    body: 'Pulls the dialler API into a real-time dashboard. When the live connection hit its quota, I moved from WebSocket subscriptions to smart polling.',
    stack: 'Supabase, dialler API',
    result: '1,000+ calls a day across 20 KPIs',
    url: 'https://example.com',
    shots: ['sample-3'],
  },
  {
    id: 'enquiries', name: 'Enquiry platform', place: 'alpha', year: 2023,
    line: 'An automated platform in place of a manual process.',
    body: 'A new site, CRM sync and a student portal with online payments. A form submission now triggers the welcome email and sales call on its own.',
    stack: 'Next.js, TypeScript, PostgreSQL',
    result: 'Onboarding from 24 hours to under 5 minutes',
    url: 'https://example.com',
    shots: ['sample-4'],
  },
];

// Internal tools without screenshots.
export const INTERNAL = [
  { name: 'Internal training portal', fig: '400+ tests', note: 'Sessions, assessments and coaching in one place, with row-level security.' },
  { name: 'Sales productivity suite', fig: '120 measures', note: 'Seven Power BI pages on a 20-table model, version-controlled in TMDL.' },
  { name: 'Annual leave planner', fig: '110 people', note: 'SharePoint and Power Automate, with clash detection for HR.' },
];

// Skills matrix. Each cell is evidence: where the skill was used and how.
export const SKILLS = [
  { skill: 'SQL and PostgreSQL', cat: 'Data', at: { alpha: 'PostgreSQL behind the enquiry platform', beta: 'PostgreSQL behind the dashboard and search', gamma: 'PostgreSQL with row-level security in the portal' } },
  { skill: 'Python', cat: 'Data', at: { beta: 'The ETL pipeline that merged 800 spreadsheets', gamma: 'A staging pipeline and the verification checks', study: 'Machine learning coursework' } },
  { skill: 'Power BI and DAX', cat: 'BI', at: { gamma: 'A sales suite with 120 DAX measures' } },
  { skill: 'Statistics and regression', cat: 'Analysis', at: { beta: 'Regression on 3,500 listings', study: 'MSc modules in predictive analytics' } },
  { skill: 'Dashboards and KPIs', cat: 'BI', at: { beta: 'A real-time telesales dashboard', gamma: 'A six-stage sales funnel' } },
  { skill: 'Next.js and TypeScript', cat: 'Build', at: { alpha: 'The enquiry platform and student portal', beta: 'The property search', gamma: 'The internal training portal' } },
  { skill: 'Power Platform and SharePoint', cat: 'Build', at: { gamma: 'The leave planner and Power Automate flows' } },
  { skill: 'LLMs and vector search', cat: 'AI', at: { beta: 'Natural-language search with pgvector', study: 'Retrieval-augmented search and agents' } },
  { skill: 'Stakeholder work', cat: 'People', at: { beta: 'Findings reported to the director', gamma: 'Requirements agreed with HR' } },
];

export const EDUCATION = [
  { degree: 'MSc, Data Science', school: 'Example University', dates: '2023 – 2025', note: 'In progress. Machine learning, big data analytics, predictive analytics.' },
  { degree: 'BSc, Economics and Analytics', school: 'Example College', dates: '2019 – 2022', note: 'First Class.' },
];

export const CERTS = [
  { name: 'Data Analytics Professional Certificate', by: 'Google', when: '2023' },
  { name: 'Azure Data Engineer Associate', by: 'Microsoft', when: '2024' },
  { name: 'Certified in Cybersecurity', by: 'ISC2', when: '' },
];

// Months between two YYYY-MM strings (to = null means this month).
export function monthsBetween(from, to) {
  const [fy, fm] = from.split('-').map(Number);
  const now = new Date();
  const [ty, tm] = to ? to.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  return Math.max(1, (ty - fy) * 12 + (tm - fm));
}
