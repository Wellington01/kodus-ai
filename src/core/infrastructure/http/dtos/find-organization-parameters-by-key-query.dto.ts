import { OrganizationParametersKey } from '@/shared/domain/enums/organization-parameters-key.enum';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class FindOrganizationParametersByKeyQueryDto {
    @IsEnum(OrganizationParametersKey)
    key: OrganizationParametersKey;

    @IsString()
    @IsNotEmpty()
    organizationId: string;
}
