import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import {
    IOrganizationParametersService,
    ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
} from '@/core/domain/organizationParameters/contracts/organizationParameters.service.contract';
import { OrganizationParametersEntity } from '@/core/domain/organizationParameters/entities/organizationParameters.entity';
import { IOrganizationParameters } from '@/core/domain/organizationParameters/interfaces/organizationParameters.interface';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { OrganizationParametersKey } from '@/shared/domain/enums/organization-parameters-key.enum';
import { decrypt } from '@/shared/utils/crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class FindByKeyOrganizationParametersUseCase {
    constructor(
        @Inject(ORGANIZATION_PARAMETERS_SERVICE_TOKEN)
        private readonly organizationParametersService: IOrganizationParametersService,
        private readonly logger: PinoLoggerService,
    ) {}

    async execute(
        organizationParametersKey: OrganizationParametersKey,
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<IOrganizationParameters> {
        try {
            const parameter =
                await this.organizationParametersService.findByKey(
                    organizationParametersKey,
                    organizationAndTeamData,
                );

            if (!parameter) {
                throw new NotFoundException(
                    'Organization parameter config does not exist',
                );
            }

            return this.buildResponse(
                organizationParametersKey,
                parameter,
                organizationAndTeamData,
            );
        } catch (error) {
            this.logger.error({
                message: 'Error finding organization parameters by key',
                context: FindByKeyOrganizationParametersUseCase.name,
                error: error,
                metadata: {
                    organizationParametersKey,
                    organizationAndTeamData,
                },
            });

            throw error;
        }
    }

    private buildResponse(
        organizationParametersKey: OrganizationParametersKey,
        parameter: OrganizationParametersEntity,
        organizationAndTeamData: OrganizationAndTeamData,
    ): IOrganizationParameters {
        if (
            organizationParametersKey !==
            OrganizationParametersKey.BYOK_CONFIG
        ) {
            return this.getUpdatedParameters(parameter);
        }

        try {
            const maskedConfig = this.maskByokConfig(parameter.configValue);

            return {
                ...this.getUpdatedParameters(parameter),
                configValue: maskedConfig,
            };
        } catch (error) {
            this.logger.error({
                message: 'Error decrypting API key',
                context: FindByKeyOrganizationParametersUseCase.name,
                error: error,
                metadata: { organizationParametersKey, organizationAndTeamData },
            });

            return this.getUpdatedParameters(parameter);
        }
    }

    private getUpdatedParameters(parameter: OrganizationParametersEntity) {
        return {
            uuid: parameter.uuid,
            configKey: parameter.configKey,
            configValue: parameter.configValue,
            organization: parameter.organization,
        };
    }

    private maskByokConfig(configValue: any) {
        const hasApiKey =
            configValue?.main?.apiKey || configValue?.fallback?.apiKey;

        if (!configValue || typeof configValue !== 'object' || !hasApiKey) {
            return configValue;
        }

        const processedConfig = { ...configValue };

        processedConfig.main = configValue.main?.apiKey
            ? {
                  ...configValue.main,
                  apiKey: this.maskApiKey(decrypt(configValue.main.apiKey)),
              }
            : null;

        processedConfig.fallback = configValue.fallback?.apiKey
            ? {
                  ...configValue.fallback,
                  apiKey: this.maskApiKey(decrypt(configValue.fallback.apiKey)),
              }
            : null;

        return processedConfig;
    }

    private maskApiKey(apiKey: string): string {
        if (apiKey.length <= 6) {
            return apiKey;
        }
        const firstTwo = apiKey.substring(0, 2);
        const lastThree = apiKey.substring(apiKey.length - 3);
        return `${firstTwo}...${lastThree}`;
    }
}
