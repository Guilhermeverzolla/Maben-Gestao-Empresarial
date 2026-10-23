# Atalho da área de trabalho: se o escritório não estiver no ar, liga o
# supervisor (solto, sem janela, para o Ctrl+C de nenhum terminal derrubar)
# e abre o escritório no navegador.
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://localhost:4321'

function NoAr {
  try { (Invoke-WebRequest "$url/" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { $false }
}

if (-not (NoAr)) {
  $vbs = Join-Path $pasta 'ESCRITORIO OCULTO.vbs'
  Start-Process wscript.exe -ArgumentList ('"' + $vbs + '"') -WorkingDirectory $pasta -WindowStyle Hidden
  for ($i = 0; $i -lt 40 -and -not (NoAr); $i++) { Start-Sleep -Milliseconds 750 }
}

Start-Process $url
