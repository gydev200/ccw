import workMap from '@/lib/do-work-map.json';
import {fail,HttpError,json,member} from '@/lib/server';

export const dynamic='force-dynamic';

export async function GET(){try{
 const m=await member();
 if(m.role!=='DO')throw new HttpError(403,'대표 계정에서만 경영 업무 근거를 볼 수 있습니다.');
 return json(workMap);
}catch(error){return fail(error)}}
