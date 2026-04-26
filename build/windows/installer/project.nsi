Unicode true

####
## Please note: Template replacements don't work in this file. They are provided with default defines like
## mentioned underneath.
## If the keyword is not defined, "wails_tools.nsh" will populate them with the values from ProjectInfo.
## If they are defined here, "wails_tools.nsh" will not touch them. This allows to use this project.nsi manually
## from outside of Wails for debugging and development of the installer.
##
## For development first make a wails nsis build to populate the "wails_tools.nsh":
## > wails build --target windows/amd64 --nsis
## Then you can call makensis on this file with specifying the path to your binary:
## For a AMD64 only installer:
## > makensis -DARG_WAILS_AMD64_BINARY=..\..\bin\app.exe
## For a ARM64 only installer:
## > makensis -DARG_WAILS_ARM64_BINARY=..\..\bin\app.exe
## For a installer with both architectures:
## > makensis -DARG_WAILS_AMD64_BINARY=..\..\bin\app-amd64.exe -DARG_WAILS_ARM64_BINARY=..\..\bin\app-arm64.exe
####
## The following information is taken from the ProjectInfo file, but they can be overwritten here.
####
## !define INFO_PROJECTNAME    "MyProject" # Default "{{.Name}}"
## !define INFO_COMPANYNAME    "MyCompany" # Default "{{.Info.CompanyName}}"
## !define INFO_PRODUCTNAME    "MyProduct" # Default "{{.Info.ProductName}}"
## !define INFO_PRODUCTVERSION "1.0.0"     # Default "{{.Info.ProductVersion}}"
## !define INFO_COPYRIGHT      "Copyright" # Default "{{.Info.Copyright}}"
###
## !define PRODUCT_EXECUTABLE  "Application.exe"      # Default "${INFO_PROJECTNAME}.exe"
## !define UNINST_KEY_NAME     "UninstKeyInRegistry"  # Default "${INFO_COMPANYNAME}${INFO_PRODUCTNAME}"
####
## !define REQUEST_EXECUTION_LEVEL "admin"            # Default "admin"  see also https://nsis.sourceforge.io/Docs/Chapter4.html
####
## Include the wails tools
####
!define REQUEST_EXECUTION_LEVEL "user"

!include "wails_tools.nsh"

# The version information for this two must consist of 4 parts
VIProductVersion "${INFO_PRODUCTVERSION}.0"
VIFileVersion    "${INFO_PRODUCTVERSION}.0"

VIAddVersionKey "CompanyName"     "${INFO_COMPANYNAME}"
VIAddVersionKey "FileDescription" "${INFO_PRODUCTNAME} Installer"
VIAddVersionKey "ProductVersion"  "${INFO_PRODUCTVERSION}"
VIAddVersionKey "FileVersion"     "${INFO_PRODUCTVERSION}"
VIAddVersionKey "LegalCopyright"  "${INFO_COPYRIGHT}"
VIAddVersionKey "ProductName"     "${INFO_PRODUCTNAME}"

# Enable HiDPI support. https://nsis.sourceforge.io/Reference/ManifestDPIAware
ManifestDPIAware true

!include "MUI.nsh"

!define MUI_ICON "..\icon.ico"
!define MUI_UNICON "..\icon.ico"
# !define MUI_WELCOMEFINISHPAGE_BITMAP "resources\leftimage.bmp" #Include this to add a bitmap on the left side of the Welcome Page. Must be a size of 164x314
!define MUI_FINISHPAGE_NOAUTOCLOSE # Wait on the INSTFILES page so the user can take a look into the details of the installation steps
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXECUTABLE}"
!define MUI_FINISHPAGE_RUN_TEXT "Run ${INFO_PRODUCTNAME} now"
!define MUI_ABORTWARNING # This will warn the user if they exit from the installer.

!insertmacro MUI_PAGE_WELCOME # Welcome to the installer page.
# !insertmacro MUI_PAGE_LICENSE "resources\eula.txt" # Adds a EULA page to the installer
!insertmacro MUI_PAGE_DIRECTORY # In which folder install page.
!insertmacro MUI_PAGE_INSTFILES # Installing page.
!insertmacro MUI_PAGE_FINISH # Finished installation page.

!insertmacro MUI_UNPAGE_INSTFILES # Uinstalling page

!insertmacro MUI_LANGUAGE "English" # Set the Language of the installer

## The following two statements can be used to sign the installer and the uninstaller. The path to the binaries are provided in %1
#!uninstfinalize 'signtool --file "%1"'
#!finalize 'signtool --file "%1"'

Name "${INFO_PRODUCTNAME}"
OutFile "..\..\bin\${INFO_PROJECTNAME}-${ARCH}-installer.exe" # Name of the installer's file.
InstallDir "$LOCALAPPDATA\Programs\${INFO_PRODUCTNAME}" # Per-user install folder so the installer does not require elevation.
ShowInstDetails show # This will always show the installation details.

!define CLOSE_APP_MAX_RETRIES 15
!define CLOSE_APP_RECHECK_DELAY_MS 1000

Function EnsureAppCanBeUpdated
    SetDetailsPrint both
    DetailPrint "Checking whether ${INFO_PRODUCTNAME} is running"
    SetDetailsPrint listonly
    StrCpy $3 0

retry_check:
    nsExec::ExecToStack 'cmd /C tasklist /FI "IMAGENAME eq ${PRODUCT_EXECUTABLE}" /NH /FO CSV | findstr /I /B /C:"\"${PRODUCT_EXECUTABLE}\"," >nul'
    Pop $0
    Pop $1

    StrCmp $0 "0" app_running
    Goto done

app_running:

    IfSilent silent_running 0
    MessageBox MB_YESNOCANCEL|MB_ICONEXCLAMATION "${INFO_PRODUCTNAME} is currently running.$\r$\n$\r$\nYes: Close app now$\r$\nNo: I already closed it, retry check$\r$\nCancel: Exit installer" IDYES close_app IDNO retry_check
    Goto cancel_install

close_app:
    IntOp $3 $3 + 1
    SetDetailsPrint both
    DetailPrint "Attempt $3/${CLOSE_APP_MAX_RETRIES}: attempting to close ${INFO_PRODUCTNAME}"
    SetDetailsPrint listonly

    nsExec::ExecToLog 'taskkill /IM "${PRODUCT_EXECUTABLE}" /T'
    Pop $0

    nsExec::ExecToLog 'taskkill /F /IM "${PRODUCT_EXECUTABLE}" /T'
    Pop $0
    Sleep ${CLOSE_APP_RECHECK_DELAY_MS}

    IntCmp $3 ${CLOSE_APP_MAX_RETRIES} close_retry close_failed close_failed

close_retry:
    Goto retry_check

close_failed:
    IfSilent close_failed_silent 0
    MessageBox MB_RETRYCANCEL|MB_ICONSTOP "${INFO_PRODUCTNAME} could not be closed automatically after ${CLOSE_APP_MAX_RETRIES} attempts.$\r$\n$\r$\nClose it manually, then click Retry.$\r$\nClick Cancel to exit installer." IDRETRY retry_check
    Goto cancel_install

close_failed_silent:
    SetDetailsPrint both
    DetailPrint "${INFO_PRODUCTNAME} could not be closed automatically after ${CLOSE_APP_MAX_RETRIES} attempts."
    SetDetailsPrint listonly
    SetErrorLevel 75
    Abort

silent_running:
    SetDetailsPrint both
    DetailPrint "${INFO_PRODUCTNAME} is running. Silent install cannot continue."
    SetDetailsPrint listonly
    SetErrorLevel 73
    Abort

cancel_install:
    SetDetailsPrint both
    DetailPrint "Installation cancelled by user because ${INFO_PRODUCTNAME} is still running."
    SetDetailsPrint listonly
    SetErrorLevel 74
    Quit

done:
FunctionEnd

Function .onInit
    !insertmacro wails.checkArchitecture
    InitPluginsDir
    File /oname=$PLUGINSDIR\splash.bmp "resources\splash.bmp"
    Splash::show 2200 $PLUGINSDIR\splash.bmp
    Pop $0
FunctionEnd

Section
    !insertmacro wails.setShellContext

    Call EnsureAppCanBeUpdated

    !insertmacro wails.webview2runtime

    SetOutPath $INSTDIR

    !insertmacro wails.files

    CreateShortcut "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    CreateShortCut "$DESKTOP\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"

    !insertmacro wails.associateFiles
    !insertmacro wails.associateCustomProtocols

    WriteUninstaller "$INSTDIR\uninstall.exe"

    SetRegView 64
    WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${INFO_COMPANYNAME}"
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${INFO_PRODUCTNAME}"
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${INFO_PRODUCTVERSION}"
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
    WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"

    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Section "uninstall"
    !insertmacro wails.setShellContext

    RMDir /r "$AppData\${PRODUCT_EXECUTABLE}" # Remove the WebView2 DataPath

    RMDir /r $INSTDIR

    Delete "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk"
    Delete "$DESKTOP\${INFO_PRODUCTNAME}.lnk"

    !insertmacro wails.unassociateFiles
    !insertmacro wails.unassociateCustomProtocols

    Delete "$INSTDIR\uninstall.exe"

    SetRegView 64
    DeleteRegKey HKCU "${UNINST_KEY}"
SectionEnd
