// Device control through Apple Shortcuts (the only way iPadOS lets an app change settings or act
// in other apps), plus deep links that open other apps straight to content.
// The "PA …" Shortcuts are built by tools/make_shortcuts.py and installed once from Settings.

const enc = encodeURIComponent;

export const SHORTCUT_NAMES = ["PA Brightness", "PA Volume", "PA Play Pause", "PA Next Track", "PA Timer", "PA Reminder", "PA Event", "PA Speak", "PA Battery", "PA WiFi On", "PA WiFi Off", "PA Bluetooth On", "PA Bluetooth Off"];

export function runShortcutURL(name, text) {
  return `shortcuts://run-shortcut?name=${enc(name)}${text != null && text !== '' ? `&input=text&text=${enc(String(text))}` : ''}`;
}

// ---------- Natural dates → absolute text Shortcuts parses reliably ----------
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DATE_RE = new RegExp([
  '\\b(?:today|tonight|tomorrow(?:\\s+(?:morning|afternoon|evening|night))?|this\\s+(?:morning|afternoon|evening))\\b',
  `\\b(?:on\\s+|next\\s+|this\\s+)?(?:${DAYS.join('|')})\\b`,
  `\\b(?:on\\s+)?(?:${MONTHS.join('|')}|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`,
  '\\b(?:at\\s+)?(?:noon|midnight|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)|\\d{1,2}:\\d{2})\\b',
  '\\bin\\s+\\d+\\s+(?:minutes?|mins?|hours?|days?)\\b',
].join('|'), 'gi');

export function parseWhen(text, now = new Date()) {
  const found = text.match(DATE_RE); if (!found) return null;
  const phrase = found.join(' ').toLowerCase();
  const d = new Date(now); let dateSet = false, timeSet = false;
  let m;
  if ((m = /in\s+(\d+)\s+(minute|min|hour|day)/.exec(phrase))) {
    const n = +m[1]; if (m[2].startsWith('day')) d.setDate(d.getDate() + n); else d.setMinutes(d.getMinutes() + n * (m[2].startsWith('hour') ? 60 : 1));
    dateSet = timeSet = !m[2].startsWith('day'); dateSet = true;
  }
  if (/tomorrow/.test(phrase)) { d.setDate(d.getDate() + 1); dateSet = true; }
  else if (/today|tonight|this (morning|afternoon|evening)/.test(phrase)) dateSet = true;
  const wd = DAYS.findIndex((x) => phrase.includes(x));
  if (wd >= 0) { let add = (wd - d.getDay() + 7) % 7; if (add === 0 || /next/.test(phrase)) add = add || 7; d.setDate(d.getDate() + add); dateSet = true; }
  if ((m = new RegExp(`(${MONTHS.map((x) => x.slice(0, 3)).join('|')})[a-z]*\\.?\\s+(\\d{1,2})`).exec(phrase))) {
    d.setMonth(MONTHS.findIndex((x) => x.startsWith(m[1]))); d.setDate(+m[2]); if (d < now) d.setFullYear(d.getFullYear() + 1); dateSet = true;
  }
  if ((m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/.exec(phrase))) {
    let h = +m[1] % 12; if (m[3].startsWith('p')) h += 12; d.setHours(h, +(m[2] || 0), 0, 0); timeSet = true;
  } else if ((m = /\b(\d{1,2}):(\d{2})\b/.exec(phrase))) { d.setHours(+m[1], +m[2], 0, 0); timeSet = true; }
  else if (/noon/.test(phrase)) { d.setHours(12, 0, 0, 0); timeSet = true; }
  else if (/midnight/.test(phrase)) { d.setHours(0, 0, 0, 0); timeSet = true; }
  else if (!timeSet) {
    const part = /morning/.test(phrase) ? 9 : /afternoon/.test(phrase) ? 14 : /evening|tonight|night/.test(phrase) ? 19 : 9;
    d.setHours(part, 0, 0, 0); timeSet = true;
  }
  if (!dateSet && timeSet && d < now) d.setDate(d.getDate() + 1);   // "at 3pm" when it's already 5pm → tomorrow
  const fmt = (x) => x.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const end = new Date(d.getTime() + 60 * 60 * 1000);
  return { date: d, start: fmt(d), end: fmt(end), rest: text.replace(DATE_RE, ' ').replace(/\s+/g, ' ').trim() };
}

// ---------- Commands ----------
const pct = (s) => {
  const t = s.toLowerCase().trim().replace(/^(go|be|all the way|way)\s+/, '').replace(/\s+(please|now)$/, '');
  const m0 = /(\d{1,3})\s*(%|percent)?/.exec(t); if (m0) return Math.min(100, +m0[1]) / 100;
  if (/\b(max|maximum|full|highest|brightest|loudest|all the way up)\b/.test(t)) return 1;
  if (/\b(min|minimum|lowest|off|zero|darkest|all the way down)\b/.test(t)) return 0;
  if (/\bhalf(way)?\b/.test(t)) return 0.5;
  if (/\b(low|dim|darker|quieter|lower|down)\b/.test(t)) return 0.25;
  if (/\b(high|bright|brighter|louder|higher|up)\b/.test(t)) return 0.8;
  return null;
};
const sc = (shortcut, input, say) => ({ tool: 'device', value: { shortcut, input: input == null ? '' : String(input), say } });

// Returns a device command or null.
export function parseDevice(t) {
  let m;
  if ((m = /^(?:set|turn|change|make|put|bring)?\s*(?:the\s+)?(?:screen\s+)?brightness\s+(?:to|at|up to|down to|go to|go|be)?\s*(.+)$/i.exec(t)) || (m = /^(?:turn|bring|set)\s+(?:the\s+)?(?:screen\s+)?brightness\s+(up|down)$/i.exec(t)) || (m = /^(?:make\s+(?:the\s+)?screen|screen)\s+(brighter|darker|dim|max|full)$/i.exec(t))) {
    const v = pct(m[1]); if (v != null) return sc('PA Brightness', v, `Setting brightness to ${Math.round(v * 100)}%`);
  }
  if ((m = /^(?:set|turn|change|put|make|bring)?\s*(?:the\s+)?volume\s+(?:to|at|up to|down to|go to|go|be)?\s*(.+)$/i.exec(t)) || (m = /^(?:turn|make)\s+(?:it|the\s+(?:sound|music))\s+(louder|quieter|up|down)$/i.exec(t))) { const v = pct(m[1]); if (v != null) return sc('PA Volume', v, `Setting volume to ${Math.round(v * 100)}%`); }
  if (/^(mute|silence)(\s+(the\s+)?(sound|volume|ipad|audio))?$/i.test(t)) return sc('PA Volume', 0, 'Muting');
  if (/^(play|pause|resume|stop)(\s+(the\s+)?(music|song|playback|audio))?$/i.test(t)) return sc('PA Play Pause', '', 'Toggling play/pause');
  if (/^(next|skip)(\s+(this\s+|the\s+)?(song|track))?$|^(play\s+)?(the\s+)?next\s+(song|track)$/i.test(t)) return sc('PA Next Track', '', 'Skipping to the next song');
  if ((m = /^(?:set|start|make)?\s*(?:a\s+)?timer\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|h|m|s)\b/i.exec(t))
    || (m = /^(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|h|m|s)\s+timer$/i.exec(t))) {
    const n = +m[1], u = m[2].toLowerCase(); const minutes = /^h/.test(u) ? n * 60 : /^s/.test(u) ? n / 60 : n;
    return sc('PA Timer', +minutes.toFixed(2), `Starting a ${m[1]} ${u.replace(/^(m|mins?)$/, 'minute').replace(/^(h|hrs?)$/, 'hour').replace(/^(s|secs?)$/, 'second')} timer`);
  }
  if ((m = /^(?:remind me\s+(?:to\s+|about\s+)?|add\s+(?:a\s+)?reminder\s+(?:to\s+)?|new reminder:?\s*)([\s\S]+)$/i.exec(t))) return sc('PA Reminder', m[1].trim(), `Adding the reminder “${m[1].trim()}”`);
  if ((m = /^(?:add|create|schedule|put|make|book)\s+(?:an?\s+)?(?:event|meeting|appointment)?\s*(?:called|named|for)?\s*([\s\S]+?)(?:\s+(?:to|on|in)\s+(?:my\s+)?calendar)?$/i.exec(t)) && /calendar|event|meeting|appointment|schedule/i.test(t)) {
    const when = parseWhen(m[1]);
    if (when) {
      const title = when.rest.replace(/\b(to|on|in)\s+(my\s+)?calendar\b/i, '').replace(/\b(an?|the)\s*$/i, '').replace(/^(an?\s+)?(event|meeting|appointment)\s+/i, '').trim() || 'Event';
      return sc('PA Event', JSON.stringify({ t: title, s: when.start, e: when.end }), `Adding “${title}” to your calendar for ${when.start}`);
    }
  }
  if (/^(?:what(?:'s| is)\s+)?(?:my\s+|the\s+)?battery(?:\s+(?:level|percentage|life|status))?(?:\s+(?:left|at))?$|^how much battery/i.test(t)) return sc('PA Battery', '', 'Checking the battery');
  if ((m = /^(?:say|speak|read\s+(?:this\s+)?(?:out\s+)?loud|read aloud)[:\s]+([\s\S]+)$/i.exec(t))) return sc('PA Speak', m[1].trim(), 'Speaking');
  if ((m = /^turn\s+(on|off)\s+(?:the\s+)?(wi-?fi|bluetooth)$|^(wi-?fi|bluetooth)\s+(on|off)$/i.exec(t))) {
    const on = (m[1] || m[4]).toLowerCase() === 'on'; const what = /wi/i.test(m[2] || m[3]) ? 'WiFi' : 'Bluetooth';
    return sc(`PA ${what} ${on ? 'On' : 'Off'}`, '', `Turning ${what === 'WiFi' ? 'Wi-Fi' : 'Bluetooth'} ${on ? 'on' : 'off'}`);
  }
  return null;
}

// ---------- Opening other apps straight to content (with website fallback) ----------
export const APP_DEEP = {
  youtube: { app: (q) => q ? `youtube://results?search_query=${enc(q)}` : 'youtube://', web: (q) => `https://www.youtube.com/${q ? 'results?search_query=' + enc(q) : ''}` },
  spotify: { app: (q) => q ? `spotify:search:${enc(q)}` : 'spotify:', web: (q) => `https://open.spotify.com/${q ? 'search/' + enc(q) : ''}` },
  discord: { app: () => 'discord://', web: () => 'https://discord.com/app' },
  zoom: { app: () => 'zoomus://', web: () => 'https://zoom.us' },
  whatsapp: { app: (q) => q ? `whatsapp://send?text=${enc(q)}` : 'whatsapp://', web: () => 'https://web.whatsapp.com' },
  instagram: { app: () => 'instagram://app', web: () => 'https://www.instagram.com' },
  netflix: { app: () => 'nflx://', web: () => 'https://www.netflix.com' },
  gmail: { app: () => 'googlegmail://', web: () => 'https://mail.google.com' },
  'google maps': { app: (q) => q ? `comgooglemaps://?q=${enc(q)}` : 'comgooglemaps://', web: (q) => `https://www.google.com/maps/${q ? 'search/' + enc(q) : ''}` },
  chrome: { app: () => 'googlechrome://', web: () => 'https://www.google.com' },
  slack: { app: () => 'slack://open', web: () => 'https://app.slack.com' },
  notion: { app: () => 'notion://', web: () => 'https://www.notion.so' },
  telegram: { app: () => 'tg://', web: () => 'https://web.telegram.org' },
  roblox: { app: () => 'robloxmobile://', web: () => 'https://www.roblox.com' },
  minecraft: { app: () => 'minecraft://', web: () => 'https://www.minecraft.net' },
  'google docs': { app: () => 'googledocs://', web: () => 'https://docs.google.com' },
  'google drive': { app: () => 'googledrive://', web: () => 'https://drive.google.com' },
  'google classroom': { app: () => 'googleclassroom://', web: () => 'https://classroom.google.com' },
  duolingo: { app: () => 'duolingo://', web: () => 'https://www.duolingo.com' },
  canva: { app: () => 'canva://', web: () => 'https://www.canva.com' },
};

export function parseAppIntent(t) {
  let m;
  const names = Object.keys(APP_DEEP).sort((a, b) => b.length - a.length).join('|');
  if ((m = new RegExp(`^(?:play|listen to|put on)\\s+(.+?)\\s+on\\s+(spotify|youtube)$`, 'i').exec(t))) return deep(m[2], m[1]);
  if ((m = new RegExp(`^(?:open|launch|start|go to|pull up|switch to)\\s+(?:the\\s+)?(${names})(?:\\s+app)?$`, 'i').exec(t))) return deep(m[1], '');
  if ((m = new RegExp(`^(?:search|look up|find)\\s+(?:the\\s+)?(spotify|youtube)\\s+app\\s+for\\s+(.+)$`, 'i').exec(t))) return deep(m[1], m[2]);
  return null;
}
function deep(app, q) {
  const k = app.toLowerCase(); const d = APP_DEEP[k];
  return { tool: 'open_deep', value: { name: k.replace(/\b\w/g, (c) => c.toUpperCase()), app: d.app(q), web: d.web(q), q } };
}

// Try the app; if the page is still visible ~1.6 s later the app isn't installed, so open the website.
export function openWithFallback(appURL, webURL, openURL) {
  return new Promise((resolve) => {
    let left = false; const onHide = () => { if (document.visibilityState === 'hidden') left = true; };
    document.addEventListener('visibilitychange', onHide);
    openURL(appURL);
    setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide);
      if (!left && document.visibilityState === 'visible') { openURL('x-safari-' + webURL); resolve('web'); } else resolve('app');
    }, 1600);
  });
}
