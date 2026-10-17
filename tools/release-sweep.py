"""Stage 12 release sweep: run every authenticated browser journey against the loopback QA server, one after another,
and record exit codes, PASS/FAIL counts and durations in docs/master/stage12/sweep.json.

Each journey uses disposable fixtures and SwiftShader rendering. These results prove behaviour in a desktop
browser; they are not phone frame-rate measurements. Logs go to .local/master/sweep/ (git-ignored).
Usage: python tools/release-sweep.py [--only name ...]
"""
import argparse, json, os, re, subprocess, sys, time
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
BASE = 'http://127.0.0.1:8083'
# (name, brief journeys covered, command)
SWEEP = [
    ('world', 'city views, destinations', ['tools/master-world-browser-test.py', '--label', 'stage12', '--base', BASE]),
    ('hud-layout', '12.6 viewports 375x812, 390x844, 430x932, 390x530, 844x390', ['tools/master-hud-layout-test.py', '--base', BASE]),
    ('meet', 'A (HUD objectives), F social discovery, G empty server', ['tools/meet-browser-test.py', '--base', BASE]),
    ('career', 'B career qualification, C auto-work', ['tools/career-browser-test.py', '--base', BASE]),
    ('property', 'D property ownership and resale', ['tools/property-browser-test.py', '--base', BASE, '--unit', 'awd-jtown-01', '--price', '6000']),
    ('vehicle', 'E vehicle resale', ['tools/vehicle-browser-test.py', '--base', BASE]),
    ('camera', 'H third-person home', ['tools/camera-browser-test.py', '--base', BASE]),
    ('life-events', 'I personal life event', ['tools/life-events-browser-test.py', '--base', BASE]),
    ('ambient', 'J business frontage, ambient street life', ['tools/ambient-browser-test.py', '--base', BASE]),
    ('advertise', 'K advertising checkout and activation', ['tools/advertise-browser-test.py', '--base', BASE]),
    ('events', 'L community event', ['tools/events-browser-test.py', '--base', BASE]),
    ('admin', 'M administrator security', ['tools/admin-browser-test.py', '--base', BASE]),
    ('commerce', 'N trading under reconnects', ['tools/phase8-browser-test.py', '--case', 'commerce', '--base', BASE]),
    ('business', 'J player business (settlement, reconnect)', ['tools/phase8-browser-test.py', '--case', 'business_reconnect', '--base', BASE]),
    ('social', 'N shared activities and messages', ['tools/phase8-browser-test.py', '--case', 'social', '--base', BASE]),
    ('housing', 'N home visits and housing', ['tools/phase8-browser-test.py', '--case', 'housing', '--base', BASE]),
    ('dbee', 'O Dbee progression', ['tools/phase8-browser-test.py', '--case', 'dbee', '--base', BASE]),
]
# Every journey starts from fresh disposable fixture accounts (natural Hustler/Dbee origins, untouched wallets), plus
# the QA-only preparation its stage documented. These helpers refuse anything but the loopback awd_security database.
ENV = {**os.environ, 'DATABASE_URL': 'postgres://awd@127.0.0.1:55432/awd_security', 'REDIS_URL': 'redis://127.0.0.1:6379/14', 'REDIS_NAMESPACE': 'phase8:'}
def node(*a):
    subprocess.run(['node', *a], cwd='server', env=ENV, check=True, capture_output=True)
def role(name):
    return next(f for f in json.loads(Path('.local/phase8/fixtures.json').read_text()) if f['role'] == name)['id']
PREP = {
    'property': lambda: node('loadtest/property-fixtures.js', 'price-unit', 'awd-jtown-01', '5000'),
    'vehicle': lambda: (node('loadtest/vehicle-fixtures.js', 'grant-car', str(role('property')), 'vitz'), node('loadtest/vehicle-fixtures.js', 'fund', str(role('buyer')), '60000')),
}
KEEP = {'business'}   # continues with the business the commerce journey just created
def prepare(name):
    if name in KEEP:
        return
    node('loadtest/phase8-fixtures.js')
    subprocess.run(['node', '-e', "const R=require('ioredis');const r=new R('redis://127.0.0.1:6379/14');r.keys('phase8:awd:limit:*').then(k=>k.length?r.del(...k):0).then(()=>r.quit())"], cwd='server', check=True, capture_output=True)
    if name in PREP:
        PREP[name]()

parser = argparse.ArgumentParser()
parser.add_argument('--only', nargs='*')
args = parser.parse_args()
LOGS = Path('.local/master/sweep'); LOGS.mkdir(parents=True, exist_ok=True)
OUT = Path('docs/master/stage12'); OUT.mkdir(parents=True, exist_ok=True)
prev = json.loads((OUT / 'sweep.json').read_text()) if (OUT / 'sweep.json').exists() else {'runs': {}}
for name, covers, cmd in SWEEP:
    if args.only and name not in args.only:
        continue
    start = time.time()
    prepare(name)
    try:
        p = subprocess.run([sys.executable, *cmd], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=1800)
        code, out = p.returncode, p.stdout + p.stderr
    except subprocess.TimeoutExpired as e:
        code, out = 'timeout', (e.stdout or '') if isinstance(e.stdout, str) else ''
    (LOGS / f'{name}.log').write_text(out, encoding='utf-8')
    passed = len(re.findall(r'^PASS', out, re.M)); failed = len(re.findall(r'^FAIL', out, re.M))
    tail = [l for l in out.strip().splitlines() if l.strip()][-1:] if code != 0 else []
    prev['runs'][name] = {'covers': covers, 'exit': code, 'pass': passed, 'fail': failed, 'seconds': round(time.time() - start), 'lastLine': (tail[0][:200] if tail else '')}
    print(f'{name}: exit={code} pass={passed} fail={failed} {round(time.time() - start)}s', flush=True)
    (OUT / 'sweep.json').write_text(json.dumps({'scope': 'Loopback QA server, disposable fixtures, SwiftShader Chromium; not phone performance.', **prev}, indent=1))
