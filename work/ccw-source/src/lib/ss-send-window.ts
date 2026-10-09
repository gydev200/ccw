export function inSendWindow(at=new Date()){const kst=new Date(at.getTime()+9*3600000);return kst.getUTCDay()!==0&&kst.getUTCHours()>=10&&kst.getUTCHours()<18;}
export const SEND_WINDOW_REASON='발송은 한국시간 월~토 10:00~18:00에 가능합니다.';
