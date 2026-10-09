export function loginDestination(member:{role:string},mustChangePassword:boolean,next:string|null=null){
 if(mustChangePassword)return '/password';
 if(member.role!=='DO')return '/employee';
 return next==='/hr'?'/hr':'/';
}
