/**
 * Exemplos de uso do Kodus Sandbox
 *
 * Este arquivo demonstra como usar o serviço de sandbox
 * tanto via HTTP quanto programaticamente
 */

import { SandboxExecutorService } from '../services/sandbox-executor.service';

// ==========================================
// EXEMPLO 1: Uso via HTTP (curl)
// ==========================================

/*
# Executar comando simples
curl -X POST http://localhost:3000/sandbox/execute \
  -H "Content-Type: application/json" \
  -H "x-client-id: my-client-123" \
  -H "x-organization-id: org-456" \
  -d '{
    "command": "echo 'Hello from Sandbox!'",
    "timeout": 5000
  }'

# Listar arquivos em diretório específico
curl -X POST http://localhost:3000/sandbox/execute \
  -H "Content-Type: application/json" \
  -H "x-client-id: my-client-123" \
  -H "x-organization-id: org-456" \
  -d '{
    "command": "ls -la",
    "workingDirectory": "/tmp",
    "timeout": 10000
  }'

# Executar com variáveis de ambiente
curl -X POST http://localhost:3000/sandbox/execute \
  -H "Content-Type: application/json" \
  -H "x-client-id: my-client-123" \
  -H "x-organization-id: org-456" \
  -d '{
    "command": "echo $MY_VAR",
    "environment": {
      "MY_VAR": "Custom Value"
    },
    "timeout": 5000
  }'

# Obter status de execução
curl -X GET http://localhost:3000/sandbox/executions/550e8400-e29b-41d4-a716-446655440000 \
  -H "x-client-id: my-client-123" \
  -H "x-organization-id: org-456"

# Listar todas as execuções
curl -X GET "http://localhost:3000/sandbox/executions?limit=10" \
  -H "x-client-id: my-client-123" \
  -H "x-organization-id: org-456"

# Listar apenas execuções ativas
curl -X GET "http://localhost:3000/sandbox/executions?status=active" \
  -H "x-client-id: my-client-123" \
  -H "x-organization-id: org-456"

# Cancelar execução
curl -X DELETE http://localhost:3000/sandbox/executions/550e8400-e29b-41d4-a716-446655440000 \
  -H "x-client-id: my-client-123" \
  -H "x-organization-id: org-456"

# Health check
curl -X GET http://localhost:3000/sandbox/health
*/

// ==========================================
// EXEMPLO 2: Uso Programático (TypeScript)
// ==========================================

export class SandboxExamples {
    constructor(private readonly sandboxExecutor: SandboxExecutorService) {}

    // Exemplo 1: Comando simples
    async example1_SimpleCommand() {
        const execution = await this.sandboxExecutor.execute(
            {
                command: 'echo "Hello from Sandbox!"',
                timeout: 5000,
            },
            {
                clientId: 'client-123',
                organizationId: 'org-456',
            },
        );

        console.log('Output:', execution.stdout);
        console.log('Status:', execution.status);
        console.log('Exit Code:', execution.exitCode);
    }

    // Exemplo 2: Com working directory
    async example2_WithWorkingDirectory() {
        const execution = await this.sandboxExecutor.execute(
            {
                command: 'pwd && ls -la',
                workingDirectory: '/tmp',
                timeout: 10000,
            },
            {
                clientId: 'client-123',
                organizationId: 'org-456',
            },
        );

        console.log('Current directory and files:', execution.stdout);
    }

    // Exemplo 3: Com variáveis de ambiente
    async example3_WithEnvironment() {
        const execution = await this.sandboxExecutor.execute(
            {
                command:
                    'echo "Node version: $(node -v)" && echo "Env: $NODE_ENV"',
                environment: {
                    NODE_ENV: 'production',
                    DEBUG: 'true',
                },
                timeout: 10000,
            },
            {
                clientId: 'client-123',
                organizationId: 'org-456',
            },
        );

        console.log('Environment test:', execution.stdout);
    }

    // Exemplo 4: Git operations
    async example4_GitOperations() {
        const execution = await this.sandboxExecutor.execute(
            {
                command:
                    'git clone https://github.com/user/repo.git && cd repo && git log --oneline -5',
                workingDirectory: '/tmp/sandbox',
                timeout: 60000,
            },
            {
                clientId: 'client-123',
                organizationId: 'org-456',
            },
        );

        if (execution.status === 'completed') {
            console.log('Git log:', execution.stdout);
        } else {
            console.error('Git operation failed:', execution.stderr);
        }
    }

    // Exemplo 5: Node.js script
    async example5_NodeScript() {
        const execution = await this.sandboxExecutor.execute(
            {
                command:
                    'node -e "console.log(JSON.stringify({ version: process.version, platform: process.platform }))"',
                timeout: 5000,
            },
            {
                clientId: 'client-123',
                organizationId: 'org-456',
            },
        );

        const result = JSON.parse(execution.stdout);
        console.log('Node info:', result);
    }

    // Exemplo 6: Pipeline de comandos
    async example6_CommandPipeline() {
        const execution = await this.sandboxExecutor.execute(
            {
                command: 'cat /etc/os-release | grep VERSION | head -1',
                timeout: 5000,
            },
            {
                clientId: 'client-123',
                organizationId: 'org-456',
            },
        );

        console.log('OS Version:', execution.stdout);
    }

    // Exemplo 7: Tratamento de erros
    async example7_ErrorHandling() {
        try {
            const execution = await this.sandboxExecutor.execute(
                {
                    command: 'ls /nonexistent-directory',
                    timeout: 5000,
                },
                {
                    clientId: 'client-123',
                    organizationId: 'org-456',
                },
            );

            if (execution.status === 'failed') {
                console.error(
                    'Command failed with exit code:',
                    execution.exitCode,
                );
                console.error('Error:', execution.stderr);
            }
        } catch (error) {
            console.error('Execution error:', error.message);
        }
    }

    // Exemplo 8: Comando com timeout longo
    async example8_LongRunningCommand() {
        const execution = await this.sandboxExecutor.execute(
            {
                command: 'sleep 2 && echo "Done!"',
                timeout: 10000,
            },
            {
                clientId: 'client-123',
                organizationId: 'org-456',
            },
        );

        console.log('Duration:', execution.duration, 'ms');
        console.log('Output:', execution.stdout);
    }

    // Exemplo 9: Múltiplas execuções concorrentes
    async example9_ConcurrentExecutions() {
        const promises = [
            this.sandboxExecutor.execute(
                { command: 'echo "Task 1"', timeout: 5000 },
                { clientId: 'client-123', organizationId: 'org-456' },
            ),
            this.sandboxExecutor.execute(
                { command: 'echo "Task 2"', timeout: 5000 },
                { clientId: 'client-123', organizationId: 'org-456' },
            ),
            this.sandboxExecutor.execute(
                { command: 'echo "Task 3"', timeout: 5000 },
                { clientId: 'client-123', organizationId: 'org-456' },
            ),
        ];

        const results = await Promise.all(promises);
        results.forEach((result, index) => {
            console.log(`Task ${index + 1}:`, result.stdout);
        });
    }

    // Exemplo 10: Verificar histórico de execuções
    async example10_CheckHistory() {
        const history = this.sandboxExecutor.getClientExecutionHistory(
            'client-123',
            10,
        );

        console.log('Recent executions:');
        history.forEach((exec) => {
            console.log(`- ${exec.id}: ${exec.status} (${exec.duration}ms)`);
        });
    }

    // Exemplo 11: Cancelar execução em andamento
    async example11_CancelExecution() {
        // Inicia comando longo
        const execution = await this.sandboxExecutor.execute(
            {
                command: 'sleep 30',
                timeout: 60000,
            },
            {
                clientId: 'client-123',
                organizationId: 'org-456',
            },
        );

        // Cancela após 2 segundos
        setTimeout(() => {
            const cancelled = this.sandboxExecutor.cancelExecution(
                execution.id,
                'client-123',
            );
            console.log('Cancelled:', cancelled);
        }, 2000);
    }

    // Exemplo 12: NPM operations
    async example12_NpmOperations() {
        const execution = await this.sandboxExecutor.execute(
            {
                command: 'npm init -y && npm install lodash --save',
                workingDirectory: '/tmp/npm-test',
                timeout: 120000, // 2 minutos
            },
            {
                clientId: 'client-123',
                organizationId: 'org-456',
            },
        );

        console.log('NPM output:', execution.stdout);
    }
}

// ==========================================
// EXEMPLO 3: Uso em um Use Case
// ==========================================

export class DeploymentUseCase {
    constructor(private readonly sandboxExecutor: SandboxExecutorService) {}

    async deployApplication(
        clientId: string,
        organizationId: string,
        repoUrl: string,
        branch: string,
    ) {
        // Step 1: Clone repository
        console.log('Cloning repository...');
        const cloneResult = await this.sandboxExecutor.execute(
            {
                command: `git clone -b ${branch} ${repoUrl} app`,
                workingDirectory: '/tmp/deploy',
                timeout: 60000,
            },
            { clientId, organizationId },
        );

        if (cloneResult.status !== 'completed') {
            throw new Error(`Clone failed: ${cloneResult.stderr}`);
        }

        // Step 2: Install dependencies
        console.log('Installing dependencies...');
        const installResult = await this.sandboxExecutor.execute(
            {
                command: 'cd app && npm install',
                workingDirectory: '/tmp/deploy',
                timeout: 180000, // 3 minutos
            },
            { clientId, organizationId },
        );

        if (installResult.status !== 'completed') {
            throw new Error(`Install failed: ${installResult.stderr}`);
        }

        // Step 3: Build application
        console.log('Building application...');
        const buildResult = await this.sandboxExecutor.execute(
            {
                command: 'cd app && npm run build',
                workingDirectory: '/tmp/deploy',
                environment: {
                    NODE_ENV: 'production',
                },
                timeout: 300000, // 5 minutos
            },
            { clientId, organizationId },
        );

        if (buildResult.status !== 'completed') {
            throw new Error(`Build failed: ${buildResult.stderr}`);
        }

        return {
            success: true,
            cloneDuration: cloneResult.duration,
            installDuration: installResult.duration,
            buildDuration: buildResult.duration,
        };
    }
}

// ==========================================
// EXEMPLO 4: Integration Test
// ==========================================

export class SandboxIntegrationTest {
    constructor(private readonly sandboxExecutor: SandboxExecutorService) {}

    async runAllTests() {
        console.log('🧪 Running Sandbox Integration Tests...\n');

        // Test 1: Basic command
        console.log('Test 1: Basic command');
        const test1 = await this.sandboxExecutor.execute(
            { command: 'echo "test"', timeout: 5000 },
            { clientId: 'test-client', organizationId: 'test-org' },
        );
        console.assert(test1.status === 'completed', 'Test 1 failed');
        console.assert(test1.stdout.includes('test'), 'Test 1 failed');
        console.log('✅ Test 1 passed\n');

        // Test 2: Command with error
        console.log('Test 2: Command with error');
        const test2 = await this.sandboxExecutor.execute(
            { command: 'ls /nonexistent', timeout: 5000 },
            { clientId: 'test-client', organizationId: 'test-org' },
        );
        console.assert(test2.status === 'failed', 'Test 2 failed');
        console.assert(test2.exitCode !== 0, 'Test 2 failed');
        console.log('✅ Test 2 passed\n');

        // Test 3: Timeout
        console.log('Test 3: Timeout');
        const test3 = await this.sandboxExecutor.execute(
            { command: 'sleep 10', timeout: 2000 },
            { clientId: 'test-client', organizationId: 'test-org' },
        );
        console.assert(test3.status === 'timeout', 'Test 3 failed');
        console.log('✅ Test 3 passed\n');

        // Test 4: Environment variables
        console.log('Test 4: Environment variables');
        const test4 = await this.sandboxExecutor.execute(
            {
                command: 'echo $TEST_VAR',
                environment: { TEST_VAR: 'hello' },
                timeout: 5000,
            },
            { clientId: 'test-client', organizationId: 'test-org' },
        );
        console.assert(test4.stdout.includes('hello'), 'Test 4 failed');
        console.log('✅ Test 4 passed\n');

        console.log('🎉 All tests passed!');
    }
}
