import {env} from '@/lib/runtime';
import {clinicBilling} from './handler';
export const dynamic='force-dynamic';
const handle=(req:Request)=>{const settings=env as unknown as Record<string,string>;return clinicBilling(req,{secret:settings.CLINIC_BILLING_SECRET,organizations:settings.CLINIC_BILLING_ORG_MAP})};
export const GET=handle;
export const POST=handle;
