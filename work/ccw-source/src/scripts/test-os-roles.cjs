const {chromium}=require('/Users/songhs/.agents/skills/gstack/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const load=(file,dependencies={})=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:name=>dependencies[name]||require(name),URL,Date});return module.exports;};
const roles=load('lib/os-roles.ts'),outreach=load('lib/outreach.ts',{'./os-roles':roles});
for(const purpose of [...roles.OP_ACTIVITIES,'일반 연락','B1 레퍼런스','B2 맞춤 제안','EMR 요청']){
 const validated=outreach.validateOutreach('call',{hospitalId:'fixture-hospital',issueId:1,journey:'B',outcome:'관심',reaction:'검증용 반응',usedCopy:'검증 문구',bStep:purpose,reference:'검증용 소식지'});assert.equal(validated.bStep,purpose);
}
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture={rows:[{id:1,kind:'issue',version:1,data:{number:1,title:'검증 소식지',copy:'검증 문구',status:'배포 가능'}},{id:2,kind:'delivery',version:1,data:{issueId:1,hospitalId:'fixture-hospital',status:'전달',quantity:1}}],workers:[],customers:[],metrics:[],health:[],writable:['call'],revision:0,buildings:[{id:'fixture-building',code:'TEST',address:'검증용 주소',hospitals:[{id:'fixture-hospital',name:'검증용 병원',address:'검증용 주소',cluster:1}],count:1}],clusters:[],sourceCount:1,buildingCount:1};
 await page.route('**/api/**',route=>{assert.equal(route.request().method(),'GET');const path=new URL(route.request().url()).pathname;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(path==='/api/erp'?{member:{id:'fixture',person:'do',label:'검증 계정',role:'DO',active:1},orgs:[],records:[]}:path==='/api/outreach'?fixture:path==='/api/do-work-map'?require('../lib/do-work-map.json'):{hospitals:[],canEdit:false})});});
 await page.goto('http://localhost:18998/#b');const side=page.locator('[data-slot="sidebar-content"]');await side.getByRole('button',{name:'이번 소식지 소개',exact:true}).waitFor();
 assert.match(await page.locator('.works-section-title b').innerText(),/OP · 오퍼레이터/);
 for(const purpose of roles.OP_ACTIVITIES){
  await side.getByRole('button',{name:purpose,exact:true}).click();await page.getByRole('heading',{name:purpose,exact:true}).waitFor();assert.equal(await page.evaluate(()=>location.hash),'#op/'+encodeURIComponent(purpose));
  await page.locator('.or-list').getByRole('button',{name:/검증용 병원/}).click();
  await page.getByRole('button',{name:'연락·반응 기록',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.getByRole('combobox',{name:'이번 연락 목적',exact:true}).innerText(),purpose);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'입력 버리고 닫기',exact:true}).click();
 }
 await page.reload();await page.getByRole('heading',{name:'EMR 분석 신청',exact:true}).waitFor();
 await page.screenshot({path:'/Users/songhs/업무/차트클린/OS배송컨트롤_20261006/OP_전화영업.png'});
 const org=page.getByRole('navigation',{name:'조직 선택'});await org.getByRole('button',{name:'OS',exact:true}).hover();await page.getByRole('button',{name:'DM · 델리버리 매니저',exact:true}).click();await page.getByRole('heading',{name:'소식지 배송',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await org.getByRole('button',{name:'OS',exact:true}).press('ArrowDown');await page.locator('.organization-dropdown').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'/Users/songhs/업무/차트클린/OS배송컨트롤_20261006/OS_모바일.png'});assert.deepEqual(errors,[]);await browser.close();console.log('PASS: DM·OP 역할, OP 세 가지 메뉴·통화 목적 기본값·새로고침, 기존 4개 목적 호환, 모바일, 실제 POST 없음');
})().catch(e=>{console.error(e);process.exit(1)});
