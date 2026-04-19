param(
    [int]$StartPort = 34115,
    [int]$EndPort = 35999,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$WailsArgs
)

if ($StartPort -lt 1024 -or $StartPort -gt 65535) {
    throw "StartPort must be between 1024 and 65535"
}

if ($EndPort -lt $StartPort -or $EndPort -gt 65535) {
    throw "EndPort must be between StartPort and 65535"
}

function Test-PortAvailable {
    param([int]$Port)

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($null -ne $listener) {
            $listener.Stop()
        }
    }
}

$candidatePorts = $StartPort..$EndPort | Sort-Object { Get-Random }
$selectedPort = $null

foreach ($port in $candidatePorts) {
    if (Test-PortAvailable -Port $port) {
        $selectedPort = $port
        break
    }
}

if ($null -eq $selectedPort) {
    throw "No available port found in range $StartPort-$EndPort"
}

$devServer = "127.0.0.1:$selectedPort"
Write-Host "Starting Wails dev server on $devServer" -ForegroundColor Cyan

& wails dev -devserver $devServer @WailsArgs
