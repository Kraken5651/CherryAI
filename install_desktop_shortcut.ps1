# Creates "Cherry AI" shortcut on the desktop (points directly to pythonw + run.py)
$ProjectRoot = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$Pythonw = Join-Path $ProjectRoot ".venv\Scripts\pythonw.exe"
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$RunPy = Join-Path $ProjectRoot "run.py"

if (-not (Test-Path $RunPy)) {
    Write-Error "run.py not found in $ProjectRoot"
    exit 1
}

$Exe = $Pythonw
if (-not (Test-Path $Exe)) {
    $Exe = $Python
}
if (-not (Test-Path $Exe)) {
    Write-Error "Python venv not found. Run: python -m venv .venv; pip install -r requirements.txt"
    exit 1
}

$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "Cherry AI.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Exe
$Shortcut.Arguments = "`"$RunPy`""
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.Description = "Cherry AI Assistant"
$Icon = Join-Path $ProjectRoot "assets\cherry.ico"
if (Test-Path $Icon) {
    $Shortcut.IconLocation = "$Icon,0"
}
$Shortcut.Save()

Write-Host "Desktop shortcut created:"
Write-Host "  $ShortcutPath"
Write-Host "  Target: $Exe"
Write-Host "  Args:   $RunPy"
