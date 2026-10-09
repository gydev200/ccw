// DO 경영 탐색: six vertical text rows. Repeated topics are intentional.
// The DO-only work map is fetched from an authenticated server route.
export type ExplorerWork={id:string;label:string;navLabel?:string;body:string;refs:{kind:string;id?:string;basis:string}[];route:{kind:string;key?:string};links?:[string,string][]};
export type ExplorerWorkMap={items:Record<string,ExplorerWork>;frames:Record<string,string[]>};
export function explorerWorkFor(label:string,map:ExplorerWorkMap|null):ExplorerWork[]{return (map?.frames[label]||[]).map(id=>map?.items[id]).filter((item):item is ExplorerWork=>!!item)}
export const DO_EXPLORER_ROWS=[
 {title:'사업직관 4개',items:[
  {label:'돈',tabs:['FM:control','FM:receivables']},
  {label:'사업',tabs:['신규영업','병원 영업권·DB 가치']},
  {label:'추진체계',tabs:['HR:people','ER:personnel']},
  {label:'관리',tabs:['ER:home','상황판']},
 ]},
 {title:'12월까지 차트클린 프레임',items:[
  {label:'만족',tabs:['품질관리']},
  {label:'독점 자산',tabs:['ER:assets','ER:ip']},
  {label:'관리',tabs:['상황판']},
  {label:'총무',tabs:['ER:general']},
  {label:'신사업 아이디어',tabs:['ER:strategy']},
  {label:'시장',tabs:['신규영업','병원 영업권·DB 가치']},
 ]},
 {title:'시장 3C',items:[
  {label:'경쟁사',tabs:['ER:information']},
  {label:'고객',tabs:['병원·고객사']},
  {label:'자사',tabs:['상황판','브랜드']},
 ]},
 {title:'세상 흐름',items:[
  {label:'기술',tabs:['ER:information']},
  {label:'정치',tabs:['ER:information']},
  {label:'경제',tabs:['ER:information']},
  {label:'사회',tabs:['ER:information']},
  {label:'문화',tabs:['ER:information']},
  {label:'역사',tabs:['ER:information']},
  {label:'종교',tabs:['ER:information']},
 ]},
 {title:'전통 경영',items:[
  {label:'인사',tabs:['ER:personnel','HR:people']},
  {label:'재무',tabs:['ER:finance','FM:control']},
  {label:'생산',tabs:['CA 생산 공장']},
  {label:'영업',tabs:['신규영업','병원 영업권·DB 가치','현장 워딩 연구','영업 주간회의']},
  {label:'마케팅',tabs:['CA 생산 공장','CA 주문·서비스']},
  {label:'브랜드',tabs:['브랜드']},
  {label:'법무',tabs:['ER:legal']},
 ]},
 {title:'경영 인사이트·잡탕밥',items:[
  {label:'우주관',tabs:['ER:direction','ER:strategy']},
  {label:'세계관',tabs:['ER:direction','ER:strategy']},
  {label:'기업관',tabs:['ER:direction','ER:strategy']},
  {label:'인생관',tabs:['ER:direction','ER:strategy']},
 ]},
] as const;
// Stable source indices preserve existing work bookmarks when perspectives move.
export const DO_EXPLORER_ORDER=[0,1,2,4,3,5] as const;
export function findExplorerItem(key:string){const [row,position]=key.split(':').map(Number);return Number.isInteger(row)&&Number.isInteger(position)?DO_EXPLORER_ROWS[row]?.items[position]:undefined}
