$Project = "C:\Users\joajo\AndroidStudioProjects\ima2-gen-custom"
Set-Location $Project

# global ima2-gen 안의 progrok 사용
$progrok = Join-Path (npm root -g) "ima2-gen\node_modules\.bin\progrok.cmd"

if (!(Test-Path $progrok)) {
  Write-Host "global progrok.cmd를 찾을 수 없습니다." -ForegroundColor Red
  Write-Host "먼저 아래 명령을 실행하세요:"
  Write-Host "npm install -g ima2-gen" -ForegroundColor Yellow
  Read-Host "Enter를 누르면 종료합니다"
  exit 1
}

function Stop-ListenPort($Port) {
  $owners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($ownerPid in $owners) {
    if ($ownerPid -and $ownerPid -ne $PID) {
      try {
        Stop-Process -Id $ownerPid -Force -ErrorAction Stop
        Write-Host "기존 포트 $Port 프로세스 종료: PID $ownerPid"
      } catch {
        Write-Host "포트 $Port 프로세스 종료 실패: PID $ownerPid" -ForegroundColor Yellow
      }
    }
  }
}

Write-Host ""
Write-Host "사용할 progrok 경로:" -ForegroundColor Cyan
Write-Host $progrok

Write-Host ""
Write-Host "현재 Grok 로그인 상태:" -ForegroundColor Cyan
& $progrok status

Write-Host ""
$change = Read-Host "Grok 계정을 로그아웃 후 새로 로그인할까요? 바꾸려면 y, 그대로 쓰려면 Enter"

if ($change -match "^(y|Y|yes|YES|예)$") {
  Write-Host ""
  Write-Host "Grok 로그아웃 중..." -ForegroundColor Cyan
  & $progrok logout

  Write-Host ""
  Write-Host "새 Grok 계정 로그인 시작..." -ForegroundColor Cyan
  Write-Host "브라우저는 InPrivate/시크릿 창을 추천합니다." -ForegroundColor Yellow

  # 요청한 로그인 방식
  & $progrok login

  Write-Host ""
  Write-Host "로그인 후 상태 확인:" -ForegroundColor Cyan
  & $progrok status
}

Write-Host ""
Write-Host "기존 18645, 3333 포트 정리 중..." -ForegroundColor Cyan
Stop-ListenPort 18645
Stop-ListenPort 3333

Write-Host ""
Write-Host "Grok 프록시를 백그라운드로 실행합니다..." -ForegroundColor Cyan

$argLine = "/c `"$progrok`" proxy --host 127.0.0.1 --port 18645"
$progrokProc = Start-Process -FilePath "cmd.exe" -ArgumentList $argLine -WindowStyle Hidden -PassThru

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  $conn = Get-NetTCPConnection -LocalPort 18645 -State Listen -ErrorAction SilentlyContinue
  if ($conn) {
    $ready = $true
    break
  }
}

if (!$ready) {
  Write-Host ""
  Write-Host "Grok 프록시 18645 포트가 열리지 않았습니다." -ForegroundColor Red
  Write-Host "아래 명령으로 직접 확인해보세요:" -ForegroundColor Yellow
  Write-Host "& `"$progrok`" status"
  Write-Host "& `"$progrok`" proxy --host 127.0.0.1 --port 18645"
  Read-Host "Enter를 누르면 종료합니다"
  exit 1
}

Write-Host "Grok 프록시 준비 완료: http://127.0.0.1:18645/v1" -ForegroundColor Green

$env:IMA2_HOST="0.0.0.0"
$env:IMA2_MAX_REF_B64_BYTES="15728640"
$env:IMA2_BODY_LIMIT="100mb"

$env:IMA2_NO_GROK_PROXY="1"
$env:IMA2_GROK_PROXY_HOST="127.0.0.1"
$env:IMA2_GROK_PROXY_PORT="18645"

Write-Host ""
Write-Host "웹앱을 실행합니다." -ForegroundColor Cyan
Write-Host "PC 접속: http://localhost:3333"
Write-Host "태블릿 접속: http://192.168.219.105:3333"
Write-Host ""
Write-Host "종료하려면 이 창에서 Ctrl + C" -ForegroundColor Yellow
Write-Host ""

try {
  npm start
} finally {
  Write-Host ""
  Write-Host "Grok 프록시 정리 중..." -ForegroundColor Cyan
  Stop-ListenPort 18645
}
