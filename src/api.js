// hook & chill accounts API — runs inside the Cloudflare Worker, stores data in D1.
// Username + password accounts, cloud saves and leaderboards.
// Tables are created automatically on first use.

const SESSION_DAYS = 90;
const PBKDF2_ITERATIONS = 100000; // Workers' maximum
const MAX_SAVE = 400_000; // bytes of JSON per save
const BOARDS = { endless: 'high', rush: 'high', course: 'low', daily: 'low' };

let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS saves (
      user_id INTEGER PRIMARY KEY,
      state TEXT NOT NULL,
      saved_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS scores (
      board TEXT NOT NULL,
      day TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      v REAL NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (board, day, user_id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS fails (
      username TEXT NOT NULL,
      at INTEGER NOT NULL)`),
  ]);
  schemaReady = true;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
const fail = (error, status = 400) => json({ error }, status);

const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n) => toHex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (text) => toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return toHex(bits);
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const USER_RE = /^[a-zA-Z0-9_]{3,16}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

// Sessions: the client keeps a random token; only its SHA-256 is stored.
async function newSession(db, userId) {
  const token = randomHex(32);
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, Date.now() + SESSION_DAYS * 864e5).run();
  return token;
}
async function currentUser(db, request) {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+([a-f0-9]{64})$/i);
  if (!m) return null;
  const th = await sha256(m[1]);
  const row = await db.prepare(
    `SELECT u.id, u.username, u.display, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`)
    .bind(th).first();
  if (!row || row.expires_at < Date.now()) return null;
  return { id: row.id, username: row.display, tokenHash: th };
}

// Slow down password guessing: 8 failed sign-ins per username per 15 minutes.
async function tooManyFails(db, username) {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM fails WHERE username = ? AND at > ?')
    .bind(username, Date.now() - 15 * 60e3).first();
  return row && row.n >= 8;
}

export async function handleApi(request, env) {
  const db = env.DB;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
  const method = request.method;

  if (!db) return fail('Accounts are not set up yet (no database bound).', 503);
  try {
    await ensureSchema(db);

    if (path === '/health') return json({ ok: true });

    if ((path === '/register' || path === '/login') && method === 'POST') {
      const body = await readBody(request);
      const display = String(body.username || '').trim();
      const username = display.toLowerCase();
      const password = String(body.password || '');
      if (!USER_RE.test(display)) return fail('Usernames are 3–16 letters, numbers or _.');
      if (!password || password.length > 128) return fail('Enter your password.');

      if (path === '/register') {
        if (password.length < 6) return fail('Password needs at least 6 characters.');
        const exists = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
        if (exists) return fail('That username is taken — try another, or sign in.', 409);
        const salt = randomHex(16);
        const hash = await hashPassword(password, salt);
        const res = await db.prepare('INSERT INTO users (username, display, pass_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(username, display, hash, salt, Date.now()).run();
        const id = res.meta.last_row_id;
        const token = await newSession(db, id);
        return json({ token, user: { username: display } });
      }

      if (await tooManyFails(db, username)) return fail('Too many attempts — wait 15 minutes and try again.', 429);
      const user = await db.prepare('SELECT id, display, pass_hash, salt FROM users WHERE username = ?').bind(username).first();
      const hash = user ? await hashPassword(password, user.salt) : await hashPassword(password, randomHex(16));
      if (!user || !safeEqual(hash, user.pass_hash)) {
        await db.prepare('INSERT INTO fails (username, at) VALUES (?, ?)').bind(username, Date.now()).run();
        return fail('Wrong username or password.', 401);
      }
      await db.batch([
        db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(user.id, Date.now()),
        db.prepare('DELETE FROM fails WHERE username = ? OR at < ?').bind(username, Date.now() - 864e5),
      ]);
      const token = await newSession(db, user.id);
      return json({ token, user: { username: user.display } });
    }

    // Leaderboards are public to read.
    if (path === '/scores' && method === 'GET') {
      const board = url.searchParams.get('board') || '';
      if (!BOARDS[board]) return fail('Unknown board.');
      const day = BOARDS[board] === 'low' ? (url.searchParams.get('day') || '') : '-';
      if (day !== '-' && !DAY_RE.test(day)) return fail('Bad day.');
      const order = BOARDS[board] === 'high' ? 'DESC' : 'ASC';
      const { results } = await db.prepare(
        `SELECT u.display AS name, s.v, s.user_id FROM scores s JOIN users u ON u.id = s.user_id
         WHERE s.board = ? AND s.day = ? ORDER BY s.v ${order} LIMIT 25`).bind(board, day).all();
      const me = await currentUser(db, request);
      return json({ rows: results.map((r) => ({ name: r.name, v: r.v, me: !!me && r.user_id === me.id })) });
    }

    // Everything below needs a signed-in user.
    const me = await currentUser(db, request);
    if (!me) return fail('Please sign in again.', 401);

    if (path === '/me' && method === 'GET') return json({ user: { username: me.username } });

    if (path === '/logout' && method === 'POST') {
      await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(me.tokenHash).run();
      return json({ ok: true });
    }

    if (path === '/password' && method === 'POST') {
      const body = await readBody(request);
      const oldPw = String(body.old || ''), newPw = String(body.new || '');
      if (newPw.length < 6 || newPw.length > 128) return fail('New password needs at least 6 characters.');
      const user = await db.prepare('SELECT pass_hash, salt FROM users WHERE id = ?').bind(me.id).first();
      if (!safeEqual(await hashPassword(oldPw, user.salt), user.pass_hash)) return fail('Your current password is wrong.', 401);
      const salt = randomHex(16);
      await db.batch([
        db.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').bind(await hashPassword(newPw, salt), salt, me.id),
        db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(me.id, me.tokenHash),
      ]);
      return json({ ok: true });
    }

    if (path === '/save' && method === 'GET') {
      const row = await db.prepare('SELECT state, saved_at FROM saves WHERE user_id = ?').bind(me.id).first();
      return json(row ? { state: row.state, savedAt: row.saved_at } : { state: null });
    }
    if (path === '/save' && method === 'PUT') {
      const body = await readBody(request);
      const state = typeof body.state === 'string' ? body.state : '';
      if (!state || state.length > MAX_SAVE) return fail('Save is missing or too big.');
      try { JSON.parse(state); } catch { return fail('Save is not valid.'); }
      const savedAt = Number.isFinite(+body.savedAt) ? +body.savedAt : Date.now();
      await db.prepare(`INSERT INTO saves (user_id, state, saved_at, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, saved_at = excluded.saved_at, updated_at = excluded.updated_at`)
        .bind(me.id, state, savedAt, Date.now()).run();
      return json({ ok: true, savedAt });
    }

    if (path === '/score' && method === 'POST') {
      const body = await readBody(request);
      const board = String(body.board || '');
      if (!BOARDS[board]) return fail('Unknown board.');
      const v = +body.v;
      if (!Number.isFinite(v) || v <= 0 || v > 1e7) return fail('Bad score.');
      const day = BOARDS[board] === 'low' ? String(body.day || '') : '-';
      if (day !== '-' && !DAY_RE.test(day)) return fail('Bad day.');
      const better = BOARDS[board] === 'high' ? 'excluded.v > scores.v' : 'excluded.v < scores.v';
      await db.prepare(`INSERT INTO scores (board, day, user_id, v, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(board, day, user_id) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at WHERE ${better}`)
        .bind(board, day, me.id, v, Date.now()).run();
      return json({ ok: true });
    }

    return fail('Not found.', 404);
  } catch (e) {
    return fail('Server error — try again in a moment.', 500);
  }
}
