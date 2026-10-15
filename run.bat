@echo off
chcp 65001 >nul
title Voice & Document Tools - أدوات الصوت والمستندات

echo ========================================================
echo   أدوات الصوت والمستندات - Voice & Document Tools
echo   تشغيل التطبيق محلياً بالكامل (100%% Local Engine)
echo ========================================================
echo.

cd /d "%~dp0"

:: التحقق من وجود Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطأ] لم يتم العثور على Node.js على جهازك!
    echo يرجى تثبيت Node.js من: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: التحقق من تثبيت الحزم node_modules
if not exist "node_modules\" (
    echo [1/2] جارٍ تثبيت الحزم والمكتبات المطلوبة...
    call npm install
    if %errorlevel% neq 0 (
        echo [خطأ] فشل تثبيت الحزم!
        pause
        exit /b 1
    )
) else (
    echo [✓] الحزم والمكتبات جاهزة.
)

echo [2/2] جارٍ بدء خادم التطبيق وفتح المتصفح...
echo.
echo الرابط: http://localhost:5173
echo اضغط Ctrl + C في أي وقت لإيقاف التطبيق.
echo ========================================================
echo.

call npm run dev -- --open

pause
