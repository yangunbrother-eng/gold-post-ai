@echo off
chcp 65001 >nul
cd /d D:\gold
echo ==========================================
echo  당근 Post AI 켜는 중입니다...
echo  이 검은 창을 닫지 마세요.
echo  (사용이 끝나면 이 창을 X로 닫으세요)
echo ==========================================
start "" cmd /c "timeout /t 15 /nobreak >nul & start http://localhost:3000"
cmd /c "npm run dev"
pause
