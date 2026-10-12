"""Fetch the CC0 authored MakeHuman mesh and macro targets, with provenance."""
import json, pathlib, urllib.request, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
DEST=ROOT/'.local/human-source'; DEST.mkdir(parents=True,exist_ok=True)
BASE='https://raw.githubusercontent.com/makehumancommunity/makehuman/master/'
FILES=['LICENSE.md','makehuman/data/3dobjs/base.obj',
 'makehuman/data/rigs/default_weights.mhw','makehuman/data/rigs/default.mhskel',
 'makehuman/data/targets/macrodetails/african-female-young.target',
 'makehuman/data/targets/macrodetails/african-male-young.target',
 'makehuman/data/targets/macrodetails/universal-female-young-averagemuscle-averageweight.target',
 'makehuman/data/targets/macrodetails/universal-male-young-averagemuscle-averageweight.target']
for path in FILES:
 dest=DEST/pathlib.Path(path).name
 if dest.exists(): continue
 for attempt in range(4):
  try:
   with urllib.request.urlopen(BASE+path,timeout=45) as response: data=response.read()
   dest.write_bytes(data); print(path,len(data),flush=True); break
  except Exception as e:
   print(str(e),flush=True)
   if attempt==3: raise
