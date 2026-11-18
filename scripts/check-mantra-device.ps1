$ErrorActionPreference = "Continue"

Write-Host "Checking Windows for Mantra/MELO31 fingerprint device..."
Write-Host ""

try {
  $devices = Get-PnpDevice -ErrorAction Stop |
    Where-Object {
      $_.FriendlyName -match "Mantra|MELO|Morfin|MFS|Fingerprint|Biometric" -or
      $_.InstanceId -match "Mantra|MELO|Morfin|MFS"
    } |
    Select-Object Status, Class, FriendlyName, InstanceId

  if ($devices) {
    $devices | Format-Table -AutoSize
  } else {
    Write-Warning "No Mantra/MELO/fingerprint device was found by Get-PnpDevice."
  }
} catch {
  Write-Warning "Could not query Plug and Play devices: $($_.Exception.Message)"
  Write-Host "Run this script from an Administrator PowerShell window for the device list."
}

Write-Host ""
Write-Host "Checking likely Mantra/Morfin/MELO services..."

$services = Get-Service |
  Where-Object {
    $_.Name -match "Mantra|Morfin|MFS|MELO" -or
    $_.DisplayName -match "Mantra|Morfin|MFS|MELO"
  } |
  Select-Object Status, Name, DisplayName

if ($services) {
  $services | Format-Table -AutoSize
} else {
  Write-Warning "No likely Mantra/Morfin/MELO services were found."
}

Write-Host ""
Write-Host "Bridge configuration from .env:"
Get-Content .env |
  Where-Object {
    $_ -match "FINGERPRINT_BRIDGE_API|FINGERPRINT_MOCK_ENABLED|MANTRA_BRIDGE_PROVIDER|MANTRA_CAPTURE_COMMAND|MANTRA_MATCH_COMMAND"
  }
