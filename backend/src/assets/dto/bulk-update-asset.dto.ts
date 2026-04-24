import { IsArray, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAssetDto } from './update-asset.dto';
import { ApiProperty } from '@nestjs/swagger';

export class BulkUpdateAssetDto {
  @ApiProperty({ description: 'List of asset IDs to update' })
  @IsArray()
  @IsUUID('all', { each: true })
  ids: string[];

  @ApiProperty({ type: UpdateAssetDto, description: 'Data to apply to all selected assets' })
  @ValidateNested()
  @Type(() => UpdateAssetDto)
  data: UpdateAssetDto;
}
