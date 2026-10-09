import 'server-only';
import { database, privateFiles } from './supabase-adapter';

// All credentials stay on the server. Nothing here is a NEXT_PUBLIC variable.
export const env={
  get DB():D1Database{return (process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY?database:undefined) as unknown as D1Database;},
  get FILES(){return privateFiles as unknown as R2Bucket;},
  get OWNER_EMAIL(){return process.env.OWNER_EMAIL;},
  get MAC_SERVER_TOKEN(){return process.env.MAC_SERVER_TOKEN;},
  get SS_DISPATCH_TOKEN(){return process.env.SS_DISPATCH_TOKEN;},
  get SS_REVIEW_KEY(){return process.env.SS_REVIEW_KEY;},
  get PW_REFERENCE_KEY(){return process.env.PW_REFERENCE_KEY;},
  get CCW_BOOTSTRAP_SECRET_HASH(){return process.env.CCW_BOOTSTRAP_SECRET_HASH;}
};
