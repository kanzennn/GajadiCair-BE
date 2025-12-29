import { PartialType } from '@nestjs/mapped-types';
import { CreateFaceRecognitionDto } from './create-face-recognition.dto';

export class UpdateFaceRecognitionDto extends PartialType(
  CreateFaceRecognitionDto,
) {}
