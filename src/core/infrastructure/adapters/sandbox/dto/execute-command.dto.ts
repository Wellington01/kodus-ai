import {
    IsString,
    IsOptional,
    IsNumber,
    IsObject,
    Min,
    Max,
    Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExecuteCommandDto {
    @ApiProperty({
        description: 'Bash command to execute',
        example: 'ls -la',
    })
    @IsString()
    command: string;

    @ApiProperty({
        description: 'Working directory for command execution',
        example: '/tmp/workspace',
        required: false,
    })
    @IsOptional()
    @IsString()
    workingDirectory?: string;

    @ApiProperty({
        description: 'Environment variables for the command',
        example: { NODE_ENV: 'development', DEBUG: 'true' },
        required: false,
    })
    @IsOptional()
    @IsObject()
    environment?: Record<string, string>;

    @ApiProperty({
        description: 'Timeout in milliseconds (max 300000 = 5 minutes)',
        example: 30000,
        required: false,
        minimum: 1000,
        maximum: 300000,
    })
    @IsOptional()
    @IsNumber()
    @Min(1000)
    @Max(300000)
    timeout?: number;
}

export class SandboxExecutionResponseDto {
    @ApiProperty({ description: 'Unique execution ID' })
    id: string;

    @ApiProperty({
        description: 'Execution status',
        enum: [
            'pending',
            'running',
            'completed',
            'failed',
            'timeout',
            'cancelled',
        ],
    })
    status: string;

    @ApiProperty({ description: 'Standard output', required: false })
    stdout?: string;

    @ApiProperty({ description: 'Standard error', required: false })
    stderr?: string;

    @ApiProperty({ description: 'Exit code', required: false })
    exitCode?: number;

    @ApiProperty({
        description: 'Execution duration in milliseconds',
        required: false,
    })
    duration?: number;

    @ApiProperty({ description: 'Error message if failed', required: false })
    error?: string;
}
