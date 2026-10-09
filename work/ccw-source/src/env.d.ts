declare namespace Cloudflare { interface Env { DB:D1Database; OWNER_EMAIL:string; MAC_SERVER_TOKEN:string; FILES:R2Bucket; } }
declare namespace Cloudflare { interface Env { MODUSIGN_EMAIL?:string; MODUSIGN_API_KEY?:string; } }

declare namespace Cloudflare { interface Env { SOLAPI_API_KEY?: string; SOLAPI_API_SECRET?: string; SOLAPI_SENDER_PHONE?: string; } }
declare namespace Cloudflare { interface Env { SS_REVIEW_KEY?:string; SS_DISPATCH_TOKEN?:string; } }
