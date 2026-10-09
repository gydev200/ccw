export function loginDestination(member:{role:string;workspaceVersion?:string},mustChangePassword:boolean,next:string|null=null){
 if(mustChangePassword)return '/password';
 if(member.workspaceVersion==='v2')return '/v2';
 if(member.role!=='DO')return '/employee';
 return next==='/hr'?'/hr':'/';
}
