# Requirements Document

## Introduction

Este documento define os requisitos para corrigir os problemas críticos de sincronização multiplayer no jogo Urban Poly (Banco Imobiliário). O sistema atual sofre de falhas na detecção de novos jogadores, inconsistências de estado entre host e convidados, e dependência excessiva de polling em vez de comunicação em tempo real via WebSocket.

O objetivo é implementar um sistema robusto de identificação de jogadores, sincronização em tempo real via Socket.IO, e gerenciamento adequado de conexões/desconexões para garantir uma experiência multiplayer fluida e responsiva.

## Requirements

### Requirement 1: Sistema de Identificação Persistente de Jogadores

**User Story:** Como um jogador, eu quero ser reconhecido de forma única e persistente pelo sistema, para que eu possa reconectar à mesma partida mesmo após recarregar a página ou perder a conexão temporariamente.

#### Acceptance Criteria

1. WHEN um jogador acessa o jogo pela primeira vez THEN o sistema SHALL gerar um UUID único (v4) e armazená-lo no localStorage do navegador com a chave "urbanpoly_client_id"
2. WHEN um jogador cria ou entra em uma sala THEN o sistema SHALL enviar o UUID do cliente junto com o nickname na requisição
3. WHEN o servidor recebe uma requisição de criação/entrada em sala THEN o sistema SHALL criar um registro de jogador no banco de dados vinculando o clientId, roomId, nickname e socketId inicial como "pending"
4. WHEN o servidor cria um jogador THEN o sistema SHALL retornar o playerId real (não zero) na resposta da API REST
5. IF um jogador com o mesmo clientId já existe na sala THEN o sistema SHALL atualizar o registro existente em vez de criar um duplicado
6. WHEN um jogador reconecta via WebSocket THEN o sistema SHALL identificar o jogador pelo clientId e atualizar o socketId atual

### Requirement 2: Conexão WebSocket Baseada em Player ID Válido

**User Story:** Como desenvolvedor, eu quero que a conexão WebSocket seja estabelecida apenas quando houver um playerId válido, para garantir que todos os eventos de sincronização funcionem corretamente.

#### Acceptance Criteria

1. WHEN o componente de lobby ou jogo é montado THEN o sistema SHALL recuperar o playerId do sessionStorage
2. IF o playerId for inválido (0, null, undefined ou NaN) THEN o sistema SHALL impedir a inicialização do socket e exibir erro no console
3. WHEN o playerId é válido (número maior que 0) THEN o sistema SHALL inicializar a conexão Socket.IO
4. WHEN o socket conecta com sucesso THEN o sistema SHALL emitir o evento "join_room" com { code, playerId, clientId, nickname }
5. WHEN o servidor recebe "join_room" THEN o sistema SHALL validar que o playerId corresponde ao clientId e atualizar o socketId do jogador
6. IF a validação falhar THEN o sistema SHALL emitir evento "error" para o cliente com mensagem descritiva

### Requirement 3: Sincronização em Tempo Real de Jogadores no Lobby

**User Story:** Como um host, eu quero ver instantaneamente quando um novo jogador entra na sala, para que eu possa iniciar o jogo assim que todos estiverem prontos.

#### Acceptance Criteria

1. WHEN um jogador entra em uma sala via WebSocket THEN o servidor SHALL buscar a lista completa de jogadores atualizada do banco de dados
2. WHEN a lista de jogadores é obtida THEN o servidor SHALL emitir o evento "player_joined" para todos os sockets na sala (incluindo o remetente) com { player, players }
3. WHEN o cliente recebe "player_joined" THEN o sistema SHALL atualizar imediatamente o cache do React Query com a nova lista de jogadores
4. WHEN o cache é atualizado THEN a UI SHALL re-renderizar automaticamente mostrando o novo jogador com avatar e nickname
5. IF o polling REST ainda estiver ativo THEN o sistema SHALL manter o intervalo de 5 segundos como fallback, mas a atualização via WebSocket SHALL ter prioridade
6. WHEN múltiplos jogadores entram simultaneamente THEN o sistema SHALL processar cada entrada sequencialmente e emitir eventos separados

### Requirement 4: Gerenciamento de Desconexão e Limpeza de Estado

**User Story:** Como um jogador, eu quero que o sistema remova automaticamente jogadores desconectados do lobby, para que eu veja apenas quem está realmente online.

#### Acceptance Criteria

1. WHEN um socket desconecta THEN o servidor SHALL identificar o jogador associado ao socketId
2. IF um jogador é encontrado THEN o servidor SHALL atualizar o campo socketId para null no banco de dados
3. WHEN o socketId é atualizado THEN o servidor SHALL emitir o evento "player_disconnected" para todos na sala com { playerId, nickname }
4. WHEN o cliente recebe "player_disconnected" THEN o sistema SHALL atualizar o cache do React Query removendo ou marcando o jogador como offline
5. IF o jogador desconectado for o host THEN o sistema SHALL promover o próximo jogador (menor ID) a host e emitir "host_changed"
6. WHEN um jogador reconecta dentro de 60 segundos THEN o sistema SHALL restaurar o socketId e emitir "player_reconnected"
7. IF um jogador não reconecta em 60 segundos E o jogo não iniciou THEN o sistema SHALL remover o registro do jogador do banco de dados

### Requirement 5: Sincronização de Estado de Jogo em Tempo Real

**User Story:** Como um jogador, eu quero ver as ações de outros jogadores (rolar dados, comprar propriedades, etc.) instantaneamente, para que o jogo seja fluido e responsivo.

#### Acceptance Criteria

1. WHEN um jogador rola os dados THEN o servidor SHALL calcular a nova posição, atualizar o banco de dados e emitir "game_update" para todos na sala
2. WHEN um jogador compra uma propriedade THEN o servidor SHALL atualizar o dinheiro do jogador e o estado do tabuleiro atomicamente
3. WHEN qualquer ação de jogo ocorre THEN o servidor SHALL incluir o gameState completo no evento "game_update"
4. WHEN o cliente recebe "game_update" THEN o sistema SHALL atualizar o cache do React Query com o novo gameState
5. IF houver conflito entre polling e WebSocket THEN o sistema SHALL usar o timestamp mais recente ou priorizar WebSocket
6. WHEN o jogo termina THEN o servidor SHALL atualizar o status da sala para "finished" e emitir "game_ended" com { winnerId, finalState }

### Requirement 6: Constraint de Unicidade no Banco de Dados

**User Story:** Como desenvolvedor, eu quero garantir que não existam registros duplicados de jogadores, para manter a integridade dos dados e evitar bugs de sincronização.

#### Acceptance Criteria

1. WHEN a migração do banco de dados é executada THEN o sistema SHALL adicionar uma constraint UNIQUE na combinação (roomId, clientId) na tabela players
2. IF uma tentativa de inserção violar a constraint THEN o banco de dados SHALL rejeitar a operação com erro de violação de unicidade
3. WHEN o servidor detecta erro de unicidade THEN o sistema SHALL executar uma operação de UPDATE em vez de INSERT
4. WHEN um jogador é atualizado THEN o sistema SHALL preservar o playerId original e atualizar apenas socketId, nickname e outros campos mutáveis
5. WHEN uma sala é deletada THEN o sistema SHALL remover automaticamente todos os jogadores associados via CASCADE

### Requirement 7: Heartbeat e Detecção de Conexão Perdida

**User Story:** Como um jogador, eu quero que o sistema detecte automaticamente quando minha conexão cai, para que eu possa ser notificado e tentar reconectar.

#### Acceptance Criteria

1. WHEN o socket está conectado THEN o cliente SHALL enviar um evento "heartbeat" a cada 10 segundos
2. WHEN o servidor recebe "heartbeat" THEN o sistema SHALL atualizar o campo lastSeen do jogador com o timestamp atual
3. IF o servidor não recebe heartbeat de um jogador por 30 segundos THEN o sistema SHALL considerar o jogador como desconectado
4. WHEN o cliente detecta desconexão THEN o sistema SHALL exibir um toast de aviso e tentar reconectar automaticamente
5. WHEN a reconexão é bem-sucedida THEN o sistema SHALL re-emitir "join_room" e sincronizar o estado completo
6. IF a reconexão falha após 3 tentativas THEN o sistema SHALL redirecionar o jogador para a home com mensagem de erro

### Requirement 8: Validação e Tratamento de Erros

**User Story:** Como um jogador, eu quero receber mensagens claras quando algo dá errado, para que eu saiba como resolver o problema.

#### Acceptance Criteria

1. WHEN o servidor encontra um erro durante "join_room" THEN o sistema SHALL emitir evento "error" com { code, message, details }
2. WHEN o cliente recebe evento "error" THEN o sistema SHALL exibir um toast com a mensagem de erro traduzida
3. IF a sala não existe THEN o servidor SHALL retornar erro 404 com mensagem "Sala não encontrada"
4. IF a sala já está cheia (4 jogadores) THEN o servidor SHALL retornar erro 403 com mensagem "Sala cheia"
5. IF a sala já iniciou o jogo THEN o servidor SHALL retornar erro 403 com mensagem "Jogo já iniciado"
6. WHEN qualquer operação de banco de dados falha THEN o servidor SHALL logar o erro completo e retornar erro genérico 500 ao cliente
7. WHEN o cliente perde conexão durante o jogo THEN o sistema SHALL pausar as ações do jogador e exibir overlay de "Reconectando..."

### Requirement 9: Migração de Dados e Compatibilidade

**User Story:** Como desenvolvedor, eu quero migrar os dados existentes sem perder informações, para garantir uma transição suave para o novo sistema.

#### Acceptance Criteria

1. WHEN a migração é executada THEN o sistema SHALL adicionar a coluna clientId (text, nullable) na tabela players
2. WHEN a migração é executada THEN o sistema SHALL gerar UUIDs para todos os jogadores existentes que não possuem clientId
3. WHEN a migração é executada THEN o sistema SHALL adicionar índice na coluna clientId para otimizar buscas
4. WHEN a migração é executada THEN o sistema SHALL adicionar a constraint UNIQUE (roomId, clientId) após popular os dados
5. IF houver jogadores duplicados na mesma sala THEN a migração SHALL manter apenas o registro mais recente (maior ID) e deletar os demais
6. WHEN a migração é concluída THEN o sistema SHALL validar que todos os jogadores têm clientId não-nulo

### Requirement 10: Testes de Sincronização Multiplayer

**User Story:** Como desenvolvedor, eu quero testes automatizados que validem a sincronização multiplayer, para garantir que as correções funcionem e prevenir regressões.

#### Acceptance Criteria

1. WHEN os testes são executados THEN o sistema SHALL criar uma sala de teste e simular 2 jogadores conectando via WebSocket
2. WHEN o segundo jogador conecta THEN o teste SHALL verificar que o primeiro jogador recebe o evento "player_joined" em menos de 500ms
3. WHEN um jogador desconecta THEN o teste SHALL verificar que os outros jogadores recebem "player_disconnected"
4. WHEN um jogador rola os dados THEN o teste SHALL verificar que todos recebem "game_update" com o estado atualizado
5. WHEN um jogador reconecta com o mesmo clientId THEN o teste SHALL verificar que o playerId permanece o mesmo
6. IF qualquer teste falhar THEN o sistema SHALL exibir logs detalhados do estado do banco de dados e eventos emitidos
