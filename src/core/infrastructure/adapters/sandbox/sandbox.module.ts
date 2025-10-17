import { Module } from '@nestjs/common';
import { SandboxController } from './controllers/sandbox.controller';
import { SandboxExecutorService } from './services/sandbox-executor.service';
import { ClientIsolationGuard } from './guards/client-isolation.guard';

@Module({
    controllers: [SandboxController],
    providers: [SandboxExecutorService, ClientIsolationGuard],
    exports: [SandboxExecutorService],
})
export class SandboxModule {}
