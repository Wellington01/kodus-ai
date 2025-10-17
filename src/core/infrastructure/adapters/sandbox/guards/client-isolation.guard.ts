import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export interface SandboxRequest extends Request {
    clientContext?: {
        clientId: string;
        organizationId: string;
        userId?: string;
        teamId?: string;
    };
}

@Injectable()
export class ClientIsolationGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<SandboxRequest>();

        const clientId = request.headers['x-client-id'] as string;
        const organizationId = request.headers['x-organization-id'] as string;
        const userId = request.headers['x-user-id'] as string;
        const teamId = request.headers['x-team-id'] as string;

        if (!clientId || !organizationId) {
            throw new UnauthorizedException(
                'Client ID and Organization ID are required',
            );
        }

        request.clientContext = {
            clientId: clientId || 'default-client',
            organizationId: organizationId || 'default-org',
            userId,
            teamId,
        };

        return true;
    }
}
