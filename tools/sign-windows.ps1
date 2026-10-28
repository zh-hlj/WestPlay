# Signs a binary with the preview's own certificate (CN=WestPlay CN Streaming Preview), made by CI before the
# build. Tauri calls this (bundle.windows.signCommand) for the app's binary before the installer embeds it, and for
# the installers: a signature made earlier is invalid once the bundler changes the file (HashMismatch, preview 7).
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Path
)
$ErrorActionPreference = 'Stop'
$cert = Get-ChildItem Cert:\CurrentUser\My |
  Where-Object { $_.Subject -eq 'CN=WestPlay CN Streaming Preview' } |
  Select-Object -First 1
if (-not $cert) {
  throw 'the preview signing certificate is not in Cert:\CurrentUser\My'
}
$full = [IO.Path]::GetFullPath($Path)
if (-not (Test-Path -LiteralPath $full)) {
  throw "not a file to sign: $full"
}
$signature = Set-AuthenticodeSignature -FilePath $full -Certificate $cert -HashAlgorithm SHA256
if (-not $signature.SignerCertificate) {
  throw "signing failed: $($signature.StatusMessage)"
}
Write-Host "signed $([IO.Path]::GetFileName($full)): $($signature.Status)"
