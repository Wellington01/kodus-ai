import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
    ITeamAutomationService,
    TEAM_AUTOMATION_SERVICE_TOKEN,
} from '@/core/domain/automation/contracts/team-automation.service';
import {
    AUTOMATION_SERVICE_TOKEN,
    IAutomationService,
} from '@/core/domain/automation/contracts/automation.service';
import {
    EXECUTE_AUTOMATION_SERVICE_TOKEN,
    IExecuteAutomationService,
} from '@/shared/domain/contracts/execute.automation.service.contracts';
import { AutomationType } from '@/core/domain/automation/enums/automation-type';
import * as moment from 'moment-timezone';
import {
    PARAMETERS_SERVICE_TOKEN,
    IParametersService,
} from '@/core/domain/parameters/contracts/parameters.service.contract';
import { CheckinConfigValue } from '@/core/domain/parameters/types/configValue.type';
import { ParametersKey } from '@/shared/domain/enums/parameters-key.enum';
import { PinoLoggerService } from '../../logger/pino.service';
import { IntegrationCategory } from '@/shared/domain/enums/integration-category.enum';
import { STATUS } from '@/config/types/database/status.type';
import { IntegrationStatusFilter } from '@/core/domain/team/interfaces/team.interface';
import { TEAM_SERVICE_TOKEN } from '@/core/domain/team/contracts/team.service.contract';
import { ITeamService } from '@/core/domain/team/contracts/team.service.contract';

const API_CRON_AUTOMATION_DAILY_CHECKIN =
    process.env.API_CRON_AUTOMATION_DAILY_CHECKIN;

type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

@Injectable()
export class DailyCheckinCronProvider {
    private readonly dayOfWeekMap: { [key: string]: DayOfWeek } = {
        '0': 'sun',
        '1': 'mon',
        '2': 'tue',
        '3': 'wed',
        '4': 'thu',
        '5': 'fri',
        '6': 'sat',
    };

    constructor(
        @Inject(AUTOMATION_SERVICE_TOKEN)
        private readonly automationService: IAutomationService,

        @Inject(TEAM_SERVICE_TOKEN)
        private readonly teamService: ITeamService,

        @Inject(TEAM_AUTOMATION_SERVICE_TOKEN)
        private readonly teamAutomationService: ITeamAutomationService,

        @Inject(EXECUTE_AUTOMATION_SERVICE_TOKEN)
        private readonly executeAutomation: IExecuteAutomationService,

        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,

        private readonly logger: PinoLoggerService,
    ) {}

    @Cron(API_CRON_AUTOMATION_DAILY_CHECKIN, {
        name: AutomationType.AUTOMATION_DAILY_CHECKIN,
        timeZone: 'America/Sao_Paulo',
    })
    async handleCron() {
        const currentTimeStamp = moment().utc().startOf('minute').valueOf();
        const currentDayOfWeek = moment().format('d');

        try {
            this.logger.log({
                message: 'STARTING CRON - AUTOMATION - DAILY CHECK-IN',
                context: DailyCheckinCronProvider.name,
            });

            console.log('STARTING CRON - AUTOMATION - DAILY CHECK-IN');

            const automation = await this.getAutomation();

            if (!automation) return 'No automation found';

            const teamAutomations =
                await this.getActiveTeamAutomations(automation);

            if (!teamAutomations) return 'No teams with active automation';

            const filteredTeamAutomations =
                await this.teamService.filterTeamAutomationsByConfiguredIntegrations(
                    teamAutomations,
                    {
                        integrationCategories: [
                            IntegrationCategory.COMMUNICATION,
                        ],
                        integrationStatus: IntegrationStatusFilter.CONFIGURED,
                        status: STATUS.ACTIVE,
                    },
                );

            if (!filteredTeamAutomations.length) {
                return 'No teams with active automation and required integrations';
            }

            await this.processTeamAutomations(
                filteredTeamAutomations,
                currentTimeStamp,
                currentDayOfWeek,
            );

            console.log('CRON - AUTOMATION - DAILY CHECK-IN - COMPLETED');

            this.logger.log({
                message: 'CRON - AUTOMATION - DAILY CHECK-IN - COMPLETED',
                context: DailyCheckinCronProvider.name,
            });
        } catch (error) {
            this.logger.error({
                message: 'Error executing daily check-in automation',
                context: DailyCheckinCronProvider.name,
                error: error,
            });
        }
    }

    private async getAutomation() {
        return (
            await this.automationService.find({
                automationType: AutomationType.AUTOMATION_DAILY_CHECKIN,
            })
        )[0];
    }

    private async getActiveTeamAutomations(automation) {
        return this.teamAutomationService.find({
            automation: { uuid: automation.uuid },
            status: true,
        });
    }

    private async processTeamAutomations(
        teamAutomations,
        currentTimeStamp: number,
        currentDayOfWeek: string,
    ) {
        for (const teamAutomation of teamAutomations) {
            try {
                const organizationAndTeamData = {
                    organizationId: teamAutomation.team.organization.uuid,
                    teamId: teamAutomation.team.uuid,
                };

                const checkinConfig = await this.getCheckinConfig(
                    organizationAndTeamData,
                );
                if (!checkinConfig) continue;

                if (
                    this.shouldExecuteCheckin(
                        checkinConfig,
                        currentTimeStamp,
                        currentDayOfWeek,
                    )
                ) {
                    await this.executeCheckin(
                        teamAutomation,
                        organizationAndTeamData,
                        checkinConfig,
                        teamAutomation.team,
                    );
                }
            } catch (error) {
                this.logger.error({
                    message: `Error processing automation for team ${teamAutomation.team.uuid}`,
                    context: DailyCheckinCronProvider.name,
                    error: error,
                });
            }
        }
    }

    private async getCheckinConfig(organizationAndTeamData) {
        const checkinConfigParameter = await this.parametersService.findByKey(
            ParametersKey.CHECKIN_CONFIG,
            organizationAndTeamData,
        );
        return checkinConfigParameter?.configValue.find(
            (config: CheckinConfigValue) =>
                config.checkinId === 'daily-checkin',
        );
    }

    private shouldExecuteCheckin(
        checkinConfig: CheckinConfigValue,
        currentTimeStamp: number,
        currentDayOfWeek: string,
    ): boolean {
        const scheduledTime = moment(
            checkinConfig.checkinTime,
            'HH:mm',
        ).valueOf();

        return (
            currentTimeStamp === scheduledTime &&
            checkinConfig.frequency[this.dayOfWeekMap[currentDayOfWeek]]
        );
    }

    private async executeCheckin(
        teamAutomation,
        organizationAndTeamData,
        checkinConfig,
        team,
    ) {
        await this.executeAutomation.executeStrategy(
            AutomationType.AUTOMATION_DAILY_CHECKIN,
            {
                organizationAndTeamData,
                teamAutomationId: teamAutomation.uuid,
                checkinConfig,
                origin: 'System',
                team,
            },
        );
    }
}
