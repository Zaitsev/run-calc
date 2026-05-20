#!/usr/bin/env pwsh
# Hook: run go vet after the agent edits a .go file.
# Invoked by the PostToolUse hook; receives hook JSON on stdin.
# Emits a systemMessage with go vet output if issues are found.

$input_json = $null
try {
    $raw = [Console]::In.ReadToEnd()
    $input_json = $raw | ConvertFrom-Json
} catch {
    exit 0
}

# Only act on file-edit tools targeting a Go source file
$tool = $input_json.tool_name
$file_edit_tools = @(
    'replace_string_in_file',
    'multi_replace_string_in_file',
    'create_file'
)
if ($tool -notin $file_edit_tools) { exit 0 }

# Extract the edited file path
$file_path = $input_json.tool_input.filePath
if (-not $file_path) { exit 0 }

if ($file_path -notmatch '\.go$') { exit 0 }

# Run go vet from the workspace root (the directory containing go.mod)
$repo_root = Split-Path -Parent $PSScriptRoot
Set-Location $repo_root
$result = & go vet ./... 2>&1
$exit_code = $LASTEXITCODE

if ($exit_code -ne 0) {
    $message = "go vet reported issues after editing $($file_path):`n``````n$($result -join "`n")`n``````"
    @{
        systemMessage = $message
    } | ConvertTo-Json -Compress
}

exit 0
