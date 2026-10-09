import {member} from '@/lib/server';
import {loginDestination} from '@/lib/login-destination';
export async function GET(req:Request){
 let target='/login';
 try{const m=await member(true);target=loginDestination(m,!!m.mustChangePassword)}catch{}
 return new Response(null,{status:303,headers:{Location:new URL(target,req.url).href,'Cache-Control':'no-store'}});
}
