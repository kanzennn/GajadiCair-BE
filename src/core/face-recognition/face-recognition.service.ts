import { Injectable } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class FaceRecognitionService {
  private readonly pythonUrl =
    process.env.PYTHON_FACEREC_URL || 'http://localhost:8001';
  async checkFace(file: Express.Multer.File) {
    // Implement face recognition logic here
    // For demonstration, we'll just return a mock response
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname || 'frame.jpg',
      contentType: file.mimetype || 'image/jpeg',
    });

    const res = await axios.post(`${this.pythonUrl}/has-face`, form, {
      headers: form.getHeaders(),
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return res.data;
  }
}
