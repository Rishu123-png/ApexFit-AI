const client = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];
const server = ['FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PRIVATE_KEY'];
const ai = ['GROQ_API_KEY_PRIMARY'];
const isPresent = (name) => Boolean(process.env[name]?.trim());
const missing = (names) => names.filter((name) => !isPresent(name));
const production = process.argv.includes('--production');

const groups = [
  ['Firebase client', client, true],
  ['Firebase Admin', server, production],
  ['AI Coach', ai, production],
];
let failed = false;
for (const [label, names, required] of groups) {
  const absent = missing(names);
  if (absent.length === 0) {
    console.log(`✓ ${label}: configured`);
  } else if (required) {
    failed = true;
    console.error(`✗ ${label}: missing ${absent.join(', ')}`);
  } else {
    console.warn(`! ${label}: optional in local mode; missing ${absent.join(', ')}`);
  }
}

if (!isPresent('NEXT_PUBLIC_SITE_URL')) console.warn('! Site URL: NEXT_PUBLIC_SITE_URL is missing; metadata will use localhost.');
if (!isPresent('UPSTASH_REDIS_REST_URL') || !isPresent('UPSTASH_REDIS_REST_TOKEN')) console.warn('! Rate limits: using the per-instance fallback because Upstash is not configured.');
if (failed) {
  console.error('\nEnvironment validation failed. Add the missing variables and run this command again. Values are never printed.');
  process.exit(1);
}
console.log(`\nEnvironment validation passed (${production ? 'production' : 'local'} mode).`);
