import { ParametersKey } from '@/shared/domain/enums/parameters-key.enum';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class FindParametersByKeyQueryDto {
    @IsEnum(ParametersKey)
    key: ParametersKey;

    @IsString()
    @IsNotEmpty()
    teamId: string;
}
