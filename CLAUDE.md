# Instruções do projeto para o Claude

Antes de trabalhar, leia `MEMORIA_COMPARTILHADA.md` e `CONTEXTO_GERAL.md` na raiz.
Eles contêm as decisões, os limites e o estado atual compartilhados com o Codex.
Ao concluir uma tarefa, atualize a memória compartilhada com decisões novas,
verificações realizadas e pendências. Atualize o contexto quando a arquitetura mudar.
Não duplique a memória neste arquivo. Releia o estado do Git antes de editar ou
commitar: outro agente pode ter trabalhado no mesmo diretório.

A memória local em `.claude/projects/.../memory` pode guardar referências, mas
decisões atuais deste projeto devem ficar na memória compartilhada versionada.
Instruções novas do Matheus prevalecem sobre registros históricos desses arquivos.

Para referências entre projetos, consulte o
[perfil APPWEB](../MEMORIA_COMPARTILHADA.md) e o
[catálogo de funcionalidades](../CATALOGO_FUNCIONALIDADES.md), quando disponíveis.
