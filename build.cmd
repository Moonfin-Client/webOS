@echo off
setlocal enabledelayedexpansion
echo Building Moonfin for webOS...

:: Clean previous build
echo Cleaning previous build...
cmd /c npm run clean

:: Production build with Enact
echo Building with Enact...
cmd /c npm run pack -- -p

:: Copy banner
echo Copying banner...
xcopy resources\banner-dark.png dist\resources\ /Y

:: Remove non-English locales to reduce package size
echo Removing non-English locales due to size constraints...
pushd dist\node_modules\ilib\locale

for /d %%d in (*) do (
    if NOT "%%d" == "en" (
	if NOT "%%d" == "enm" (
        	echo Deleting %%d
        	REM rmdir /s /q "%%d"
	)
    )
)

popd

:: Package into IPK
echo Creating IPK package...
ares-package .\dist .\services -o .\build

:: Update manifest with version and hash
echo Updating manifest...
cmd /c node update-manifest.js

echo Build complete!
