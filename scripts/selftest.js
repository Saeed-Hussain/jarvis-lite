/**
 * Self-test for the pure logic.
 *
 * Everything checked here is deliberately free of the DOM, Electron and the
 * OS: the planner, the filesystem phrasing, Pilot's grounder and the
 * validator that stands between the local model and anything that can act.
 * That is the code where a silent mistake is most expensive and a test is
 * cheapest — a wrong grounding score or a validator that lets an unknown
 * intent through does not announce itself.
 *
 * Run with: npm run selftest
 */

const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');

/** Bundle a TS module to CommonJS and load it, without a build step on disk. */
function load(entry) {
  const result = esbuild.buildSync({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    logLevel: 'silent',
  });
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected ${b}\n    got      ${a}`);
}

function ok(name, condition, detail = '') {
  if (condition) passed++;
  else failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Filesystem phrasing
// ---------------------------------------------------------------------------
{
  const { extractPathQuery, splitSteps } = load('lib/nlu.ts');
  const q = (text) => extractPathQuery(text)?.query ?? null;

  check('"open d drive"', q('open d drive'), 'D drive');
  check('"go to the d drive"', q('go to the d drive'), 'D drive');
  check('"open D:\\projects"', q('open D:\\projects'), 'D:\\projects');
  check('"open the projects folder"', q('open the projects folder'), 'projects');
  check('"go to downloads"', q('go to downloads'), 'downloads');
  check('"d drive projects folder"', q('open d drive projects folder'), 'D:\\projects');

  // The important negatives: an app is not a folder.
  ok('"open chrome" is not a path', q('open chrome') === null, `got ${q('open chrome')}`);
  ok('"search for cats" is not a path', q('search for cats') === null, `got ${q('search for cats')}`);
  ok('"lock pc" is not a path', q('lock pc') === null, `got ${q('lock pc')}`);

  check(
    'listing is recognised separately',
    extractPathQuery("what's in downloads")?.list,
    true,
  );

  // Unchanged behaviour of the existing splitter, in case the new verbs broke it.
  check('"cats and dogs" stays one step', splitSteps('search for cats and dogs').length, 1);
  check(
    'chained commands still split',
    splitSteps('open chrome and lock pc').length,
    2,
  );
}

// ---------------------------------------------------------------------------
// The validator between the model and the machine
// ---------------------------------------------------------------------------
{
  const { validatePlan, extractJson } = load('lib/brain/schema.ts');

  const plan = validatePlan([
    { intent: 'open_app', app: 'chrome' },
    { intent: 'open_path', path: 'D:\\projects' },
  ]);
  check('a valid plan survives', plan.map((t) => t.kind), ['open_app', 'open_path']);

  // An intent nobody defined must produce nothing at all, not a guess.
  check('an invented intent is dropped', validatePlan([{ intent: 'rm_rf', path: '/' }]).length, 0);
  check('a missing required field drops the step', validatePlan([{ intent: 'open_app' }]).length, 0);
  check(
    'an unknown system verb is dropped',
    validatePlan([{ intent: 'system', action: 'format_disk' }]).length,
    0,
  );

  // The model does not get to decide what is dangerous.
  const shutdown = validatePlan([{ intent: 'system', action: 'shutdown', dangerous: false }])[0];
  ok('shutdown is marked dangerous regardless of what the model said', shutdown?.dangerous === true);

  // A non-http scheme must never reach the shell.
  check(
    'a file:// url is refused',
    validatePlan([{ intent: 'open_site', site: 'file:///C:/Windows/System32' }]).length,
    0,
  );

  check('JSON in a fenced block is found', extractJson('```json\n[{"intent":"time"}]\n```'), [
    { intent: 'time' },
  ]);
  check('JSON wrapped in prose is found', extractJson('Sure! [{"intent":"date"}] Hope that helps.'), [
    { intent: 'date' },
  ]);
  check('unparseable output yields null', extractJson('I cannot help with that.'), null);
}

// ---------------------------------------------------------------------------
// Pilot grounding
// ---------------------------------------------------------------------------
{
  const { ground, normalizeName } = load('lib/pilot/grounder.ts');

  const el = (name, extra = {}) => ({
    name,
    role: 'Button',
    id: '',
    cls: '',
    help: '',
    enabled: true,
    x: 10,
    y: 10,
    w: 80,
    h: 24,
    ...extra,
  });

  check('access-key ampersands are ignored', normalizeName('&Save'), 'save');
  check('a shortcut hint is ignored', normalizeName('Save (Ctrl+S)'), 'save');

  const found = ground({ name: 'Save', role: 'Button' }, [el('Cancel'), el('Save', { y: 50 })]);
  ok('an exact name is found', found.ok, found.reason);
  check('it clicks the centre of the right control', [found.x, found.y], [50, 62]);

  // The case that matters most: two equally good matches is not a decision.
  const ambiguous = ground({ name: 'Delete', role: 'Button' }, [
    el('Delete', { y: 10 }),
    el('Delete', { y: 60 }),
  ]);
  ok('two identical targets refuse rather than guess', !ambiguous.ok, 'it picked one anyway');
  ok('and the confidence reflects the ambiguity', ambiguous.confidence < 0.6, `got ${ambiguous.confidence}`);

  // ...unless the recording pinned which one.
  const nth = ground({ name: 'Delete', role: 'Button', nth: 1 }, [
    el('Delete', { y: 10 }),
    el('Delete', { y: 60 }),
  ]);
  ok('an nth resolves the ambiguity', nth.ok, nth.reason);
  check('and picks the second one in reading order', nth.y, 72);

  // A disabled control looks like a successful click and does nothing.
  const disabled = ground({ name: 'Save', role: 'Button' }, [el('Save', { enabled: false })]);
  ok('a disabled control is not chosen', !disabled.ok, 'it clicked a disabled control');

  const missing = ground({ name: 'Save' }, [el('Cancel'), el('Help')]);
  ok('nothing matching is reported, not approximated', !missing.ok);
  check('an empty tree is handled', ground({ name: 'Save' }, []).ok, false);
}

// ---------------------------------------------------------------------------
// The guard
// ---------------------------------------------------------------------------
{
  const guard = require(path.join(root, 'electron', 'pilot', 'guard.js'));

  check(
    'a recursive delete is blocked outright',
    guard.judge({ type: 'type', text: 'rm -rf /' }).verdict,
    'block',
  );
  check(
    'typing into a shell needs a yes',
    guard.judge({ type: 'type', text: 'ls' }, { processName: 'powershell' }).verdict,
    'confirm',
  );
  check(
    'a banking window is refused entirely',
    guard.judge({ type: 'click', targetName: 'OK' }, { windowTitle: 'My Bank — Transfer' }).verdict,
    'block',
  );
  check(
    'a permanent delete button is blocked',
    guard.judge({ type: 'click', targetName: 'Delete' }).verdict,
    'block',
  );
  check(
    'but "Deleted items" is ordinary',
    guard.judge({ type: 'click', targetName: 'Deleted items' }).verdict,
    'allow',
  );
  check(
    'paying money needs a yes',
    guard.judge({ type: 'click', targetName: 'Pay now' }).verdict,
    'confirm',
  );
  check(
    'a move into System32 is blocked on its destination',
    guard.judge({ type: 'move_file', path: 'C:\\Users\\me\\a.txt', to: 'C:\\Windows\\System32\\a.txt' }).verdict,
    'block',
  );
  check('an ordinary click is allowed', guard.judge({ type: 'click', targetName: 'New' }).verdict, 'allow');
}

// ---------------------------------------------------------------------------
// Command routing: every alias, and the phrasings that used to misfire
// ---------------------------------------------------------------------------
{
  const { planUtterance } = load('lib/planner.ts');
  const { KNOWN_APPS, KNOWN_SITES } = load('lib/commands.ts');
  const memory = { last_command: '', last_app: '', custom_commands: {}, contacts: { 'john smith': '+15550000' }, logs: [] };

  /** A plan as one comparable line: "kind:target" per task, plus the slot named. */
  const route = (text, slot) =>
    planUtterance(text, memory)
      .tasks.map((t) => [t.kind + (t.target ? `:${t.target}` : ''), slot ? t[slot] : undefined].filter(Boolean).join(' '))
      .join(' | ');

  const misrouted = [];
  for (const app of KNOWN_APPS) {
    for (const alias of app.aliases) {
      if (route(`open ${alias}`) !== `open_app:${app.key}`) misrouted.push(`open ${alias} -> ${route(`open ${alias}`)}`);
    }
  }
  for (const site of KNOWN_SITES) {
    for (const alias of site.aliases) {
      if (route(`open ${alias}`) !== `open_site:${site.key}`) misrouted.push(`open ${alias} -> ${route(`open ${alias}`)}`);
    }
  }
  ok('every app and site alias opens itself', misrouted.length === 0, misrouted.join('; '));

  // Safety first: a search must never reach a system action.
  check('"search how to lock files" searches', route('search how to lock files', 'query'), 'search how to lock files');
  check('"find restart instructions" searches', route('find restart instructions'), 'search');
  check('"restart chrome" restarts chrome, not the PC', route('restart chrome'), 'close_app:chrome | wait | open_app:chrome');
  check('"close chrome" closes it', route('close chrome'), 'close_app:chrome');

  check('"docker desktop" is the app, not the Desktop folder', route('open docker desktop'), 'open_app:docker');
  check('"play music" is not the Music folder', route('open spotify and play music'), 'open_app:spotify | unknown:play music');
  check('apostrophes are not quotes', route("what's today's date"), 'query_date');
  check('"what is today"', route('what is today'), 'query_date');
  check('"tell me the time" is a question', route('tell me the time'), 'query_time');
  check('time somewhere else is a search', route('what time is it in tokyo', 'query'), 'search time in tokyo');
  check('bare "whatsapp web" opens the site', route('whatsapp web'), 'open_site:whatsappweb');

  check('"text sara hello"', route('text sara hello', 'message'), 'send_message hello');
  check('"text sara hello" names sara', route('text sara hello', 'recipient'), 'send_message sara');
  check('"send a message to john saying hi"', route('send a message to john saying hi', 'recipient'), 'send_message john');
  check('"send hi to sara"', route('send hi to sara', 'message'), 'send_message hi');
  check('"tell sara I\'m coming"', route("tell sara I'm coming", 'message'), "send_message I'm coming");
  check('a saved two-word contact', route('text john smith hi', 'recipient'), 'send_message john smith');
  check('a number then a body', route('whatsapp +1 555 123 4567 hi there', 'message'), 'send_message hi there');

  check('site search: on youtube', route('search lofi on youtube', 'query'), 'search:youtube lofi');
  check('site search: github for', route('search github for react', 'query'), 'search:github react');
  check('play on youtube', route('play despacito on youtube'), 'search:youtube');
  check('open a site then search it', route('open youtube and search lofi beats', 'query'), 'search:youtube lofi beats');
  check('plain search stays google', route('search for cats and dogs', 'query'), 'search cats and dogs');
}

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed\n`);
for (const failure of failures) console.error(`  ✗ ${failure}\n`);
process.exit(failures.length ? 1 : 0);
