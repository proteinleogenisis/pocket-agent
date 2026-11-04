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
    return u, act('is.workflow.actions.getvalueforkey', WFDictionaryKey=key, WFInput=output(dict_uuid, 'Dictionary'), UUID=u)

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

manifest = []
for name, (desc, actions) in SHORTCUTS.items():
    slug = name.lower().replace(' ', '-')
    with tempfile.NamedTemporaryFile(suffix='.shortcut', delete=False) as tmp:
        plistlib.dump(shortcut(actions), tmp, fmt=plistlib.FMT_BINARY)
    out = os.path.join(OUT, slug + '.shortcut')
    r = subprocess.run(['shortcuts', 'sign', '--mode', 'anyone', '--input', tmp.name, '--output', out], capture_output=True, text=True)
    os.unlink(tmp.name)
    if r.returncode or not os.path.exists(out):
        sys.exit(f'Signing {name} failed: {r.stderr.strip()}')
    manifest.append({'name': name, 'file': f'shortcuts/{slug}.shortcut', 'desc': desc})
    print('signed', name)
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print(f'{len(manifest)} shortcuts → {OUT}')
