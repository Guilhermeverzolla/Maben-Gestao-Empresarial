' Liga o escritorio sem nenhuma janela de CMD. O laco que religa o node
' continua rodando escondido; para parar, encerre o "node.exe" no Gerenciador
' de Tarefas (ou rode PARAR ESCRITORIO.cmd).
Set sh = CreateObject("WScript.Shell")
pasta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = pasta
sh.Run "cmd /c """"" & pasta & "\INICIAR ESCRITORIO.cmd"" oculto""", 0, False
