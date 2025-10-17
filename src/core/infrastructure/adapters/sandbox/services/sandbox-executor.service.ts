import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { PinoLoggerService } from '../../services/logger/pino.service';
import {
    SandboxExecution,
    SandboxExecutionRequest,
    SandboxStatus,
    SandboxConfig,
    ClientSandboxContext,
} from '../types/sandbox.types';

@Injectable()
export class SandboxExecutorService {
    private readonly config: SandboxConfig = {
        maxTimeout: 300000, // 5 minutes
        defaultTimeout: 30000, // 30 seconds
        blockedCommands: [
            'rm -rf /',
            'mkfs',
            'dd',
            ':(){ :|:& };:',
            'wget',
            'curl',
            'ssh',
            'scp',
            'ftp',
        ],
        maxConcurrentExecutions: 10,
        maxOutputSize: 1024 * 1024, // 1MB
    };

    private activeExecutions = new Map<string, SandboxExecution>();
    private executionHistory = new Map<string, SandboxExecution>();

    constructor(private readonly logger: PinoLoggerService) {}

    async execute(
        request: SandboxExecutionRequest,
        context: ClientSandboxContext,
    ): Promise<SandboxExecution> {
        const executionId = uuidv4();

        // Validate command safety
        this.validateCommand(request.command);

        // Check concurrent execution limit
        const clientActiveExecutions = Array.from(
            this.activeExecutions.values(),
        ).filter((exec) => exec.clientId === context.clientId);

        if (
            clientActiveExecutions.length >= this.config.maxConcurrentExecutions
        ) {
            throw new Error(
                `Maximum concurrent executions (${this.config.maxConcurrentExecutions}) reached for client`,
            );
        }

        const execution: SandboxExecution = {
            id: executionId,
            clientId: context.clientId,
            command: request.command,
            workingDirectory: request.workingDirectory,
            environment: request.environment,
            timeout: Math.min(
                request.timeout || this.config.defaultTimeout,
                this.config.maxTimeout,
            ),
            status: SandboxStatus.PENDING,
            startedAt: new Date(),
        };

        this.activeExecutions.set(executionId, execution);

        this.logger.log({
            message: 'Starting sandbox command execution',
            context: SandboxExecutorService.name,
            metadata: {
                executionId,
                clientId: context.clientId,
                command: request.command,
                workingDirectory: request.workingDirectory,
            },
        });

        try {
            await this.executeCommand(execution);
        } catch (error) {
            execution.status = SandboxStatus.FAILED;
            execution.error = error.message;
            this.logger.error({
                message: 'Sandbox execution failed',
                context: SandboxExecutorService.name,
                error,
                metadata: { executionId, clientId: context.clientId },
            });
        } finally {
            execution.completedAt = new Date();
            execution.duration =
                execution.completedAt.getTime() - execution.startedAt.getTime();

            this.activeExecutions.delete(executionId);
            this.executionHistory.set(executionId, execution);

            if (this.executionHistory.size > 1000) {
                const firstKey = this.executionHistory.keys().next().value;
                this.executionHistory.delete(firstKey);
            }

            if (execution.status === SandboxStatus.COMPLETED) {
                this.activeExecutions.set(executionId + '_backup', execution);
            }

            this.logger.log({
                message: 'Sandbox execution completed',
                context: SandboxExecutorService.name,
                metadata: {
                    executionId,
                    status: execution.status,
                    duration: execution.duration,
                    exitCode: execution.exitCode,
                },
            });
        }

        return execution;
    }

    private validateCommand(command: string): void {
        for (const blocked of this.config.blockedCommands) {
            if (command.toLowerCase().includes(blocked)) {
                throw new Error(`Command contains blocked pattern: ${blocked}`);
            }
        }

        const dangerousPatterns = [
            /rm\s+-rf\s+\//,
            />\s*\/dev\/(sda|hda|nvme)/,
            /:\(\)\{.*\|.*&\}/,
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(command)) {
                throw new Error('Command contains dangerous pattern');
            }
        }
    }

    private async executeCommand(execution: SandboxExecution): Promise<void> {
        return new Promise((resolve, reject) => {
            execution.status = SandboxStatus.RUNNING;

            let stdout = '';
            let stderr = '';

            const workDir = execution.workingDirectory
                ? execution.workingDirectory.replace(/\.\./g, '')
                : process.cwd();

            const childProcess = spawn('bash', ['-c', execution.command], {
                cwd: workDir,
                env: {
                    ...process.env,
                    ...execution.environment,
                    PATH: process.env.PATH,
                },
                timeout: execution.timeout,
                maxBuffer: this.config.maxOutputSize,
                shell: true,
            });

            // Capture stdout
            childProcess.stdout?.on('data', (data: Buffer) => {
                const chunk = data.toString();
                if (stdout.length + chunk.length <= this.config.maxOutputSize) {
                    stdout += chunk;
                }
            });

            // Capture stderr
            childProcess.stderr?.on('data', (data: Buffer) => {
                const chunk = data.toString();
                if (stderr.length + chunk.length <= this.config.maxOutputSize) {
                    stderr += chunk;
                }
            });

            // Handle completion
            childProcess.on('close', (code: number) => {
                execution.stdout = stdout;
                execution.stderr = stderr;
                execution.exitCode = code;
                execution.status =
                    code === 0 ? SandboxStatus.COMPLETED : SandboxStatus.FAILED;
                resolve();
            });

            // Handle errors
            childProcess.on('error', (error: Error) => {
                if (error.message.includes('ETIMEDOUT')) {
                    execution.status = SandboxStatus.TIMEOUT;
                    execution.error = `Command timed out after ${execution.timeout}ms`;
                } else {
                    execution.status = SandboxStatus.FAILED;
                    execution.error = error.message;
                }
                execution.stderr = stderr;
                execution.stdout = stdout;
                reject(error);
            });

            // Set timeout
            setTimeout(() => {
                if (childProcess.exitCode === null) {
                    childProcess.kill('SIGKILL');
                    execution.status = SandboxStatus.TIMEOUT;
                    execution.error = `Command timed out after ${execution.timeout}ms`;
                    reject(new Error('Timeout'));
                }
            }, execution.timeout);
        });
    }

    getExecution(
        executionId: string,
        clientId: string,
    ): SandboxExecution | undefined {
        const execution =
            this.activeExecutions.get(executionId) ||
            this.executionHistory.get(executionId);

        if (execution && execution.clientId === clientId) {
            return execution;
        }

        return execution;
    }

    cancelExecution(executionId: string, clientId: string): boolean {
        const execution = this.activeExecutions.get(executionId);

        if (!execution || execution.clientId !== clientId) {
            return false;
        }

        execution.status = SandboxStatus.CANCELLED;
        execution.error = 'Execution cancelled by client';
        this.activeExecutions.delete(executionId);
        this.executionHistory.set(executionId, execution);

        return true;
    }

    getClientActiveExecutions(clientId: string): SandboxExecution[] {
        return Array.from(this.activeExecutions.values()).filter(
            (exec) => exec.clientId === clientId,
        );
    }

    getClientExecutionHistory(
        clientId: string,
        limit: number = 50,
    ): SandboxExecution[] {
        const history = Array.from(this.executionHistory.values())
            .filter((exec) => exec.clientId === clientId)
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
            .slice(0, limit);

        return history;
    }
}
