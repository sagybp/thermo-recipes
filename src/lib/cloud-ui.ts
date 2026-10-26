// The account and rating screens. It only touches the page through the small `ctx` it is given.
import type { Session } from '@supabase/supabase-js';
import * as cloud from './cloud';
import { EMAIL_LOGIN } from './config';
import { mergeMarks } from './marks';
import type { Kind, Marks } from './marks';

type Ctx = {
  marks: Marks;
  save: () => void;
  refreshMarkUi: () => void;
  items: HTMLLIElement[];
  base: string;
  toast: (msg: string) => void;
};
type Pending = { id: string; name: string; kind?: 'rate' | 'tips' | 'suggest' };

const PENDING_KEY = 'tmx_pending_rate';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1L3.2 9.6l6.1-.8z" /></svg>';

function h(tag: string, attrs: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  e.append(...kids);
  return e;
}

export function initCloud(ctx: Ctx) {
  const $ = (id: string) => document.getElementById(id)!;
  const sheet = $('sheet');
  const backdrop = $('sheetBackdrop');
  const body = $('sheetBody');
  const titleEl = $('sheetTitle');
  const acct = $('acct');

  let session: Session | null = null;
  let stats: Record<string, cloud.Stat> = {};
  let mine: Record<string, number> = {};
  let tips: Record<string, string[]> = {};
  let myTips: Record<string, string> = {};
  let booted = false;
  let syncedFor = '';
  let pending: Pending | null = null;
  let state: 'closed' | 'login' | 'code' | 'rate' | 'account' | 'tips' | 'suggest' = 'closed';
  let opener: HTMLElement | null = null;

  // ---------- the stars inside the list ----------
  function paintRow(li: HTMLLIElement) {
    const id = li.dataset.id!;
    const btn = li.querySelector<HTMLButtonElement>('.act[data-k="rate"]');
    if (!btn) return;
    const s = stats[id];
    const avg = btn.querySelector('.avg')!;
    avg.textContent = s && s.votes ? s.avg.toFixed(1) : '';
    btn.setAttribute('aria-pressed', String(!!mine[id]));
    btn.title = s && s.votes ? `ממוצע ${s.avg.toFixed(1)} מתוך ${s.votes} דירוגים` : 'דירוג';
    btn.setAttribute('aria-label', btn.title + (mine[id] ? `, הדירוג שלך ${mine[id]}` : ''));
  }
  function paintTips(li: HTMLLIElement) {
    const btn = li.querySelector<HTMLButtonElement>('.act[data-k="tips"]');
    if (!btn) return;
    const n = tips[li.dataset.id!]?.length ?? 0;
    btn.querySelector('.n')!.textContent = n ? String(n) : '';
    btn.setAttribute('aria-pressed', String(!!myTips[li.dataset.id!]));
    btn.title = n ? `${n} טיפים ושיפורים` : 'טיפים ושיפורים';
    btn.setAttribute('aria-label', btn.title);
  }
  const paintAll = () => ctx.items.forEach((li) => { paintRow(li); paintTips(li); });

  function updateAcct() {
    acct.textContent = session ? 'החשבון שלי' : 'התחברות';
  }

  // ---------- the sheet ----------
  function open(next: typeof state, title: string) {
    if (state === 'closed') opener = document.activeElement as HTMLElement | null;
    state = next;
    titleEl.textContent = title;
    sheet.hidden = false;
    backdrop.hidden = false;
    body.replaceChildren();
  }
  function close() {
    state = 'closed';
    sheet.hidden = true;
    backdrop.hidden = true;
    opener?.focus?.();
  }
  $('sheetClose').addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state !== 'closed') close();
  });

  const msg = () => h('p', { class: 'msg', role: 'status' });

  function legalNote() {
    return h(
      'p',
      { class: 'fine' },
      'בהתחברות אתם מסכימים ל',
      h('a', { href: `${ctx.base}/privacy` }, 'מדיניות הפרטיות'),
      ' ול',
      h('a', { href: `${ctx.base}/terms` }, 'תנאי השימוש'),
      '.',
    );
  }

  async function ensureBooted() {
    if (booted) return;
    booted = true;
    await cloud.onAuthChange(handleSession);
  }

  // ----- login -----
  async function showLogin(p: Pending | null) {
    pending = p;
    open('login', 'התחברות');
    await ensureBooted();
    body.append(
      h('p', {},
        p?.kind === 'tips' ? `כדי לכתוב טיפ על "${p.name}" צריך להתחבר.`
        : p?.kind === 'suggest' ? 'כדי לבקש להוסיף מתכון צריך להתחבר.'
        : p ? `כדי לדרג את "${p.name}" צריך להתחבר.`
        : 'מתחברים כדי לדרג מתכונים, לכתוב טיפים ולשמור מועדפים בכל המכשירים.'),
    );
    const google = h('button', { type: 'button', class: 'btn primary' }, 'המשך עם גוגל') as HTMLButtonElement;
    const status = msg();
    google.addEventListener('click', async () => {
      google.disabled = true;
      if (p) {
        try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* ignore */ }
      }
      const err = await cloud.signInWithGoogle(`${location.origin}${ctx.base}/`);
      if (err) {
        google.disabled = false;
        status.textContent = 'לא הצלחנו להתחיל את הכניסה עם גוגל. נסו שוב.';
      }
    });

    const email = h('input', { type: 'email', class: 'field', autocomplete: 'email', inputmode: 'email', dir: 'ltr', placeholder: 'your@email.com', required: '', 'aria-label': 'כתובת מייל' }) as HTMLInputElement;
    const send = h('button', { type: 'submit', class: 'btn' }, 'שלחו לי קוד במייל') as HTMLButtonElement;
    const form = h('form', { class: 'row' }, email, send);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const addr = email.value.trim().toLowerCase();
      if (!addr) return;
      send.disabled = true;
      status.textContent = 'שולחים…';
      const err = await cloud.sendEmailCode(addr);
      send.disabled = false;
      if (!err) showCode(addr);
      else status.textContent = err === 'rate' ? 'נשלחו כמה קודים ברצף. נסו שוב בעוד כמה דקות.' : 'לא הצלחנו לשלוח מייל. בדקו את הכתובת ונסו שוב.';
    });

    if (EMAIL_LOGIN) body.append(google, h('p', { class: 'or' }, 'או'), form, status, legalNote());
    else body.append(google, status, legalNote());
    google.focus();
  }

  // ----- code from the email -----
  async function showCode(addr: string) {
    open('code', 'הזינו את הקוד');
    body.append(h('p', {}, 'שלחנו קוד בן 6 ספרות אל '), h('p', { class: 'addr', dir: 'ltr' }, addr));
    const code = h('input', { type: 'text', class: 'field code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', pattern: '[0-9]*', dir: 'ltr', 'aria-label': 'קוד בן 6 ספרות', placeholder: '••••••' }) as HTMLInputElement;
    const ok = h('button', { type: 'submit', class: 'btn primary' }, 'אישור') as HTMLButtonElement;
    const status = msg();
    const form = h('form', { class: 'row' }, code, ok);
    const verify = async () => {
      const t = code.value.replace(/\D/g, '');
      if (t.length < 6) return;
      ok.disabled = true;
      status.textContent = 'בודקים…';
      const err = await cloud.verifyEmailCode(addr, t);
      if (err) {
        ok.disabled = false;
        status.textContent = 'הקוד לא נכון או שפג תוקפו.';
        code.select();
      }
      // on success handleSession closes the sheet and continues
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); void verify(); });
    code.addEventListener('input', () => { if (code.value.replace(/\D/g, '').length === 6) void verify(); });
    const again = h('button', { type: 'button', class: 'linkbtn' }, 'שליחה מחדש');
    again.addEventListener('click', async () => {
      status.textContent = 'שולחים קוד חדש…';
      const err = await cloud.sendEmailCode(addr);
      status.textContent = err ? 'לא הצלחנו לשלוח. נסו שוב בעוד כמה דקות.' : 'נשלח קוד חדש.';
    });
    const change = h('button', { type: 'button', class: 'linkbtn' }, 'שינוי כתובת');
    change.addEventListener('click', () => void showLogin(pending));
    body.append(form, status, h('p', { class: 'links' }, again, ' · ', change));
    code.focus();
  }

  // ----- rating -----
  function showRate(id: string, name: string) {
    open('rate', name);
    const s = stats[id];
    body.append(h('p', {}, 'איך היה?'));
    const row = h('div', { class: 'stars', role: 'group', 'aria-label': 'דירוג מ-1 עד 5' });
    for (let n = 1; n <= 5; n++) {
      const b = h('button', { type: 'button', class: 'star', 'aria-label': `${n} מתוך 5`, 'aria-pressed': String((mine[id] ?? 0) >= n) });
      b.innerHTML = STAR;
      b.addEventListener('click', () => void rate(id, name, n));
      row.append(b);
    }
    // the two ends of the scale are named, so it is clear which way is better
    body.append(h('div', { class: 'scale' }, h('div', { class: 'scale-ends', 'aria-hidden': 'true' }, h('span', {}, 'הכי נמוך'), h('span', {}, 'הכי גבוה')), row));
    body.append(h('p', { class: 'fine' }, s && s.votes ? `ממוצע ${s.avg.toFixed(1)} מתוך ${s.votes} דירוגים` : 'עוד אין דירוגים. אפשר להיות הראשונים.'));
    if (mine[id]) {
      const rm = h('button', { type: 'button', class: 'linkbtn' }, 'הסרת הדירוג שלי');
      rm.addEventListener('click', async () => {
        const prev = mine[id];
        delete mine[id];
        paintAll();
        if (!(await cloud.removeRating(id))) { mine[id] = prev; paintAll(); ctx.toast('לא הצלחנו להסיר. נסו שוב.'); return; }
        await refreshStats();
        showRate(id, name);
      });
      body.append(h('p', { class: 'links' }, rm));
    }
    (row.firstElementChild as HTMLElement).focus();
  }

  async function rate(id: string, name: string, score: number) {
    if (!session) return;
    const prev = mine[id];
    mine[id] = score;
    paintAll();
    const saved = await cloud.saveRating(session.user.id, id, score);
    if (!saved) {
      if (prev === undefined) delete mine[id]; else mine[id] = prev;
      paintAll();
      ctx.toast('לא הצלחנו לשמור את הדירוג. נסו שוב.');
      return;
    }
    await refreshStats();
    ctx.toast('תודה על הדירוג');
    close();
  }

  async function refreshStats() {
    stats = await cloud.fetchStats();
    paintAll();
  }

  // ----- tips: improvements written by members, shown to everyone without the author -----
  function showTips(id: string, name: string) {
    open('tips', name);
    const list = tips[id] ?? [];
    body.append(h('p', { class: 'fine' }, 'שיפורים והערות של חברי הקבוצה למתכון הזה. בלי שמות.'));
    if (list.length) {
      const ul = h('ul', { class: 'tips' });
      for (const t of list) ul.append(h('li', {}, t));
      body.append(ul);
    } else {
      body.append(h('p', {}, 'עוד אין טיפים. אפשר להיות הראשונים.'));
    }
    if (!session) {
      const go = h('button', { type: 'button', class: 'btn primary' }, 'התחברות כדי לכתוב טיפ');
      go.addEventListener('click', () => void showLogin({ id, name, kind: 'tips' }));
      body.append(go);
      return;
    }
    const mineText = myTips[id] ?? '';
    const area = h('textarea', { class: 'field', rows: '3', maxlength: '280', 'aria-label': 'הטיפ שלכם', placeholder: 'מה שיפרתם או שיניתם? (בלי קישורים)' }) as HTMLTextAreaElement;
    area.value = mineText;
    const left = h('p', { class: 'fine counter' });
    const status = msg();
    const send = h('button', { type: 'submit', class: 'btn primary' }, mineText ? 'עדכון הטיפ שלי' : 'פרסום') as HTMLButtonElement;
    const form = h('form', { class: 'row' }, area, left, send);
    const upd = () => { left.textContent = `${area.value.length}/280`; };
    area.addEventListener('input', upd);
    upd();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = area.value.trim();
      if (text.length < 3) { status.textContent = 'כתבו לפחות כמה מילים.'; return; }
      send.disabled = true;
      status.textContent = 'שומרים…';
      const res = await cloud.saveTip(session!.user.id, id, text, !!mineText);
      if (res !== 'ok') {
        send.disabled = false;
        status.textContent = res === 'links' ? 'אי אפשר לכלול קישורים או כתובות אתר בטיפ.' : 'לא הצלחנו לשמור. נסו שוב.';
        return;
      }
      await refreshTips();
      ctx.toast('הטיפ פורסם');
      showTips(id, name);
    });
    body.append(form, status);
    if (mineText) {
      const rm = h('button', { type: 'button', class: 'linkbtn' }, 'מחיקת הטיפ שלי');
      rm.addEventListener('click', async () => {
        if (!(await cloud.removeTip(id))) { status.textContent = 'לא הצלחנו למחוק. נסו שוב.'; return; }
        await refreshTips();
        showTips(id, name);
      });
      body.append(h('p', { class: 'links' }, rm));
    }
  }

  async function refreshTips() {
    tips = await cloud.fetchTips();
    if (session) myTips = await cloud.fetchMyTips();
    paintAll();
  }

  // ----- asking for a recipe to be added -----
  function showSuggest() {
    open('suggest', 'מתכון חסר?');
    body.append(h('p', {}, 'הדביקו כאן קישור למתכון ב-Cookidoo ואבדוק אם להוסיף אותו לאוסף.'));
    const url = h('input', { type: 'url', class: 'field', dir: 'ltr', inputmode: 'url', placeholder: 'https://cookidoo.international/…', required: '', 'aria-label': 'קישור למתכון' }) as HTMLInputElement;
    const note = h('input', { type: 'text', class: 'field', maxlength: '200', placeholder: 'שם או הערה (לא חובה)', 'aria-label': 'שם או הערה' }) as HTMLInputElement;
    const send = h('button', { type: 'submit', class: 'btn primary' }, 'שליחה') as HTMLButtonElement;
    const status = msg();
    const form = h('form', { class: 'row' }, url, note, send);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const link = url.value.trim();
      const rid = /\/(r\d+)(?:[/?#]|$)/i.exec(link)?.[1].toLowerCase();
      if (!/^https:\/\/cookidoo\.[a-z.]+\//i.test(link) || !rid) { status.textContent = 'זה לא נראה כמו קישור למתכון ב-Cookidoo.'; return; }
      const have = ctx.items.find((li) => li.dataset.id === rid);
      if (have) { status.textContent = `המתכון כבר באוסף: ${have.dataset.name}`; return; }
      send.disabled = true;
      status.textContent = 'שולחים…';
      const res = await cloud.sendSuggestion(session!.user.id, link, note.value.trim());
      if (res === 'ok') { close(); ctx.toast('תודה! הבקשה נשלחה'); return; }
      send.disabled = false;
      status.textContent = res === 'limit' ? 'שלחתם כבר כמה בקשות היום. נסו מחר.' : res === 'url' ? 'זה לא נראה כמו קישור למתכון ב-Cookidoo.' : 'לא הצלחנו לשלוח. נסו שוב.';
    });
    body.append(form, status);
    url.focus();
  }

  // ----- account -----
  function showAccount() {
    open('account', 'החשבון שלי');
    body.append(h('p', {}, 'מחוברים כ'), h('p', { class: 'addr', dir: 'ltr' }, session?.user.email ?? ''));
    body.append(h('p', { class: 'fine' }, 'המועדפים וסימוני "הכנתי" שלכם נשמרים בחשבון ומופיעים בכל מכשיר שתתחברו בו.'));
    const out = h('button', { type: 'button', class: 'btn' }, 'יציאה');
    out.addEventListener('click', async () => {
      await cloud.signOut();
      // this device stops holding this person's marks; they stay safe in the account
      ctx.marks.fav = {};
      ctx.marks.made = {};
      ctx.save();
      ctx.refreshMarkUi();
      session = null;
      mine = {};
      myTips = {};
      syncedFor = '';
      updateAcct();
      paintAll();
      close();
      ctx.toast('יצאתם מהחשבון');
    });
    body.append(
      out,
      h('p', { class: 'fine' }, 'למחיקת החשבון וכל הנתונים שלו: ', h('a', { href: 'mailto:sagybp@gmail.com?subject=מחיקת חשבון באתר המתכונים' }, 'שלחו לנו מייל'), '. ', h('a', { href: `${ctx.base}/privacy` }, 'מדיניות הפרטיות')),
    );
    out.focus();
  }

  // ---------- session handling ----------
  async function syncMarks(userId: string) {
    const server = await cloud.pullMarks();
    const merged = mergeMarks(ctx.marks, server);
    ctx.marks.fav = merged.fav;
    ctx.marks.made = merged.made;
    ctx.save();
    ctx.refreshMarkUi();
    const rows: cloud.MarkRow[] = [];
    for (const kind of ['fav', 'made'] as Kind[]) {
      for (const [id, ts] of Object.entries(merged[kind])) {
        if (server[kind][id] !== ts) rows.push({ kind, recipe_id: id, ts });
      }
    }
    await cloud.pushMarks(userId, rows);
  }

  async function handleSession(s: Session | null) {
    session = s;
    updateAcct();
    if (!s) { mine = {}; myTips = {}; paintAll(); return; }
    if (state === 'login' || state === 'code') close();
    mine = await cloud.fetchMyRatings();
    myTips = await cloud.fetchMyTips();
    paintAll();
    if (syncedFor !== s.user.id) {
      syncedFor = s.user.id;
      await syncMarks(s.user.id);
    }
    let p = pending;
    if (!p) {
      try { p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); sessionStorage.removeItem(PENDING_KEY); } catch { p = null; }
    }
    pending = null;
    if (p?.kind === 'suggest') showSuggest();
    else if (p?.kind === 'tips') showTips(p.id, p.name);
    else if (p) showRate(p.id, p.name);
  }

  // ---------- entry points ----------
  acct.addEventListener('click', () => (session ? showAccount() : void showLogin(null)));

  void cloud.fetchStats().then((s) => { stats = s; paintAll(); });
  void cloud.fetchTips().then((t) => { tips = t; paintAll(); });
  if (cloud.hasStoredSession()) void ensureBooted();

  return {
    /** the star on a list row was pressed */
    openRate(li: HTMLLIElement) {
      const p = { id: li.dataset.id!, name: li.dataset.name! };
      if (session) showRate(p.id, p.name);
      else void showLogin(p);
    },
    /** the speech bubble on a list row was pressed */
    openTips(li: HTMLLIElement) {
      showTips(li.dataset.id!, li.dataset.name!);
    },
    /** "missing a recipe?" in the footer */
    openSuggest() {
      if (session) showSuggest();
      else void showLogin({ id: '', name: '', kind: 'suggest' });
    },
    /** a favorite / made-it mark changed on this device */
    pushMark(kind: Kind, id: string) {
      if (!session) return;
      void cloud.pushMarks(session.user.id, [{ kind, recipe_id: id, ts: ctx.marks[kind][id] }]);
    },
  };
}
