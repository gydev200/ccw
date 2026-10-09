from pathlib import Path
p=Path(__file__).parent/'ccw-source/src/versions/v2/app/workspace.tsx'
s=p.read_text(encoding='utf-8')
edits=[
 ("SS:['서비스','C콜','세팅','CA'", "SS:['병원 정보','세팅','운영','공통 양식','C콜','CA'"),
 ("teamRoute[1]==='ss'&&next==='CA 주문·서비스'", "teamRoute[1]==='ss'&&['병원 정보','세팅','운영','공통 양식','CA 주문·서비스'].includes(next)"),
 ("tool==='세팅'?'셋팅'", "tool==='세팅'?'세팅'"),
 ("tool==='CA'?'#ca':tool==='세팅'?'#ss-setup':'#s'", "tool==='CA'?'#ca':tool==='세팅'?'#ss-setup':['병원 정보','운영','공통 양식'].includes(tool)?'#ss/'+encodeURIComponent(tool):'#s'"),
 ("if(area==='PM'&&ORGANIZATION_TOOLS.PM.includes(tool)){", "if(area==='SS'&&['병원 정보','세팅','운영','공통 양식'].includes(tool)){history.replaceState(null,'',tool==='세팅'?'#ss-setup':'#ss/'+encodeURIComponent(tool));return;}\n  if(area==='PM'&&ORGANIZATION_TOOLS.PM.includes(tool)){"),
 ("{area==='SS'&&ssParent==='세팅'&&<nav", "{area==='SS'&&tab==='맞춤 요청'&&<nav"),
 ("['세팅','서비스','CA'].includes(tab)", "['병원 정보','세팅','운영','공통 양식','서비스','CA'].includes(tab)"),
]
for old,new in edits:
 assert old in s,old
 s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
print('V2 hospital menu and routes connected')
