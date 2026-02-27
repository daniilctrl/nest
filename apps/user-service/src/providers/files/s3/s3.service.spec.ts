import { Test, TestingModule } from '@nestjs/testing';

import { S3Lib } from './constants/do-spaces-service-lib.constant';
import { S3Service } from './s3.service';

const mockS3Client = {
  putObject: jest.fn(
    (_params: unknown, callback: (error: Error | null) => void) =>
      callback(null),
  ),
  deleteObject: jest.fn(
    (_params: unknown, callback: (error: Error | null) => void) =>
      callback(null),
  ),
};

describe('S3Service', () => {
  let service: S3Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: S3Lib,
          useValue: mockS3Client,
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
