'use strict';
// A DOM small enough to run the shipped game.js headlessly, with a virtual clock so a
// full eight-floor run finishes in milliseconds instead of minutes of announcement timers.

// button と article だけを子として起こす。演出の並び順を検証するのに article が要る。
function parseButtons(html, make) {
    const out = [];
    const re = /<(button|article)([^>]*)>/g;
    let m;
    while ((m = re.exec(html))) {
        const el = make(m[1]);
        const attrs = m[2];
        for (const [, name, value] of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g))
            el.dataset[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
        if (/(^|\s)disabled(\s|$|=)/.test(attrs)) el.disabled = true;
        const cls = /class="([^"]*)"/.exec(attrs);
        if (cls) el.className = cls[1];
        out.push(el);
    }
    return out;
}

function makeEl(tag = 'div') {
    const el = {
        tagName: String(tag).toUpperCase(),
        children: [],
        dataset: {},
        style: { cssText: '', setProperty() {} },
        textContent: '',
        hidden: false,
        disabled: false,
        value: '',
        checked: false,
        onclick: null,
        _parent: null,
        offsetParent: {},
        _html: '',
        _classes: new Set(),
    };
    el.classList = {
        add: (...c) => c.forEach((x) => x && el._classes.add(x)),
        remove: (...c) => c.forEach((x) => el._classes.delete(x)),
        toggle: (c, force) => {
            const on = force === undefined ? !el._classes.has(c) : !!force;
            if (on) el._classes.add(c); else el._classes.delete(c);
            return on;
        },
        contains: (c) => el._classes.has(c),
    };
    // Detached stubs still answer .parentElement so the game can style a value's wrapper.
    Object.defineProperty(el, 'parentElement', {
        get: () => (el._parent || (el._parent = makeEl('div'))),
        set: (v) => { el._parent = v; },
    });
    Object.defineProperty(el, 'className', {
        get: () => [...el._classes].join(' '),
        set: (v) => { el._classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
    });
    Object.defineProperty(el, 'innerHTML', {
        configurable: true,
        get: () => el._html,
        set: (v) => {
            el._html = String(v);
            // Keep textContent in step the way a real node does, so a test can read either.
            el.textContent = el._html.replace(/<[^>]*>/g, '');
            el.children = parseButtons(el._html, makeEl);
            el.children.forEach((c) => (c.parentElement = el));
        },
    });
    Object.defineProperty(el, 'lastElementChild', { get: () => el.children[el.children.length - 1] || null });
    Object.defineProperty(el, 'firstElementChild', { get: () => el.children[0] || null });
    el._lookup = new Map();
    el.querySelector = (sel) => {
        const hit = el.querySelectorAll(sel)[0];
        if (hit) return hit;
        // Ornamental lookups (a toggle's span, a dialog's close button) get a detached stub
        // so the game can write to them without the test having to model real markup.
        if (!el._lookup.has(sel)) el._lookup.set(sel, makeEl('span'));
        return el._lookup.get(sel);
    };
    el.querySelectorAll = (sel) => el.children.filter((c) => sel.split(',').some((s) => s.trim().toLowerCase() === c.tagName.toLowerCase()));
    el.appendChild = (n) => { n.parentElement = el; el.children.push(n); return n; };
    el.append = (...n) => n.forEach((x) => el.appendChild(x));
    // 段の畳み方で置き場所を変える要素があるので、挿入も本物どおりに動かす。
    el.insertBefore = (n, ref) => {
        if (n.parentElement) n.parentElement.children = n.parentElement.children.filter((c) => c !== n);
        const at = ref ? el.children.indexOf(ref) : -1;
        if (at < 0) el.children.push(n); else el.children.splice(at, 0, n);
        n.parentElement = el;
        return n;
    };
    el.remove = () => { const p = el.parentElement; if (p) p.children = p.children.filter((c) => c !== el); };
    el.replaceWith = (n) => { const p = el.parentElement; if (!p) return; p.children[p.children.indexOf(el)] = n; n.parentElement = p; };
    el.insertAdjacentHTML = (pos, html) => { el._html = pos === 'afterbegin' ? html + el._html : el._html + html; };
    el.setAttribute = () => {};
    el.getAttribute = () => null;
    el.addEventListener = () => {};
    el.removeEventListener = () => {};
    el.closest = () => el;
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 20, height: 20 });
    el.focus = () => {};
    el.showModal = () => {};
    el.close = () => {};
    return el;
}

// 既定は「動きあり」。実際の利用者の設定に合わせ、演出の道筋まで通す。
function createContext({ random, reducedMotion = false } = {}) {
    const registry = new Map();
    const $ = (sel) => {
        if (!registry.has(sel)) registry.set(sel, makeEl('div'));
        return registry.get(sel);
    };
    const document = {
        body: makeEl('body'),
        querySelector: $,
        querySelectorAll: () => [],
        addEventListener: () => {},
        createElement: (tag) => {
            const el = makeEl(tag);
            if (String(tag).toLowerCase() === 'template') {
                Object.defineProperty(el, 'innerHTML', {
                    get: () => el._html,
                    set: (v) => { el._html = String(v); el.children = [makeEl('i')]; el.children[0].parentElement = el; },
                });
                el.content = { get firstElementChild() { return el.children[0] || null; } };
            }
            return el;
        },
    };

    // Virtual clock. Every timer the game schedules is replayed in order, instantly.
    let now = 0, seq = 0;
    const timers = new Map();
    const setTimeoutStub = (fn, ms) => { const id = ++seq; timers.set(id, { at: now + Math.max(0, ms || 0), fn }); return id; };
    const clearTimeoutStub = (id) => timers.delete(id);
    function step() {
        if (!timers.size) return false;
        let bestId = null, best = null;
        for (const [id, t] of timers) if (!best || t.at < best.at || (t.at === best.at && id < bestId)) { best = t; bestId = id; }
        timers.delete(bestId);
        now = Math.max(now, best.at);
        best.fn();
        return true;
    }

    const sandbox = {
        document,
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        matchMedia: () => ({ matches: reducedMotion, addEventListener: () => {} }),
        navigator: {},
        performance: { now: () => now },
        setTimeout: setTimeoutStub,
        clearTimeout: clearTimeoutStub,
        setInterval: () => 0,
        clearInterval: () => {},
        requestAnimationFrame: (fn) => setTimeoutStub(fn, 16),
        console,
        addEventListener: () => {},
        removeEventListener: () => {},
        Math: Object.create(Math),
    };
    if (random) sandbox.Math.random = random;
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    return { sandbox, $, step, clock: () => now, pending: () => timers.size };
}

// Mulberry32 — a seeded generator so a whole run is reproducible.
const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

module.exports = { createContext, makeEl, seeded };
