// Natural-language opening of apps and websites: "can you open google", "pull up youtube",
// "search youtube for lofi", "cats on youtube", "open some-site-I-don't-know".
// Deterministic (no model), so it works the same every time on a tiny on-device model.

const enc = encodeURIComponent;
const safari = (url) => 'x-safari-' + url;   // opens in the Safari app, even from the Home Screen app

// Built-in iPad apps (URL schemes handled by iPadOS).
export const APP_SCHEMES = {
  safari: 'x-safari-https://www.google.com', shortcuts: 'shortcuts://', music: 'music://', 'apple music': 'music://', maps: 'maps://',
  'apple maps': 'maps://', mail: 'message://', messages: 'sms:', facetime: 'facetime://', calendar: 'calshow://', notes: 'mobilenotes://',
  reminders: 'x-apple-reminderkit://', photos: 'photos-redirect://', files: 'shareddocuments://', podcasts: 'podcasts://',
  books: 'ibooks://', 'app store': 'itms-apps://', tv: 'videos://', 'apple tv': 'videos://', freeform: 'freeform://', news: 'applenews://',
  settings: 'App-prefs:', camera: 'camera://',
};

// Popular websites by name.
export const SITES = {
  google: 'https://www.google.com', youtube: 'https://www.youtube.com', gmail: 'https://mail.google.com',
  'google drive': 'https://drive.google.com', drive: 'https://drive.google.com', 'google docs': 'https://docs.google.com',
  docs: 'https://docs.google.com', 'google sheets': 'https://sheets.google.com', 'google slides': 'https://slides.google.com',
  'google maps': 'https://maps.google.com', 'google translate': 'https://translate.google.com', translate: 'https://translate.google.com',
  'google calendar': 'https://calendar.google.com', 'google classroom': 'https://classroom.google.com', classroom: 'https://classroom.google.com',
  'google images': 'https://images.google.com', 'google news': 'https://news.google.com',
  wikipedia: 'https://en.wikipedia.org', reddit: 'https://www.reddit.com', github: 'https://github.com',
  'stack overflow': 'https://stackoverflow.com', stackoverflow: 'https://stackoverflow.com', chatgpt: 'https://chatgpt.com',
  claude: 'https://claude.ai', twitter: 'https://x.com', x: 'https://x.com', instagram: 'https://www.instagram.com',
  facebook: 'https://www.facebook.com', tiktok: 'https://www.tiktok.com', linkedin: 'https://www.linkedin.com',
  amazon: 'https://www.amazon.com', netflix: 'https://www.netflix.com', spotify: 'https://open.spotify.com',
  twitch: 'https://www.twitch.tv', discord: 'https://discord.com/app', pinterest: 'https://www.pinterest.com',
  ebay: 'https://www.ebay.com', apple: 'https://www.apple.com', icloud: 'https://www.icloud.com', outlook: 'https://outlook.live.com',
  yahoo: 'https://www.yahoo.com', bing: 'https://www.bing.com', duckduckgo: 'https://duckduckgo.com', weather: 'https://weather.com',
  'khan academy': 'https://www.khanacademy.org', quizlet: 'https://quizlet.com', duolingo: 'https://www.duolingo.com',
  w3schools: 'https://www.w3schools.com', mdn: 'https://developer.mozilla.org', replit: 'https://replit.com', codepen: 'https://codepen.io',
  leetcode: 'https://leetcode.com', 'chess.com': 'https://www.chess.com', chess: 'https://www.chess.com', roblox: 'https://www.roblox.com',
  espn: 'https://www.espn.com', cnn: 'https://www.cnn.com', bbc: 'https://www.bbc.com', 'new york times': 'https://www.nytimes.com',
  imdb: 'https://www.imdb.com', 'wolfram alpha': 'https://www.wolframalpha.com', wolframalpha: 'https://www.wolframalpha.com',
  desmos: 'https://www.desmos.com/calculator', notion: 'https://www.notion.so', figma: 'https://www.figma.com', zoom: 'https://zoom.us',
  whatsapp: 'https://web.whatsapp.com', canva: 'https://www.canva.com', 'hugging face': 'https://huggingface.co', huggingface: 'https://huggingface.co',
};

// Searching inside a site.
export const SEARCH = {
  google: (q) => `https://www.google.com/search?q=${enc(q)}`,
  web: (q) => `https://www.google.com/search?q=${enc(q)}`,
  youtube: (q) => `https://www.youtube.com/results?search_query=${enc(q)}`,
  wikipedia: (q) => `https://en.wikipedia.org/w/index.php?search=${enc(q)}`,
  amazon: (q) => `https://www.amazon.com/s?k=${enc(q)}`,
  reddit: (q) => `https://www.reddit.com/search/?q=${enc(q)}`,
  github: (q) => `https://github.com/search?q=${enc(q)}`,
  'stack overflow': (q) => `https://stackoverflow.com/search?q=${enc(q)}`,
  images: (q) => `https://www.google.com/search?tbm=isch&q=${enc(q)}`,
  'google images': (q) => `https://www.google.com/search?tbm=isch&q=${enc(q)}`,
  news: (q) => `https://www.google.com/search?tbm=nws&q=${enc(q)}`,
  twitter: (q) => `https://x.com/search?q=${enc(q)}`, x: (q) => `https://x.com/search?q=${enc(q)}`,
  spotify: (q) => `https://open.spotify.com/search/${enc(q)}`,
  ebay: (q) => `https://www.ebay.com/sch/i.html?_nkw=${enc(q)}`,
  mdn: (q) => `https://developer.mozilla.org/en-US/search?q=${enc(q)}`,
  imdb: (q) => `https://www.imdb.com/find/?q=${enc(q)}`,
  'wolfram alpha': (q) => `https://www.wolframalpha.com/input?i=${enc(q)}`,
  maps: (q) => `maps://?q=${enc(q)}`, 'apple maps': (q) => `maps://?q=${enc(q)}`, 'google maps': (q) => `https://www.google.com/maps/search/${enc(q)}`,
};
const SITE_ALT = Object.keys(SEARCH).filter((k) => k.length > 1).sort((a, b) => b.length - a.length).map((k) => k.replace(/ /g, '\\s+')).join('|');
const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// Strip politeness and filler so "hey can you please open google for me?" → "open google".
export function normalize(text) {
  let t = text.trim();
  for (let i = 0; i < 4; i++) {
    const before = t;
    t = t.replace(/^(hey|hi|hello|ok(ay)?|yo|so|alright|um+)[,!.\s]+/i, '')
      .replace(/^(can|could|would|will) you\s+(please\s+)?/i, '')
      .replace(/^(please|pls|plz|kindly)\s+/i, '')
      .replace(/^(i\s+(want|need|wanna|would like|'d like)\s+(you\s+)?to|i\s+want|let'?s|go ahead and|just|quickly)\s+/i, '')
      .replace(/\s+(for me|please|pls|now|right now|real quick|thanks|thank you)\s*$/i, '')
      .replace(/[?.!]+\s*$/, '').trim();
    if (t === before) break;
  }
  return t;
}

// Resolve an app / site name / domain to { name, url }.
export function resolveOpenTarget(raw) {
  const t = raw.trim().toLowerCase().replace(/^(the|my)\s+/, '').replace(/\s+(app|application|website|web ?site|site|page|home ?page)$/, '').replace(/[.!?]+$/, '').trim();
  if (APP_SCHEMES[t]) return { name: title(t), url: APP_SCHEMES[t] };
  if (SITES[t]) return { name: title(t), url: safari(SITES[t]) };
  const m = /^(https?:\/\/)?([a-z0-9-]+(\.[a-z0-9-]+)+)(\/\S*)?$/i.exec(raw.trim());
  if (m) { const url = (m[1] || 'https://') + m[2] + (m[4] || ''); return { name: url, url: safari(url) }; }
  return null;
}

const OPEN_VERBS = 'open(?:\\s+up)?|launch|start|go\\s+to|goto|visit|pull\\s+up|bring\\s+up|load|switch\\s+to|get\\s+me\\s+to|head\\s+to|show\\s+me|take\\s+me\\s+to|navigate\\s+to';

// Returns { tool: 'open_app', value: { name, url } } or null.
export function parseWeb(text) {
  const t = normalize(text);
  const open = (name, url) => ({ tool: 'open_app', value: { name, url } });
  let m;

  // Searching a specific site.
  if ((m = new RegExp(`^(?:search|look\\s+up|find|look\\s+for|check)\\s+(?:on\\s+|in\\s+)?(${SITE_ALT})\\s+(?:for\\s+)?(.+)$`, 'i').exec(t))) return siteSearch(m[1], m[2]);
  if ((m = new RegExp(`^(?:search(?:\\s+for)?|look\\s+up|find|look\\s+for|play|watch|show\\s+me|pull\\s+up)\\s+(.+?)\\s+(?:on|in|at|using)\\s+(${SITE_ALT})$`, 'i').exec(t))) return siteSearch(m[2], m[1]);
  if ((m = new RegExp(`^(${SITE_ALT})\\s+(?:search\\s+)?(?:for\\s+)?(.+)$`, 'i').exec(t)) && !resolveOpenTarget(t)) return siteSearch(m[1], m[2]);
  if ((m = new RegExp(`^(.+?)\\s+on\\s+(youtube|wikipedia|amazon|reddit|github|spotify|ebay|imdb)$`, 'i').exec(t))) return siteSearch(m[2], m[1]);
  // Generic web search.
  if ((m = /^(?:search|google|look\s+up|search\s+up|search\s+the\s+(?:web|internet)|search\s+online|web\s+search)\s+(?:the\s+(?:web|internet)\s+|online\s+)?(?:for\s+)?(.+)$/i.exec(t)) && !/\b(notes?|files?)\b/i.test(t)) {
    return open(`Google: ${m[1]}`, safari(SEARCH.google(m[1])));
  }
  // Opening something.
  if ((m = new RegExp(`^(${OPEN_VERBS})\\s+(.+)$`, 'i').exec(t))) {
    const target = resolveOpenTarget(m[2]);
    if (target) return open(target.name, target.url);
    const ambiguous = /^(show|take|navigate)/i.test(m[1]);   // "take me to the library" is directions, not a website
    const words = m[2].trim().split(/\s+/).length;
    if (!ambiguous && words <= 5 && !/\b(notes?|files?|settings|it|that|this)\b/i.test(m[2])) {
      // Unknown name: open the best-matching site ("I'm feeling lucky").
      return open(`best match for “${m[2]}”`, safari(`https://duckduckgo.com/?q=${enc('!ducky ' + m[2])}`));
    }
  }
  // Just a site or app name on its own: "youtube", "google".
  const solo = resolveOpenTarget(t);
  if (solo && !/\./.test(t) && t.split(/\s+/).length <= 3) return open(solo.name, solo.url);
  return null;
}

function siteSearch(site, q) {
  const key = site.toLowerCase().replace(/\s+/g, ' ');
  const url = SEARCH[key](q.trim());
  return { tool: 'open_app', value: { name: `${title(key)}: ${q.trim()}`, url: url.startsWith('https://') ? safari(url) : url } };
}

// Only these kinds of URLs may be opened.
export function allowedOpenURL(url) {
  return /^x-safari-https:\/\//.test(url) || /^maps:\/\//.test(url) || Object.values(APP_SCHEMES).includes(url);
}
