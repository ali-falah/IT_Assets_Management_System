import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ description: 'Role name (e.g. admin, technician, viewer) or roleId (uuid)' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'UUID of the role from user_roles table' })
  @IsOptional()
  @IsString()
  roleId?: string;
}
