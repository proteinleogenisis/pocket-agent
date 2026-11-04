// Internet tools. Privacy rules (enforced here, not by the model):
//  - Only the user's query text (or the URL they gave) is ever sent. Never screen text, attached
//    files, notes, or chat history.
//  - No cookies or credentials, no referrer. Every result says which services were contacted.
//  - Everything can be switched off in Settings → Internet.

const enc = encodeURIComponent;
const READER = 'https://r.jina.ai/';

async function get(url, { json = true, timeout = 12000, headers = {} } = {}) {
  if (!navigator.onLine) throw new Error('This iPad is offline.');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', headers });
    if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
    return json ? await r.json() : await r.text();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${new URL(url).host} took too long to answer`);
    if (e instanceof TypeError) throw new Error(`Couldn't reach ${new URL(url).host} (blocked by this network, or offline)`);
    throw e;
  } finally { clearTimeout(t); }
}
const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return u; } };
const stripHtml = (h) => (h || '').replace(/<pre[\s\S]*?<\/pre>/gi, (m) => '\n```\n' + m.replace(/<[^>]+>/g, '') + '\n```\n')
  .replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').trim();

// ---------- Sources ----------
// General search uses official, free APIs that allow automated use (no scraping of search pages).
const CODE_Q = /\b(error|exception|how (do|to)|function|python|javascript|js|typescript|css|html|sql|swift|java|rust|go|c\+\+|react|node|npm|pip|regex|array|string|loop|class|async|api|compile|syntax|undefined|null)\b/i;
const TECH_Q = /\b(webgpu|ai|llm|gpu|apple|ipad|iphone|ios|android|linux|github|programming|software|startup|chip|model|browser|safari|chrome)\b/i;

export async function webSearch(query, { max = 6 } = {}) {
  const results = []; const used = new Set(); const errors = [];
  const add = (name, list) => { if (list.length) used.add(name); results.push(...list); };
  const jobs = [
    // Wikipedia: best article + its summary.
    get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(query)}&srlimit=3&format=json&origin=*`).then(async (j) => {
      const hits = j.query?.search || []; const list = [];
      for (const [i, s2] of hits.entries()) {
        let snippet = stripHtml(s2.snippet);
        if (i === 0) { try { const sm = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(s2.title.replace(/ /g, '_'))}`); if (sm.extract) snippet = sm.extract; } catch {} }
        list.push({ title: s2.title + ' — Wikipedia', url: `https://en.wikipedia.org/wiki/${enc(s2.title.replace(/ /g, '_'))}`, snippet });
      }
      add('Wikipedia', list);
    }),
    // DuckDuckGo Instant Answer API: quick facts and related topics.
    get(`https://api.duckduckgo.com/?q=${enc(query)}&format=json&no_html=1&skip_disambig=1&t=pocketagent`).then((d) => {
      const list = [];
      if (d.Answer) list.push({ title: 'DuckDuckGo answer', url: d.AbstractURL || `https://duckduckgo.com/?q=${enc(query)}`, snippet: String(d.Answer) });
      if (d.AbstractText) list.push({ title: (d.Heading || query) + ' — ' + (d.AbstractSource || 'DuckDuckGo'), url: d.AbstractURL, snippet: d.AbstractText });
      for (const r of (d.RelatedTopics || []).filter((x) => x.FirstURL && x.Text).slice(0, 2)) list.push({ title: r.Text.split(' - ')[0].slice(0, 80), url: r.FirstURL, snippet: r.Text });
      add('DuckDuckGo', list);
    }),
  ];
  if (TECH_Q.test(query) || CODE_Q.test(query)) jobs.push(get(`https://hn.algolia.com/api/v1/search?query=${enc(query)}&tags=story&hitsPerPage=3`).then((j) => {
    add('Hacker News', (j.hits || []).filter((h) => h.title).map((h) => ({ title: h.title + ' — Hacker News', url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, snippet: `${h.title} (${h.points} points, ${String(h.created_at).slice(0, 10)})` })));
  }));
  if (CODE_Q.test(query)) jobs.push(stackOverflow(query).then((r) => add('Stack Overflow', r.results.slice(0, 2))));
  for (const r of await Promise.allSettled(jobs)) if (r.status === 'rejected') errors.push(r.reason?.message || String(r.reason));
  const seen = new Set();
  const uniq = results.filter((r) => r.url && r.snippet && !seen.has(r.url) && seen.add(r.url));
  const rank = (r) => (/DuckDuckGo answer/.test(r.title) ? 0 : CODE_Q.test(query) && /stackoverflow/.test(r.url) ? 1 : /wikipedia/.test(r.url) ? 2 : 3);
  return { results: uniq.sort((x, y) => rank(x) - rank(y)).slice(0, max), used: [...used], errors };
}

// Quick fact lookup used to ground answers: best Wikipedia article summary, only if it looks relevant.
export async function wikiLookup(query) {
  const words = query.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !/^(what|which|where|when|does|about|explain|tell|describe|there|their|these|those|with|from|that|this|have|work|works)$/.test(w));
  if (!words.length) return null;
  const j = await get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(words.join(' '))}&srlimit=1&format=json&origin=*`, { timeout: 4000 });
  const hit = j.query?.search?.[0]; if (!hit) return null;
  const sm = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(hit.title.replace(/ /g, '_'))}`, { timeout: 4000 });
  const text = (sm.extract || '').trim(); if (!text) return null;
  const hay = (hit.title + ' ' + text).toLowerCase();
  if (words.filter((w) => hay.includes(w)).length < Math.min(2, words.length)) return null;   // not relevant enough
  return { title: hit.title, url: `https://en.wikipedia.org/wiki/${enc(hit.title.replace(/ /g, '_'))}`, text };
}

export async function readPage(url, { maxChars = 6000 } = {}) {
  const md = await get(READER + url, { json: false, timeout: 20000, headers: { Accept: 'text/plain' } });
  const title = (/^Title:\s*(.+)$/m.exec(md) || [])[1] || host(url);
  const body = (md.split(/^Markdown Content:\s*$/m)[1] || md)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')            // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')          // links → text
    .replace(/\n{3,}/g, '\n\n').trim();
  return { title, url, text: body.slice(0, maxChars), truncated: body.length > maxChars, used: ['r.jina.ai (page reader)'] };
}

export async function weather(place) {
  let lat, lon, name;
  if (place) {
    const g = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${enc(place)}&count=1&language=en&format=json`);
    const p = g.results?.[0]; if (!p) throw new Error(`I couldn't find a place called “${place}”.`);
    ({ latitude: lat, longitude: lon } = p); name = [p.name, p.admin1, p.country_code].filter(Boolean).join(', ');
  } else {
    const pos = await new Promise((res, rej) => navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(res, () => rej(new Error('Location access was declined. Try “weather in <city>”.')), { timeout: 10000, maximumAge: 600000 })
      : rej(new Error('Location isn\'t available. Try “weather in <city>”.')));
    lat = +pos.coords.latitude.toFixed(2); lon = +pos.coords.longitude.toFixed(2); name = 'your location';
  }
  const f = /^en-US/i.test(navigator.language);
  const w = await get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=auto${f ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : ''}`);
  const u = f ? '°F' : '°C', ws = f ? 'mph' : 'km/h', c = w.current, d = w.daily;
  const days = d.time.map((t, i) => `${i === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString(undefined, { weekday: 'long' })}: ${WMO[d.weather_code[i]] || '—'}, ${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}${u}, ${d.precipitation_probability_max[i] ?? 0}% chance of rain`);
  return { text: `**Weather for ${name}**\nNow: ${Math.round(c.temperature_2m)}${u} (feels like ${Math.round(c.apparent_temperature)}${u}), ${WMO[c.weather_code] || ''}, wind ${Math.round(c.wind_speed_10m)} ${ws}, humidity ${c.relative_humidity_2m}%\n${days.join('\n')}`, used: ['Open-Meteo'] };
}
const WMO = { 0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'rain showers', 81: 'rain showers', 82: 'violent rain showers', 85: 'snow showers', 86: 'heavy snow showers', 95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail' };

export async function currency(amount, from, to) {
  const j = await get(`https://api.frankfurter.dev/v1/latest?amount=${amount}&from=${from}&to=${to}`);
  const v = j.rates?.[to]; if (v == null) throw new Error(`No exchange rate for ${from} → ${to}.`);
  return { text: `${amount} ${from} = **${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${to}** (European Central Bank rate, ${j.date})`, used: ['Frankfurter (ECB rates)'] };
}

export async function define(word) {
  const j = await get(`https://en.wiktionary.org/api/rest_v1/page/definition/${enc(word.toLowerCase())}`);
  const en = j.en || Object.values(j)[0]; if (!en?.length) throw new Error(`No definition found for “${word}”.`);
  const lines = en.slice(0, 3).map((p) => `*${p.partOfSpeech}*: ${stripHtml(p.definitions?.[0]?.definition)}`);
  return { text: `**${word}**\n${lines.join('\n')}`, used: ['Wiktionary'] };
}

export async function stackOverflow(query) {
  const q = await get(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${enc(query)}&site=stackoverflow&answers=1&pagesize=3`);
  const items = q.items || []; if (!items.length) return { results: [], used: ['Stack Overflow'] };
  const a = await get(`https://api.stackexchange.com/2.3/questions/${items.map((i) => i.question_id).join(';')}/answers?order=desc&sort=votes&site=stackoverflow&filter=withbody&pagesize=6`);
  const best = {}; for (const ans of a.items || []) if (!best[ans.question_id]) best[ans.question_id] = ans;
  return {
    results: items.map((i) => ({ title: stripHtml(i.title), url: i.link, snippet: stripHtml(best[i.question_id]?.body || '').slice(0, 900) })),
    used: ['Stack Overflow'],
  };
}

export async function packageInfo(eco, name) {
  if (eco === 'pypi') {
    const j = await get(`https://pypi.org/pypi/${enc(name)}/json`);
    return { text: `**${j.info.name} ${j.info.version}** (PyPI)\n${j.info.summary || ''}\nInstall: \`pip install ${j.info.name}\``, used: ['PyPI'] };
  }
  const j = await get(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`);
  return { text: `**${j.name} ${j.version}** (npm)\n${j.description || ''}\nInstall: \`npm install ${j.name}\``, used: ['npm registry'] };
}

// ---------- Phrase parsing ----------
const CURRENCIES = 'usd|eur|gbp|jpy|cad|aud|chf|cny|inr|mxn|brl|krw|sek|nok|dkk|pln|nzd|sgd|hkd|zar|try|czk|huf|ils|php|thb|idr|myr|ron|bgn|isk';
const CUR_WORDS = { dollar: 'USD', dollars: 'USD', euro: 'EUR', euros: 'EUR', pound: 'GBP', pounds: 'GBP', yen: 'JPY', peso: 'MXN', pesos: 'MXN', rupee: 'INR', rupees: 'INR' };
const cur = (s) => CUR_WORDS[s.toLowerCase()] || s.toUpperCase();

// Returns { tool, value } for an internet request, or null.
export function parseNet(t) {
  let m;
  if ((m = /^\/web\s+(.+)$/i.exec(t))) return { tool: 'web_search', value: { query: m[1] } };
  if ((m = /^(?:search|look|check)\s+(?:on\s+)?(?:the\s+)?(?:web|internet|online)\s+(?:for\s+)?(.+)$/i.exec(t))
    || (m = /^(?:search|look\s+up|look|find|research)\s+(.+?)\s+(?:online|on\s+the\s+(?:web|internet))$/i.exec(t))
    || (m = /^(?:research|find out|look into)\s+(.+)$/i.exec(t))) return { tool: 'web_search', value: { query: m[1] } };
  if ((m = /^(?:summari[sz]e|read|open and summari[sz]e|tl;?dr)\s+(?:this\s+|the\s+)?(?:page\s+|article\s+|link\s+)?(https?:\/\/\S+)\s*$/i.exec(t))) return { tool: 'read_page', value: { url: m[1], question: '' } };
  if ((m = /(https?:\/\/\S+)/i.exec(t)) && /\b(summari[sz]e|say|says|about|explain|what|read|tl;?dr)\b/i.test(t)) return { tool: 'read_page', value: { url: m[1].replace(/[).,]+$/, ''), question: t.replace(m[1], 'this page') } };
  if ((m = /^(?:what(?:'s| is) the\s+)?(?:weather|forecast|temperature)(?:\s+(?:like|forecast))?(?:\s+(?:in|for|at)\s+(.+?))?(?:\s+(?:today|now|this week|tomorrow))?$/i.exec(t))
    || (m = /^(?:is it (?:going to )?(?:rain|snow)(?:ing)?|will it (?:rain|snow))(?:\s+(?:in|at)\s+(.+?))?(?:\s+(?:today|tomorrow))?$/i.exec(t))) return { tool: 'weather', value: { place: (m[1] || '').trim() } };
  if ((m = new RegExp(`^(?:convert\\s+)?([\\d.,]+)\\s*(${CURRENCIES}|dollars?|euros?|pounds?|yen|pesos?|rupees?)\\s+(?:to|in|into)\\s+(${CURRENCIES}|dollars?|euros?|pounds?|yen|pesos?|rupees?)$`, 'i').exec(t))) {
    return { tool: 'currency', value: { amount: parseFloat(m[1].replace(/,/g, '')), from: cur(m[2]), to: cur(m[3]) } };
  }
  if ((m = /^(?:define|definition of|what does the word|meaning of)\s+["“]?([a-z][a-z'-]{1,40})["”]?(?:\s+mean)?$/i.exec(t))) return { tool: 'define', value: { word: m[1] } };
  if ((m = /^(?:search\s+)?(?:stack\s*overflow|so)\s+(?:for\s+)?(.+)$/i.exec(t)) || (m = /^(?:search|look up|find)\s+(.+?)\s+on\s+stack\s*overflow$/i.exec(t))) return { tool: 'stack_overflow', value: { query: m[1] } };
  if ((m = /^(?:what(?:'s| is) the\s+)?latest\s+version\s+of\s+(?:the\s+)?(?:(npm|pypi|python|pip|node)\s+(?:package\s+)?)?([@\w./-]+)(?:\s+(?:on\s+)?(npm|pypi))?$/i.exec(t))) {
    const eco = /pypi|python|pip/i.test((m[1] || '') + (m[3] || '')) ? 'pypi' : 'npm';
    return { tool: 'package_info', value: { eco, name: m[2] } };
  }
  // Questions about the present go online automatically.
  if (/^(who|what|when|where|which|how|is|are|did|does|will)\b/i.test(t) && /\b(latest|newest|current(ly)?|today|tonight|yesterday|this (week|month|year)|news|recent(ly)?|right now|price of|stock price|score|who won|release date|just released|announced)\b/i.test(t)) {
    return { tool: 'web_search', value: { query: t }, auto: true };
  }
  return null;
}
