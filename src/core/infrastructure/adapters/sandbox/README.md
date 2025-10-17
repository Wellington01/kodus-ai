# Kodus Sandbox - Isolated Bash Command Execution

Sistema seguro para execução de comandos bash em ambiente isolado, com controle por cliente, timeouts e limites de recursos.

## 🎯 Características

### Segurança

- ✅ **Isolamento por Cliente**: Cada cliente só acessa suas próprias execuções
- ✅ **Validação de Comandos**: Bloqueio de comandos perigosos (rm -rf /, fork bombs, etc)
- ✅ **Sanitização**: Validação de caracteres especiais e padrões perigosos
- ✅ **Limites de Recursos**: Timeout, max output size, max concurrent executions
- ✅ **Ambiente Controlado**: Limpeza de variáveis perigosas (LD_PRELOAD, etc)

### Performance

- ✅ **Timeout Configurável**: De 1s até 5 minutos
- ✅ **Execuções Concorrentes**: Até 10 por cliente
- ✅ **Limite de Output**: 1MB máximo
- ✅ **Histórico**: Mantém últimas 1000 execuções

### Observabilidade

- ✅ **Logging Estruturado**: Todos os eventos são logados
- ✅ **Rastreamento**: ID único por execução
- ✅ **Métricas**: Status, duração, exit codes

## 📦 Instalação

### 1. Adicionar ao App Module

```typescript
// src/app.module.ts
import { SandboxModule } from './core/infrastructure/adapters/sandbox/sandbox.module';

@Module({
    imports: [
        // ... outros módulos
        SandboxModule,
    ],
})
export class AppModule {}
```

### 2. Configurar Environment (opcional)

```bash
# .env
SANDBOX_MAX_TIMEOUT=300000
SANDBOX_DEFAULT_TIMEOUT=30000
SANDBOX_MAX_CONCURRENT=10
SANDBOX_MAX_OUTPUT_SIZE=1048576
```

## 🚀 Uso

### Endpoints Disponíveis

#### 1. Executar Comando

**POST** `/sandbox/execute`

**Headers:**

```
x-client-id: client-uuid
x-organization-id: org-uuid
x-user-id: user-uuid (opcional)
x-team-id: team-uuid (opcional)
```

**Body:**

```json
{
    "command": "ls -la",
    "workingDirectory": "/tmp/workspace",
    "environment": {
        "NODE_ENV": "development",
        "DEBUG": "true"
    },
    "timeout": 30000
}
```

**Response:**

```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "stdout": "total 48\ndrwxr-xr-x...",
    "stderr": "",
    "exitCode": 0,
    "duration": 125
}
```

#### 2. Obter Detalhes de Execução

**GET** `/sandbox/executions/:executionId`

**Response:**

```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "stdout": "...",
    "stderr": "",
    "exitCode": 0,
    "duration": 125
}
```

#### 3. Cancelar Execução

**DELETE** `/sandbox/executions/:executionId`

**Response:** `204 No Content`

#### 4. Listar Execuções

**GET** `/sandbox/executions?status=active&limit=50`

**Response:**

```json
[
    {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "status": "running",
        "duration": null
    },
    {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "status": "completed",
        "exitCode": 0,
        "duration": 1250
    }
]
```

#### 5. Health Check

**GET** `/sandbox/health`

**Response:**

```json
{
    "status": "healthy",
    "activeExecutions": 3
}
```

## 🔒 Segurança

### Comandos Bloqueados

Os seguintes comandos/padrões são automaticamente bloqueados:

```bash
rm -rf /           # Deleção recursiva do root
mkfs               # Formatação de disco
dd                 # Escrita direta em disco
:(){ :|:& };:      # Fork bomb
wget, curl         # Download de arquivos
ssh, scp, ftp      # Conexões remotas
eval, exec         # Execução dinâmica
```

### Validação de Input

- ✅ Caracteres especiais perigosos: `;`, `|`, `&`, `$`, `` ` ``, `<`, `>`, `\`
- ✅ Padrões regex para fork bombs e exploits
- ✅ Limite de tamanho do comando

### Isolamento

Cada cliente é isolado através de:

- **Client ID**: Identificador único
- **Organization ID**: Contexto organizacional
- **Namespace de Execuções**: Histórico separado por cliente

## 📊 Status de Execução

| Status      | Descrição               |
| ----------- | ----------------------- |
| `pending`   | Aguardando início       |
| `running`   | Em execução             |
| `completed` | Concluído com sucesso   |
| `failed`    | Falhou (exit code != 0) |
| `timeout`   | Excedeu tempo limite    |
| `cancelled` | Cancelado pelo cliente  |

## 🎨 Exemplos de Uso

### Exemplo 1: Listar Arquivos

```bash
curl -X POST http://localhost:3000/sandbox/execute \
  -H "Content-Type: application/json" \
  -H "x-client-id: client-123" \
  -H "x-organization-id: org-456" \
  -d '{
    "command": "ls -la /tmp",
    "timeout": 5000
  }'
```

### Exemplo 2: Executar Script Node.js

```bash
curl -X POST http://localhost:3000/sandbox/execute \
  -H "Content-Type: application/json" \
  -H "x-client-id: client-123" \
  -H "x-organization-id: org-456" \
  -d '{
    "command": "node -e \"console.log(process.version)\"",
    "environment": {
      "NODE_ENV": "production"
    },
    "timeout": 10000
  }'
```

### Exemplo 3: Git Clone

```bash
curl -X POST http://localhost:3000/sandbox/execute \
  -H "Content-Type: application/json" \
  -H "x-client-id: client-123" \
  -H "x-organization-id: org-456" \
  -d '{
    "command": "git clone https://github.com/user/repo.git",
    "workingDirectory": "/tmp/workspace",
    "timeout": 60000
  }'
```

### Exemplo 4: Pipeline de Comandos

```bash
curl -X POST http://localhost:3000/sandbox/execute \
  -H "Content-Type: application/json" \
  -H "x-client-id: client-123" \
  -H "x-organization-id: org-456" \
  -d '{
    "command": "echo hello | tr a-z A-Z",
    "timeout": 5000
  }'
```

## ⚙️ Configuração Avançada

### Customizar Limites

```typescript
// sandbox-executor.service.ts
private readonly config: SandboxConfig = {
    maxTimeout: 600000,              // 10 minutos
    defaultTimeout: 30000,           // 30 segundos
    maxConcurrentExecutions: 20,     // 20 por cliente
    maxOutputSize: 2 * 1024 * 1024, // 2MB
    blockedCommands: [
        // Adicione seus comandos bloqueados
        'custom-dangerous-cmd',
    ],
};
```

### Adicionar Comando Permitido

Se você tem uma whitelist de comandos permitidos:

```typescript
private readonly config: SandboxConfig = {
    // ...
    allowedCommands: [
        'ls', 'cat', 'grep', 'echo', 'node', 'npm', 'git',
    ],
};

// No método validateCommand:
if (this.config.allowedCommands) {
    const firstWord = command.split(' ')[0];
    if (!this.config.allowedCommands.includes(firstWord)) {
        throw new Error(`Command not in allowed list: ${firstWord}`);
    }
}
```

## 🐛 Tratamento de Erros

### Tipos de Erro

```typescript
// Comando bloqueado
{
  "statusCode": 400,
  "message": "Command contains blocked pattern: rm -rf /"
}

// Limite de execuções concorrentes
{
  "statusCode": 429,
  "message": "Maximum concurrent executions (10) reached for client"
}

// Timeout
{
  "id": "...",
  "status": "timeout",
  "error": "Command timed out after 30000ms",
  "stderr": "...",
  "stdout": "..."
}

// Cliente não autorizado
{
  "statusCode": 401,
  "message": "Client ID and Organization ID are required"
}
```

## 📈 Monitoramento

### Métricas Importantes

- **Active Executions**: Número de execuções em andamento
- **Execution Duration**: Tempo médio de execução
- **Success Rate**: Taxa de sucesso (completed / total)
- **Timeout Rate**: Taxa de timeouts
- **Client Usage**: Execuções por cliente

### Logs

Todos os eventos são logados com contexto:

```json
{
    "message": "Starting sandbox command execution",
    "context": "SandboxExecutorService",
    "metadata": {
        "executionId": "550e8400-e29b-41d4-a716-446655440000",
        "clientId": "client-123",
        "command": "ls -la",
        "workingDirectory": "/tmp"
    }
}
```

## 🔐 Boas Práticas

### 1. Use Timeouts Apropriados

```typescript
// Para comandos rápidos
{
    timeout: 5000;
} // 5 segundos

// Para operações de rede
{
    timeout: 60000;
} // 1 minuto

// Para operações longas
{
    timeout: 300000;
} // 5 minutos (máximo)
```

### 2. Limite o Escopo dos Comandos

```typescript
{
  "command": "ls src/",  // ✅ Específico
  "workingDirectory": "/app/project"
}

// Evite:
{
  "command": "find / -name *" // ❌ Muito amplo
}
```

### 3. Valide Inputs do Cliente

```typescript
// No seu código
if (userInput.includes('..')) {
    throw new Error('Path traversal not allowed');
}
```

### 4. Use Variáveis de Ambiente para Sensível

```typescript
{
  "command": "npm publish",
  "environment": {
    "NPM_TOKEN": process.env.NPM_TOKEN  // Não hardcode
  }
}
```

## 🚨 Limitações

- ⚠️ Não suporta comandos interativos (stdin)
- ⚠️ Output limitado a 1MB por padrão
- ⚠️ Timeout máximo de 5 minutos
- ⚠️ Sem suporte a pseudo-TTY
- ⚠️ Execução em processo Node.js (não container isolado)

## 🔄 Roadmap

- [ ] Suporte a Docker containers
- [ ] Streaming de output para comandos longos
- [ ] WebSocket para execuções em tempo real
- [ ] Rate limiting por cliente
- [ ] Persistência de histórico em banco de dados
- [ ] Métricas Prometheus
- [ ] Dashboard de monitoramento

## 📝 Licença

Propriedade do Kodus - Uso interno apenas.
