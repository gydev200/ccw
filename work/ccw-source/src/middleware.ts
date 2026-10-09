import {NextResponse} from 'next/server';
export function middleware(req:Request){const p=new URL(req.url).pathname;if(p==='/s1'||p.startsWith('/s1/')||p==='/api/s1'||p.startsWith('/api/s1/')||p.startsWith('/s1-before-emr'))return new Response('해당 자료 경로는 사용 중지 상태입니다.',{status:503,headers:{'Cache-Control':'no-store'}});const requestHeaders=new Headers(req.headers);requestHeaders.set('x-ccw-method',req.method);return NextResponse.next({request:{headers:requestHeaders}})}
export const config={matcher:['/api/:path*','/s1/:path*','/s1-before-emr/:path*']};
