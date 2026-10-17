"""Run pipeline stages in headless Blender (no MCP needed).

Usage:
    blender --background --factory-startup --python characters/tools/run_stages.py -- male body,dress,export,base,library,wardrobe
Writes characters/previews/wip/stages_<sex>.log as JSON.
"""
import json
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['male', 'body,dress']
sex, stages = args[0], args[1].split(',')
namespace = {'AWD_ROOT': str(ROOT), '__name__': 'build_prototype'}
exec(compile((ROOT / 'characters' / 'scripts' / 'build_prototype.py').read_text(encoding='utf-8'), 'build_prototype.py', 'exec'),
     namespace)
CALLS = {
    'body': lambda: namespace['stage_body'](sex),
    'dress': lambda: namespace['stage_dress']('fade' if sex == 'male' else 'twa'),
    'export': lambda: namespace['stage_save_export'](),
    'base': lambda: namespace['stage_base_export'](),
    'library': lambda: namespace['stage_library'](),
    'wardrobe': lambda: namespace['stage_wardrobe'](),
    'props': lambda: namespace['stage_props'](),
}
log = ROOT / 'characters' / 'previews' / 'wip' / f'stages_{sex}.log'
results = {}
for stage in stages:
    try:
        results[stage] = CALLS[stage]()
    except Exception:   # record and stop: later stages depend on earlier ones
        results[stage] = {'error': traceback.format_exc()[-3000:]}
        break
    log.write_text(json.dumps(results, indent=1, default=str), encoding='utf-8')
log.write_text(json.dumps(results, indent=1, default=str), encoding='utf-8')
print('STAGES DONE', list(results))
