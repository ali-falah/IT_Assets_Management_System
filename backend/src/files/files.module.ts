import { Global, Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Global()
@Module({
  providers: [FilesService],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}
