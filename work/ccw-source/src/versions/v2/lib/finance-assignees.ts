// Retain historical roster entries for journals; stop new work assignments only.
export function unavailableFinancePeople(members:readonly {person:string;active:number}[]){
 const inactive=new Set<string>(),active=new Set<string>();
 for(const m of members){
  const person=m.person.split(':disabled:')[0];
  (m.active===1&&!m.person.includes(':disabled:')?active:inactive).add(person);
 }
 return new Set([...inactive].filter(person=>!active.has(person)));
}
