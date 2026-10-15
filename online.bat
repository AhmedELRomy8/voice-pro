@echo off
chcp 65001 >nul
title Voice & Document Tools - البث أونلاين عبر HTTPS

echo ========================================================
echo   أدوات الصوت والمستندات - Voice & Document Tools
echo   تشغيل التطبيق أونلاين على رابط مباشر مجاني (HTTPS)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] بناء النسخة النهائية (Production Build)...
call npm run build

echo.
echo [2/2] تشغيل السيرفر وفتح نفق HTTPS المباشر عبر Cloudflare...
start /b npx vite preview --port 4173

timeout /t 3 >nul

echo.
echo ========================================================
echo   الرابط المباشر الآن:
echo   https://treat-immigration-villas-teach.trycloudflare.com
echo ========================================================
echo.

"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:4173

pause
