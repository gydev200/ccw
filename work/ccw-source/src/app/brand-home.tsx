"use client";
export default function BrandHome({className="brand-home"}:{className?:string}){
 return <a href="/home" className={className} aria-label="차트클린 웍스 홈으로" title="홈으로" onClick={e=>{
  if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&document.querySelector('[data-dirty="true"]')&&!window.confirm('저장하지 않은 입력이 있습니다. 홈으로 이동하시겠습니까?'))e.preventDefault();
 }}><img src="/chartclean-works-wordmark.png" width="184" style={{maxWidth:'100%',height:'auto'}} alt="ChartClean Works"/></a>;
}
