import json,hashlib,shutil,urllib.request,base64
from pathlib import Path
root=Path(__file__).parent
src=root/'ccw-source'
dest=root.parent/'outputs/chartclean-versions/existing-source'
manifest=json.loads((root/'existing-source-manifest.json').read_text())
tree=json.loads((root/'existing-file-tree.json').read_text())
uids={}
def visit(nodes,prefix=''):
 for n in nodes:
  path=prefix+n['name']
  if n['type']=='directory':visit(n.get('children',[]),path+'/')
  else:uids[path]=n['uid']
visit(tree)
auth=json.loads(Path('C:/Users/user/AppData/Roaming/com.vercel.cli/Data/auth.json').read_text())
for entry in manifest:
 p=entry['path']
 if not p.startswith('src/'):continue
 target=dest/p[4:];target.parent.mkdir(parents=True,exist_ok=True)
 original=src/p
 if hashlib.sha256(original.read_bytes()).hexdigest()==entry['sha256']:shutil.copy2(original,target)
 else:
  url='https://api.vercel.com/v8/deployments/dpl_7ADQQ7PdoWtooSsSnA5pZv7J9MJg/files/'+uids[p]+'?slug=happyshs747-3030s-projects'
  req=urllib.request.Request(url,headers={'Authorization':'Bearer '+auth['token']})
  data=json.load(urllib.request.urlopen(req,timeout=60));target.write_bytes(base64.b64decode(data.get('data') or data.get('content')))
 assert hashlib.sha256(target.read_bytes()).hexdigest()==entry['sha256'],p
print('Existing source backup verified by SHA256')
