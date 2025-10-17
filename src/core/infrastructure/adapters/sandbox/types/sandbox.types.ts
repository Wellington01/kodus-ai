export enum SandboxStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    TIMEOUT = 'timeout',
    CANCELLED = 'cancelled',
}

export interface SandboxExecution {
    id: string;
    clientId: string;
    command: string;
    workingDirectory?: string;
    environment?: Record<string, string>;
    timeout?: number;
    status: SandboxStatus;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
    error?: string;
}

export interface SandboxExecutionRequest {
    command: string;
    workingDirectory?: string;
    environment?: Record<string, string>;
    timeout?: number;
}

export interface SandboxExecutionResponse {
    id: string;
    status: SandboxStatus;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    duration?: number;
    error?: string;
}

export interface SandboxConfig {
    maxTimeout: number;
    defaultTimeout: number;
    allowedCommands?: string[];
    blockedCommands?: string[];
    maxConcurrentExecutions: number;
    maxOutputSize: number;
}

export interface ClientSandboxContext {
    clientId: string;
    organizationId: string;
    userId?: string;
    teamId?: string;
}
