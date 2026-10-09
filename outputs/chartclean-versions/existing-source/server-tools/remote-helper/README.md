# 챙겨 원격 설정

웹에서 받은 파일을 실행하면 해당 병원에 입력한 영구 비밀번호를 RustDesk에 적용하고 접속 번호를 챙겨에 보냅니다. CMD와 PowerShell은 사용하지 않습니다. RustDesk 공식 MSI는 먼저 설치해야 합니다.

## 현재 상태

실행 파일 빌드와 파일명 검증 테스트를 마쳤습니다. 실제 병원 PC의 비밀번호 적용, 서버 접수, Smart App Control 허용 여부는 아직 검증하지 않았습니다. 제공된 EXE는 서명되지 않은 개발용 파일이며 실제 배포 파일이 아닙니다. 현재 웹사이트에는 배포하지 않았습니다.

## 배포 조건

1. 회사 코드 서명 인증서 또는 서명 서비스를 준비합니다.
2. Program.cs를 app.manifest와 함께 .NET Framework 컴파일러로 빌드하고 EXE에 서명 및 타임스탬프를 적용합니다.
3. 서명 유효성을 확인한 파일만 public/downloads/chenggyo-setup.exe에 넣습니다. 비밀번호나 병원별 정보를 EXE에 추가하지 않습니다. 다운로드 파일명에 설정용 식별자를 붙여도 파일 본문과 서명은 유지됩니다.
4. 별도 테스트 PC에서 웹 비밀번호 → EXE 실행 → RustDesk 영구 비밀번호 접속 → 해당 병원 접수까지 검증합니다. Smart App Control이 켜진 PC에서도 검증합니다. 서명만으로 모든 Windows 경고가 없어지는 것은 아닙니다.
5. 변경한 API와 설치 페이지, 서명된 EXE를 함께 배포합니다.

## 보관과 권한

설정 식별자는 1시간 뒤 만료됩니다. 접속 비밀번호는 기존 서버 암호화 방식으로 보관하며 EXE 본문이나 파일명에 넣지 않습니다. 설정 파일을 가진 사람은 만료 전 설정 정보를 받을 수 있으므로 공유하지 않습니다. 설정 완료 뒤 작업에 저장된 비밀번호를 제거합니다. 서버 접수 실패 시 완료로 표시하지 않습니다. 서버 접수 요청은 재시도할 수 있습니다.

RustDesk CLI의 --password 인자는 실행 중 프로세스 정보를 볼 수 있는 관리자에게 잠시 노출될 수 있습니다. 프로그램은 비밀번호를 화면이나 로그에 표시하지 않습니다. 관리자 승인은 Windows UAC에서 사용자가 직접 합니다. Windows 보안 설정은 변경하지 않습니다.

## 빌드

Framework64/v4.0.30319/csc.exe /target:winexe /out:chenggyo-setup.exe /win32manifest:app.manifest /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll Program.cs

--self-test는 파일명 파싱만 검증하며 비밀번호 설정이나 네트워크 요청을 실행하지 않습니다.
