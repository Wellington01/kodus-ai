import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    Query,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiHeader,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { SandboxExecutorService } from '../services/sandbox-executor.service';
import {
    ExecuteCommandDto,
    SandboxExecutionResponseDto,
} from '../dto/execute-command.dto';
import {
    ClientIsolationGuard,
    SandboxRequest,
} from '../guards/client-isolation.guard';
import { PinoLoggerService } from '../../services/logger/pino.service';

@ApiTags('Sandbox')
@ApiBearerAuth()
@ApiHeader({
    name: 'x-client-id',
    description: 'Client unique identifier',
    required: true,
})
@ApiHeader({
    name: 'x-organization-id',
    description: 'Organization unique identifier',
    required: true,
})
@ApiHeader({
    name: 'x-user-id',
    description: 'User unique identifier',
    required: false,
})
@ApiHeader({
    name: 'x-team-id',
    description: 'Team unique identifier',
    required: false,
})
@Controller('sandbox')
@UseGuards(ClientIsolationGuard)
export class SandboxController {
    constructor(
        private readonly sandboxExecutor: SandboxExecutorService,
        private readonly logger: PinoLoggerService,
    ) {}

    @Post('execute')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Execute a bash command in a sandboxed environment',
        description:
            'Executes a bash command with timeout and resource limits. Isolated by client.',
    })
    @ApiResponse({
        status: 200,
        description: 'Command execution result',
        type: SandboxExecutionResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid command or parameters',
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - Missing client credentials',
    })
    @ApiResponse({
        status: 429,
        description: 'Too many concurrent executions',
    })
    async executeCommand(
        @Body() dto: ExecuteCommandDto,
        @Req() req: SandboxRequest,
    ): Promise<SandboxExecutionResponseDto> {
        const { clientContext } = req;

        const sanitizedCommand = dto.command.replace(/'/g, "\\'");

        this.logger.log({
            message: 'Received sandbox execution request',
            context: SandboxController.name,
            metadata: {
                clientId: clientContext.clientId,
                organizationId: clientContext.organizationId,
                command: sanitizedCommand,
            },
        });

        const execution = await this.sandboxExecutor.execute(
            {
                command: sanitizedCommand,
                workingDirectory: dto.workingDirectory,
                environment: dto.environment,
                timeout: dto.timeout,
            },
            clientContext,
        );

        return {
            id: execution.id,
            status: execution.status,
            stdout: execution.stdout,
            stderr: execution.stderr,
            exitCode: execution.exitCode,
            duration: execution.duration,
            error: execution.error,
        };
    }

    @Get('executions/:executionId')
    @ApiOperation({
        summary: 'Get execution details by ID',
        description:
            'Retrieves details of a specific execution. Only accessible by the client that created it.',
    })
    @ApiResponse({
        status: 200,
        description: 'Execution details',
        type: SandboxExecutionResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Execution not found',
    })
    async getExecution(
        @Param('executionId') executionId: string,
        @Req() req: SandboxRequest,
    ): Promise<SandboxExecutionResponseDto> {
        const { clientContext } = req;

        const execution = this.sandboxExecutor.getExecution(
            executionId,
            clientContext.clientId,
        );

        if (!execution) {
            throw new Error('Execution not found');
        }

        return {
            id: execution.id,
            status: execution.status,
            stdout: execution.stdout,
            stderr: execution.stderr,
            exitCode: execution.exitCode,
            duration: execution.duration,
            error: execution.error,
        };
    }

    @Delete('executions/:executionId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Cancel a running execution',
        description:
            'Cancels a running execution. Only accessible by the client that created it.',
    })
    @ApiResponse({
        status: 204,
        description: 'Execution cancelled successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'Execution not found or already completed',
    })
    async cancelExecution(
        @Param('executionId') executionId: string,
        @Req() req: SandboxRequest,
    ): Promise<void> {
        const { clientContext } = req;

        const cancelled = this.sandboxExecutor.cancelExecution(
            executionId,
            clientContext.clientId,
        );

        if (!cancelled) {
            throw new Error('Execution not found or cannot be cancelled');
        }

        this.logger.log({
            message: 'Execution cancelled',
            context: SandboxController.name,
            metadata: {
                executionId,
                clientId: clientContext.clientId,
            },
        });
    }

    @Get('executions')
    @ApiOperation({
        summary: 'List client executions',
        description:
            'Lists active and historical executions for the current client.',
    })
    @ApiResponse({
        status: 200,
        description: 'List of executions',
        type: [SandboxExecutionResponseDto],
    })
    async listExecutions(
        @Query('status') status?: string,
        @Query('limit') limit?: number,
        @Req() req?: SandboxRequest,
    ): Promise<SandboxExecutionResponseDto[]> {
        const { clientContext } = req;

        let executions;
        if (status === 'active') {
            executions = this.sandboxExecutor.getClientActiveExecutions(
                clientContext.clientId,
            );
        } else {
            executions = this.sandboxExecutor.getClientExecutionHistory(
                clientContext.clientId,
                limit || 50,
            );
        }

        return executions.map((exec) => ({
            id: exec.id,
            status: exec.status,
            stdout: exec.stdout,
            stderr: exec.stderr,
            exitCode: exec.exitCode,
            duration: exec.duration,
            error: exec.error,
        }));
    }

    @Get('health')
    @ApiOperation({
        summary: 'Health check for sandbox service',
        description: 'Returns the health status of the sandbox service.',
    })
    @ApiResponse({
        status: 200,
        description: 'Service is healthy',
    })
    async healthCheck(): Promise<{ status: string; activeExecutions: number }> {
        const activeExecutions = Array.from(
            this.sandboxExecutor['activeExecutions'].values(),
        ).length;

        return {
            status: 'healthy',
            activeExecutions,
        };
    }
}
