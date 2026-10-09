using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

static class Program {
 const string Endpoint="https://chartclean-erp-v1.happyshs747.chatgpt.site/api/remote-access";
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
 static string Job(string name) { var m=Regex.Match(name,@"^chenggyo-setup-([a-f0-9]{64})(?: \([0-9]+\))?\.exe$",RegexOptions.IgnoreCase); if(!m.Success)throw new Exception("웹 설치 페이지에서 설정 파일을 다시 받아 주세요.");return m.Groups[1].Value.ToLowerInvariant(); }
 static Dictionary<string,object> Request(object body) {
  var req=(HttpWebRequest)WebRequest.Create(Endpoint);req.Method="POST";req.ContentType="application/json; charset=utf-8";req.AllowAutoRedirect=false;req.Timeout=30000;req.ReadWriteTimeout=30000;
  byte[] bytes=Encoding.UTF8.GetBytes(Json.Serialize(body));req.ContentLength=bytes.Length;using(var s=req.GetRequestStream())s.Write(bytes,0,bytes.Length);
  try {using(var res=(HttpWebResponse)req.GetResponse())using(var reader=new StreamReader(res.GetResponseStream()))return Json.Deserialize<Dictionary<string,object>>(reader.ReadToEnd());}
  catch(WebException e){if(e.Response!=null)using(var reader=new StreamReader(e.Response.GetResponseStream())){var error=Json.Deserialize<Dictionary<string,object>>(reader.ReadToEnd());if(error.ContainsKey("error"))throw new Exception(Convert.ToString(error["error"]));}throw new Exception("챙겨 서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 이 파일을 다시 실행해 주세요.");}
 }
 static string Run(string exe,string args) {
  using(var p=new Process()){p.StartInfo=new ProcessStartInfo(exe,args){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};p.Start();var output=p.StandardOutput.ReadToEndAsync();var error=p.StandardError.ReadToEndAsync();if(!p.WaitForExit(30000)){try{p.Kill();}catch{}throw new Exception("RustDesk가 응답하지 않습니다. PC를 재시작하고 다시 실행해 주세요.");}Task.WaitAll(output,error);if(p.ExitCode!=0)throw new Exception("RustDesk 설정에 실패했습니다. 오류 번호: "+p.ExitCode);return output.Result;}
 }
 static string Find(){foreach(var folder in new[]{Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)}){var path=Path.Combine(folder,"RustDesk","rustdesk.exe");if(File.Exists(path))return path;}throw new Exception("RustDesk 설치 파일(MSI)을 먼저 실행해 주세요.");}
 [STAThread] static int Main(string[] args){
  if(args.Length==1&&args[0]=="--self-test"){try{var t=new string('a',64);if(Job("chenggyo-setup-"+t+" (2).exe")!=t) return 1;try{Job("wrong.exe");return 2;}catch{}return 0;}catch{return 3;}}
  Application.EnableVisualStyles();ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
  try {var token=Job(Path.GetFileName(Application.ExecutablePath));var exe=Find();var job=Request(new{action="helper-open",jobToken=token});var hospital=Convert.ToString(job["hospital"]);if(job.ContainsKey("completedId")){MessageBox.Show(hospital+" 원격 설정과 접수를 이미 마쳤습니다.\n접속 번호: "+Convert.ToString(job["completedId"]),"챙겨 원격 설정");return 0;}var pw=Convert.ToString(job["password"]);
   if(!Regex.IsMatch(pw,@"^[A-Za-z0-9!@#$%^&*_+=.?-]{12,64}$"))throw new Exception("비밀번호 정보를 받지 못했습니다. 웹에서 설정 파일을 다시 받아 주세요.");
   if(MessageBox.Show(hospital+" PC에 웹에서 입력한 영구 비밀번호를 설정합니다.","챙겨 원격 설정",MessageBoxButtons.OKCancel,MessageBoxIcon.Information)!=DialogResult.OK)return 0;
   Run(exe,"--password "+pw);Run(exe,"--option verification-method use-permanent-password");Run(exe,"--option approve-mode password");string id="";for(int i=0;i<10;i++){var m=Regex.Match(Run(exe,"--get-id"),@"\b[0-9]{6,20}\b");if(m.Success){id=m.Value;break;}System.Threading.Thread.Sleep(2000);}if(id=="")throw new Exception("접속 번호를 받지 못했습니다. 이 파일을 다시 실행해 주세요.");
   var receipt=Request(new{action="helper-complete",jobToken=token,id=id});pw=null;if(!receipt.ContainsKey("saved")||!Convert.ToBoolean(receipt["saved"]))throw new Exception("챙겨에서 접수를 확인하지 못했습니다. 이 파일을 다시 실행해 주세요.");MessageBox.Show(hospital+" 원격 설정이 끝났습니다.\n접속 번호: "+id+"\n받은 설정 파일은 삭제해 주세요.","챙겨 원격 설정",MessageBoxButtons.OK,MessageBoxIcon.Information);return 0;
  }catch(Exception e){MessageBox.Show(e.Message,"챙겨 원격 설정",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}
 }
}
