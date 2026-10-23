# Para o escritório e o laço que o religa (ele roda oculto, sem janela).
# O filtro precisa ficar neste arquivo: escrito direto na linha de comando, o
# próprio PowerShell casaria com o filtro e se encerraria antes de terminar.
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like '*INICIAR ESCRITORIO.cmd*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Get-NetTCPConnection -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Host 'Escritório parado.'
