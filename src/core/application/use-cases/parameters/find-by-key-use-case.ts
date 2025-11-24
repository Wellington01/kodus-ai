import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@/core/domain/parameters/contracts/parameters.service.contract';
import { ParametersEntity } from '@/core/domain/parameters/entities/parameters.entity';
import { ParametersKey } from '@/shared/domain/enums/parameters-key.enum';
import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { IParameters } from '@/core/domain/parameters/interfaces/parameters.interface';

@Injectable()
export class FindByKeyParametersUseCase {
    constructor(
        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,
        private readonly logger: PinoLoggerService,
    ) {}

    async execute<K extends ParametersKey>(
        parametersKey: K,
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<IParameters<K>> {
        try {
            const parameter = await this.parametersService.findByKey(
                parametersKey,
                organizationAndTeamData,
            );

            if (!parameter) {
                throw new NotFoundException('Parameter config does not exist');
            }

            return this.mapParameter(parameter);
        } catch (error) {
            this.logger.error({
                message: 'Error while fetching parameters by key',
                context: FindByKeyParametersUseCase.name,
                error: error,
                metadata: { parametersKey, organizationAndTeamData },
            });

            throw error;
        }
    }

    private mapParameter<K extends ParametersKey>(
        parameter: ParametersEntity<K>,
    ): IParameters<K> {
        const normalizedParameter = parameter.toObject();

        if (parameter.configKey !== ParametersKey.CODE_REVIEW_CONFIG) {
            return normalizedParameter;
        }

        return {
            ...normalizedParameter,
            configValue: {
                ...normalizedParameter.configValue,
                showToggleCodeReviewVersion:
                    this.shouldShowCodeReviewVersionToggle(
                        parameter.createdAt,
                    ),
            },
        };
    }

    private shouldShowCodeReviewVersionToggle(createdAt?: Date): boolean {
        if (!createdAt) {
            return false;
        }

        /**
         * TEMPORARY LOGIC: Show/hide code review version toggle based on user registration date
         *
         * Purpose: Gradually migrate users from legacy to v2 engine
         * - Users registered BEFORE 2025-09-11: Can see version toggle (legacy + v2)
         * - Users registered ON/AFTER 2025-09-11: Only see v2 (no toggle)
         *
         * This logic should be REMOVED after all clients migrate to v2 engine
         * TODO: Remove this temporary logic after client migration completion
         */
        const cutoffDate = Date.UTC(2025, 8, 11); // September is 0-indexed

        return createdAt.getTime() < cutoffDate;
    }
}
