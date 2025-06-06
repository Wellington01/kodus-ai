import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import {
    ISessionService,
    SESSION_SERVICE_TOKEN,
} from '@/core/domain/automation/contracts/session.service.contracts';
import {
    CONVERSATION_SERVICE_TOKEN,
    IConversationService,
} from '@/core/domain/conversation/contracts/conversation.service.contracts';
import { SenderType } from '@/core/domain/conversation/enum/SenderType';
import {
    PARAMETERS_SERVICE_TOKEN,
    IParametersService,
} from '@/core/domain/parameters/contracts/parameters.service.contract';
import { LLMModelProvider } from '@/core/infrastructure/adapters/services/llmProviders/llmModelProvider.helper';
import { LLMProviderService } from '@/core/infrastructure/adapters/services/llmProviders/llmProvider.service';
import { LLM_PROVIDER_SERVICE_TOKEN } from '@/core/infrastructure/adapters/services/llmProviders/llmProvider.service.contract';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { ParametersKey } from '@/shared/domain/enums/parameters-key.enum';
import { PlatformType } from '@/shared/domain/enums/platform-type.enum';
import { IUseCase } from '@/shared/domain/interfaces/use-case.interface';
import { prompt_generate_conversation_title } from '@/shared/utils/langchainCommon/prompts';
import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

@Injectable()
export class CreateConversationUseCase implements IUseCase {
    constructor(
        @Inject(CONVERSATION_SERVICE_TOKEN)
        private readonly conversationService: IConversationService,

        @Inject(SESSION_SERVICE_TOKEN)
        private readonly sessionService: ISessionService,

        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,

        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string }; uuid: string };
        },

        private logger: PinoLoggerService,

        @Inject(LLM_PROVIDER_SERVICE_TOKEN)
        private readonly llmProviderService: LLMProviderService,
    ) {}

    async execute(params: any): Promise<{ uuid: string }> {
        try {
            const { prompt, teamId } = params;

            const userId = this.request.user?.uuid;
            const organizationId = this.request.user?.organization.uuid;

            if (!organizationId || !userId) {
                throw new Error('Undefined user info');
            }

            const organizationAndTeamData = {
                teamId,
                organizationId,
            };

            const title = await this.generateConversationTitle(
                prompt,
                userId,
                organizationAndTeamData,
            );

            const newSession = await this.sessionService.register({
                platformUserId: userId,
                platformName: PlatformType.KODUS_WEB,
                route: 'default',
                date: Date.now(),
                teamId: teamId,
                organizationId: organizationId,
            });

            if (!newSession) {
                throw new Error('error when creating new session');
            }

            const newConversation = {
                title: typeof title === 'string' ? title : JSON.stringify(title),
                type: SenderType.USER,
                sessionId: newSession.uuid,
                organizationId,
                teamId,
            };

            const response =
                await this.conversationService.create(newConversation);

            return { uuid: response.uuid };
        } catch (error) {
            this.logger.error({
                message: 'Error create conversation',
                context: CreateConversationUseCase.name,
                error: error,
                metadata: { ...params },
            });
            throw error;
        }
    }

    async generateConversationTitle(
        prompt: string,
        userId: string,
        organizationAndTeamData: OrganizationAndTeamData,
    ) {
        const maxRetries = 2;
        let retryCount = 0;

        const { organizationId } = organizationAndTeamData;

        while (retryCount < maxRetries) {
            try {
                let llm = this.llmProviderService.getLLMProvider({
                    model: LLMModelProvider.VERTEX_GEMINI_2_5_FLASH_PREVIEW_04_17,
                    temperature: 0,
                    jsonMode: true,
                });

                const language = (
                    await this.parametersService.findByKey(
                        ParametersKey.LANGUAGE_CONFIG,
                        organizationAndTeamData,
                    )
                )?.configValue;

                const chain = await llm.invoke(
                    prompt_generate_conversation_title(prompt, language),
                    {
                        metadata: {
                            module: 'Conversation',
                            submodule: 'CreateTitle',
                            organizationId,
                            userId,
                        },
                    },
                );

                return chain?.content || 'No comment generated';
            } catch (error) {
                this.logger.error({
                    message: `Error generate title to new converation`,
                    context: CreateConversationUseCase.name,
                    error: error,
                    metadata: {
                        organizationId,
                        userId,
                    },
                });

                retryCount++;

                if (retryCount === maxRetries) {
                    throw new Error(
                        'Error generate title to new converation. Max retries exceeded',
                    );
                }
            }
        }
    }
}
