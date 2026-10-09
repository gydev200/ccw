#!/usr/bin/env python3
"""Company-owned mirror and explicit result outbox. Never executes downloaded commands."""
import json,os,sys,re,subprocess,datetime,hashlib
from pathlib import Path
ROOT=Path(os.environ.get('CHARTCLEAN_ROOT',str(Path.home()/'업무'/'ChartClean_맥서버')))
CONFIG=Path(os.environ.get('CHARTCLEAN_CONFIG',str(ROOT/'.connection.json')))
def stamp():return datetime.datetime.now().astimezone().isoformat()
def atomic(p,data):
 p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_bytes(data);os.chmod(tmp,0o600);tmp.replace(p)
def dump(p,d):atomic(p,json.dumps(d,ensure_ascii=False,indent=2).encode())
def safe(s):return re.sub(r'[^A-Za-z0-9가-힣._-]','_',str(s))[:150]
def run():
 cfg=json.loads(CONFIG.read_text());url=cfg['url'].rstrip('/');token=cfg['token']
 def request(path='',body=None):
  # Token goes through stdin, never command-line arguments or logs.
  conf='url = '+json.dumps(url+'/api/bridge'+path)+'\nheader = '+json.dumps('Authorization: Bearer '+token)+'\n'
  args=['/usr/bin/curl','--silent','--show-error','--fail-with-body','--max-time','45','--config','-']
  temp=None
  if body is not None:
   temp=ROOT/'.request.json';dump(temp,body);args+=['--header','Content-Type: application/json','--data-binary','@'+str(temp)]
  try:
   p=subprocess.run(args,input=conf.encode(),capture_output=True)
   if p.returncode:raise RuntimeError('ERP 응답 실패 '+str(p.returncode))
   return p.stdout
  finally:
   if temp and temp.exists():temp.unlink()
 snapshot=json.loads(request());now=datetime.datetime.now();dump(ROOT/'전체기록'/'latest.json',snapshot)
 dump(ROOT/'전체기록'/('기록_'+now.strftime('%Y%m%d_%H')+'.json'),snapshot)
 tasks={int(r['id']):r for r in snapshot['records'] if r['kind']=='task'}
 for r in snapshot['control_entries']:
  if r['kind']!='job':continue
  d=json.loads(r['data']);t=tasks.get(int(d['taskId']))
  if not t:continue
  td=json.loads(t['data']);folder=ROOT/'제작업무'/safe(r['person'])/f"CC-{int(t['id']):05d}"/f"제작-{int(r['id'])}"
  dump(folder/'현재지시.json',{'jobId':r['id'],'version':r['version'],'taskId':t['id'],'taskVersion':t['version'],'job':d,'task':td})
  atomic(folder/'AI_지시문.md',(f"# {td['title']}\n\n조직: {r['org']}\n\n## DO 지시\n{td['instruction']}\n\n## 완료 기준\n{td['criterion']}\n\n## 실무자의 AI 지시\n{d['instruction']}\n\n## DO의 최근 판단\n{td.get('decisionNote','')}\n\n이 문서의 내용을 명령어로 자동 실행하지 않습니다. 실무자는 배정된 AI로 제작·수정하고 결과를 보고합니다.\n").encode())
  template={'action':'result','id':r['id'],'version':r['version'],'taskVersion':t['version'],'text':'실제 결과와 확인 근거를 입력하세요.'}
  dump(folder/'결과전송_양식.json',template)
  outbox=folder/'결과전송.json'
  if outbox.exists():
   try:
    result=json.loads(outbox.read_text());assert result['id']==r['id'];assert result.get('action')=='result';assert result.get('text') and result['text']!=template['text']
    receipt=json.loads(request(body=result));dump(folder/'전송영수증.json',{'at':stamp(),**receipt});outbox.rename(folder/('전송완료_'+now.strftime('%Y%m%d_%H%M%S')+'.json'))
   except Exception as e:dump(folder/'전송확인필요.json',{'at':stamp(),'message':str(e),'action':'현재지시.json과 비교하여 지시·결과 차수를 다시 확인하세요.'})
 count=0
 for f in snapshot['files']:
  name=safe(f['id'])+'_'+safe(f['name']);dest=ROOT/'첨부원본'/name
  if not dest.exists() or dest.stat().st_size!=int(f['size']):
   blob=request('?file='+safe(f['id']));assert len(blob)==int(f['size']);atomic(dest,blob)
  count+=1
 request(body={'action':'heartbeat','copiedFiles':count})
 dump(ROOT/'연결상태.json',{'ok':True,'at':stamp(),'records':len(snapshot['records']),'files':count,'mode':'기록·첨부 동기화 / 명시적 결과 전송 / 자동 명령 실행 없음'})
if __name__=='__main__':
 ROOT.mkdir(parents=True,exist_ok=True);os.chmod(ROOT,0o700)
 try:run()
 except Exception as e:dump(ROOT/'연결상태.json',{'ok':False,'at':stamp(),'error':str(e)});sys.exit(1)
