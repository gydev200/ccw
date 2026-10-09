from pathlib import Path
import json,urllib.request
p=Path(__file__).parent.parent/'outputs/chartclean-versions'
auth=json.loads(Path('C:/Users/user/AppData/Roaming/com.vercel.cli/Data/auth.json').read_text())
deployment='dpl_23wbXsszyP4SnaayMAMfpufGyj78'
req=urllib.request.Request('https://api.vercel.com/v13/deployments/'+deployment+'?slug=happyshs747-3030s-projects',headers={'Authorization':'Bearer '+auth['token']})
d=json.load(urllib.request.urlopen(req,timeout=60))
assert d['readyState']=='READY'
r=json.loads((p/'versions.json').read_text(encoding='utf-8'))
r['currentVersion']='existing-with-v2-preview'
r['versions']['v2'].update(status='deployed-preview',deploymentId=deployment,deploymentUrl='https://'+d['url'],dashboardUrl='https://vercel.com/happyshs747-3030s-projects/chartclean-erp/'+deployment[4:],previewPath='/v2',previewAccount='ccw32',previewPerson='kyunghwa',accountConnectionVerified=True,readOnly=True,doFrontend='existing',promotionRequiresUserApproval=True)
r['versions']['v2'].update(readOnly=False,businessDataReadOnly=True,staffAccountRequestsEnabled=True,accountManagementPath='/v2/accounts',temporaryRoleSwitch='display-only; approvals use actual login role')
r['versions']['v2'].update(dailyPlanPath='/v2', dailyPlanPreviewPath='/v2#personal/daily-plan', dailyPlanLanding='ccw32-staff-only', dailyPlanEditRole='actual-DO-only', theme='white-gray-navy')
(p/'versions.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
t=(p/'운영기준.txt').read_text(encoding='utf-8')
t=t.replace('전체 운영 소스의 로컬 백업과 CLI 인증은 아직 확보되지 않았다.\n따라서 전체 소스 백업을 완료하기 전에는 버전 2 운영 배포를 하지 않는다.','Vercel CLI 인증 완료. 운영 소스 457개 파일을 복원하여 SHA256 대조를 완료했다.\nexisting-source.zip과 existing-source Git의 existing-production 태그로 보관했다.\nccw32 · 고경화 계정 연결을 운영 화면에서 확인했다.\n버전 2는 별도 화면 복사본으로 배포했으며 DO 기본 화면은 기존 구성을 유지한다.\n앞으로 고경화 화면 수정 → 사용자 검수·승인 → DO 반영 순서로 진행한다.')
(p/'운영기준.txt').write_text(t,encoding='utf-8')
print('READY deployment registered; existing baseline preserved')
