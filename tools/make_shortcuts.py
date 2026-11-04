#!/usr/bin/env python3
"""Builds and signs the "PA …" Shortcuts that let Pocket Agent control the iPad.

Each Shortcut is tiny and takes its input as text from
  shortcuts://run-shortcut?name=PA%20Brightness&input=text&text=0.5
so the agent never needs a complicated bridge. Output: ../shortcuts/*.shortcut (signed, "anyone" mode).
"""
import json, os, plistlib, subprocess, sys, tempfile, uuid

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'shortcuts')
os.makedirs(OUT, exist_ok=True)

INPUT = {'Value': {'Type': 'ExtensionInput'}, 'WFSerializationType': 'WFTextTokenAttachment'}
def text_of(attachment_value):
    return {'Value': {'string': '￼', 'attachmentsByRange': {'{0, 1}': attachment_value}}, 'WFSerializationType': 'WFTextTokenString'}
INPUT_TEXT = text_of({'Type': 'ExtensionInput'})
def output(uuid_, name):
    return {'Value': {'OutputUUID': uuid_, 'Type': 'ActionOutput', 'OutputName': name}, 'WFSerializationType': 'WFTextTokenAttachment'}
def output_text(uuid_, name):
    return text_of({'OutputUUID': uuid_, 'Type': 'ActionOutput', 'OutputName': name})
def act(ident, **params):
    return {'WFWorkflowActionIdentifier': ident, 'WFWorkflowActionParameters': params}

def dict_value(dict_uuid, key):
    u = str(uuid.uuid4()).upper()
    return u, act('is.workflow.actions.getvalueforkey', WFGetDictionaryValueType='Value', WFDictionaryKey=key, WFInput=output(dict_uuid, 'Dictionary'), UUID=u)

def shortcut(actions, color=4282601983, glyph=59511):
    return {
        'WFWorkflowClientVersion': '2605.0.5', 'WFWorkflowMinimumClientVersion': 900, 'WFWorkflowMinimumClientVersionString': '900',
        'WFWorkflowIcon': {'WFWorkflowIconStartColor': color, 'WFWorkflowIconGlyphNumber': glyph},
        'WFWorkflowImportQuestions': [], 'WFWorkflowTypes': [], 'WFWorkflowHasShortcutInputVariables': True,
        'WFWorkflowInputContentItemClasses': ['WFStringContentItem', 'WFNumberContentItem'],
        'WFWorkflowActions': actions,
    }

def event_actions():
    d = str(uuid.uuid4()).upper()
    t_u, t = dict_value(d, 't'); s_u, s = dict_value(d, 's'); e_u, e = dict_value(d, 'e')
    return [
        act('is.workflow.actions.detect.dictionary', WFInput=INPUT, UUID=d), t, s, e,
        act('is.workflow.actions.addnewevent', WFCalendarItemTitle=output_text(t_u, 'Dictionary Value'),
            WFCalendarItemStartDate=output_text(s_u, 'Dictionary Value'), WFCalendarItemEndDate=output_text(e_u, 'Dictionary Value'),
            WFCalendarItemAllDay=False, ShowWhenRun=False),
    ]

def battery_actions():
    b = str(uuid.uuid4()).upper()
    return [act('is.workflow.actions.getbatterylevel', UUID=b),
            act('is.workflow.actions.showresult', Text=text_of({'OutputUUID': b, 'Type': 'ActionOutput', 'OutputName': 'Battery Level'}))]

# name → (description shown in the app, actions)
SHORTCUTS = {
    'PA Brightness':  ('Set screen brightness (0–1)', [act('is.workflow.actions.setbrightness', WFBrightness=INPUT)]),
    'PA Volume':      ('Set volume (0–1)', [act('is.workflow.actions.setvolume', WFVolume=INPUT)]),
    'PA Play Pause':  ('Play or pause music', [act('is.workflow.actions.pausemusic', WFPlayPauseBehavior='Play/Pause')]),
    'PA Next Track':  ('Skip to the next song', [act('is.workflow.actions.skipforward')]),
    'PA Timer':       ('Start a timer (minutes)', [act('is.workflow.actions.timer.start', WFDuration={'Value': {'Magnitude': INPUT, 'Unit': 'min'}, 'WFSerializationType': 'WFQuantityFieldValue'})]),
    'PA Reminder':    ('Add a reminder', [act('is.workflow.actions.addnewreminder', WFCalendarItemTitle=INPUT_TEXT)]),
    'PA Event':       ('Add a calendar event', event_actions()),
    'PA Speak':       ('Speak text out loud', [act('is.workflow.actions.speaktext', WFText=INPUT_TEXT)]),
    'PA Battery':     ('Show battery level', battery_actions()),
    'PA WiFi On':     ('Turn Wi-Fi on', [act('is.workflow.actions.wifi.set', OnValue=True)]),
    'PA WiFi Off':    ('Turn Wi-Fi off', [act('is.workflow.actions.wifi.set', OnValue=False)]),
    'PA Bluetooth On':  ('Turn Bluetooth on', [act('is.workflow.actions.bluetooth.set', OnValue=True)]),
    'PA Bluetooth Off': ('Turn Bluetooth off', [act('is.workflow.actions.bluetooth.set', OnValue=False)]),
}

# ---------- One dispatcher Shortcut ("PA Control") instead of 13 separate installs ----------
# Pocket Agent runs it as  shortcuts://run-shortcut?name=PA%20Control&input=text&text={"a":"PA Brightness","v":0.4}
def var(u, name='Dictionary Value'):
    return output(u, name)
def var_text(u, name='Dictionary Value'):
    return output_text(u, name)

def control_actions():
    d = str(uuid.uuid4()).upper()
    a_u, a = dict_value(d, 'a'); v_u, v = dict_value(d, 'v')
    acts = [act('is.workflow.actions.detect.dictionary', WFInput=INPUT, UUID=d), a, v]
    def event_body():
        e = str(uuid.uuid4()).upper()
        t_u, t = dict_value(e, 't'); s_u, s_ = dict_value(e, 's'); en_u, en = dict_value(e, 'e')
        return [act('is.workflow.actions.detect.dictionary', WFInput=var(v_u), UUID=e), t, s_, en,
                act('is.workflow.actions.addnewevent', WFCalendarItemTitle=var_text(t_u), WFCalendarItemStartDate=var_text(s_u),
                    WFCalendarItemEndDate=var_text(en_u), WFCalendarItemAllDay=False, ShowWhenRun=False)]
    def battery_body():
        b = str(uuid.uuid4()).upper()
        return [act('is.workflow.actions.getbatterylevel', UUID=b),
                act('is.workflow.actions.showresult', Text=text_of({'OutputUUID': b, 'Type': 'ActionOutput', 'OutputName': 'Battery Level'}))]
    branches = {
        'PA Brightness': [act('is.workflow.actions.setbrightness', WFBrightness=var(v_u))],
        'PA Volume':     [act('is.workflow.actions.setvolume', WFVolume=var(v_u))],
        'PA Play Pause': [act('is.workflow.actions.pausemusic', WFPlayPauseBehavior='Play/Pause')],
        'PA Next Track': [act('is.workflow.actions.skipforward')],
        'PA Timer':      [act('is.workflow.actions.timer.start', WFDuration={'Value': {'Magnitude': var(v_u), 'Unit': 'min'}, 'WFSerializationType': 'WFQuantityFieldValue'})],
        'PA Reminder':   [act('is.workflow.actions.addnewreminder', WFCalendarItemTitle=var_text(v_u))],
        'PA Event':      event_body(),
        'PA Speak':      [act('is.workflow.actions.speaktext', WFText=var_text(v_u))],
        'PA Battery':    battery_body(),
        'PA WiFi On':    [act('is.workflow.actions.wifi.set', OnValue=True)],
        'PA WiFi Off':   [act('is.workflow.actions.wifi.set', OnValue=False)],
        'PA Bluetooth On':  [act('is.workflow.actions.bluetooth.set', OnValue=True)],
        'PA Bluetooth Off': [act('is.workflow.actions.bluetooth.set', OnValue=False)],
    }
    for name, body in branches.items():
        g = str(uuid.uuid4()).upper()
        cond_in = {'Type': 'Variable', 'Variable': var(a_u)}
        acts.append(act('is.workflow.actions.conditional', WFControlFlowMode=0, GroupingIdentifier=g,
                        # current Shortcuts format (iOS 17+) …
                        WFConditions={'Value': {'WFActionParameterFilterPrefix': 1, 'WFActionParameterFilterTemplates': [
                            {'WFCondition': 4, 'WFConditionalActionString': name, 'WFInput': cond_in}]},
                            'WFSerializationType': 'WFContentPredicateTableTemplate'},
                        # … and the older flat format, for older versions
                        WFCondition=4, WFConditionalActionString=name, WFInput=cond_in))
        acts += body
        acts.append(act('is.workflow.actions.conditional', WFControlFlowMode=2, GroupingIdentifier=g))
    return acts

# ---------- "Ask Pocket Agent": type or say a request → opens Pocket Agent and runs it ----------
APP_URL = 'https://proteinleogenisis.github.io/pocket-agent/?q='
def ask_actions():
    q = str(uuid.uuid4()).upper(); e = str(uuid.uuid4()).upper()
    url = APP_URL + '￼'
    return [
        act('is.workflow.actions.ask', WFAskActionPrompt='Ask Pocket Agent', WFInputType='Text', UUID=q),
        act('is.workflow.actions.urlencode', WFInput=output_text(q, 'Provided Input'), UUID=e),
        act('is.workflow.actions.openurl', WFInput={'Value': {'string': url, 'attachmentsByRange': {f'{{{len(APP_URL)}, 1}}': {'OutputUUID': e, 'Type': 'ActionOutput', 'OutputName': 'URL Encoded Text'}}}, 'WFSerializationType': 'WFTextTokenString'}),
    ]

BUILD = {
    'Ask Pocket Agent': ('Type or say a request — opens Pocket Agent and runs it. Add it to Siri, Back Tap or the Action button.', ask_actions(), 4292093695, 59446),
    'pa-control':       ('Lets Pocket Agent control brightness, volume, music, timers, reminders, calendar, speech, battery.', control_actions(), 4282601983, 59511),
}
for f in os.listdir(OUT):
    if f.endswith('.shortcut'): os.unlink(os.path.join(OUT, f))
manifest = []
for name, (desc, actions, color, glyph) in BUILD.items():
    slug = name   # iPadOS names an imported Shortcut after its file, so the file must be exactly "PA Control.shortcut"
    with tempfile.NamedTemporaryFile(suffix='.shortcut', delete=False) as tmp:
        plistlib.dump(shortcut(actions, color, glyph), tmp, fmt=plistlib.FMT_BINARY)
    out = os.path.join(OUT, slug + '.shortcut')
    r = subprocess.run(['shortcuts', 'sign', '--mode', 'anyone', '--input', tmp.name, '--output', out], capture_output=True, text=True)
    os.unlink(tmp.name)
    if r.returncode or not os.path.exists(out):
        sys.exit(f'Signing {name} failed: {r.stderr.strip()}')
    manifest.append({'name': name, 'file': f'shortcuts/{slug.replace(" ", "%20")}.shortcut', 'download': f'{slug}.shortcut', 'desc': desc})
    print('signed', name)
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print(f'{len(manifest)} shortcuts → {OUT}')
