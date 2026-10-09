import json, urllib.request, urllib.error, base64, hashlib, concurrent.futures
from pathlib import Path

root = Path(__file__).resolve().parent
registry_path = root.parent / 'outputs/chartclean-versions/versions.json'
registry = json.loads(registry_path.read_text(encoding='utf-8'))
auth = json.loads(Path('C:/Users/user/AppData/Roaming/com.vercel.cli/Data/auth.json').read_text(encoding='utf-8'))
token = auth.get('token') or auth.get('access_token')
if not token:
    raise RuntimeError('Vercel CLI access token unavailable')
team = registry['team']
deployment = registry['versions']['existing']['deploymentId']
def get(path):
    separator = '&' if '?' in path else '?'
    request = urllib.request.Request('https://api.vercel.com' + path + separator + 'slug=' + team, headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)

detail = get('/v13/deployments/' + deployment)
project_id = detail.get('projectId') or detail.get('project', {}).get('id')
summary = {k: detail.get(k) for k in ['id','name','url','readyState','target','createdAt','projectId']}
(root / 'existing-deployment.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
tree = get('/v6/deployments/' + deployment + '/files')
(root / 'existing-file-tree.json').write_text(json.dumps(tree, indent=2), encoding='utf-8')
files = []
def visit(nodes, prefix=''):
    for node in nodes:
        name = node['name']
        relative = prefix + name
        if node.get('type') == 'directory':
            visit(node.get('children', []), relative + '/')
        else:
            if relative.startswith('/') or '..' in Path(relative).parts:
                raise RuntimeError('Invalid source path')
            files.append((relative, node['uid']))
visit(tree)
files = [item for item in files if item[0].startswith('src/')]
destination = root / 'ccw-source'
destination.mkdir(exist_ok=True)
def download(item):
    relative, uid = item
    target = destination / relative
    if target.exists():
        return relative
    data = get('/v8/deployments/' + deployment + '/files/' + uid)
    encoded = data.get('data') if isinstance(data, dict) else data
    if encoded is None and isinstance(data, dict):
        encoded = data.get('content')
    if not isinstance(encoded, str):
        raise RuntimeError('Unsupported source response for ' + relative + ': ' + ','.join(data.keys()))
    content = base64.b64decode(encoded)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return relative
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(download, files))
manifest = [{'path': str(p.relative_to(destination)).replace('\\','/'), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in destination.rglob('*') if p.is_file()]
(root / 'existing-source-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps({'projectId':project_id,'files':len(results),'destination':str(destination)}, ensure_ascii=False), flush=True)
