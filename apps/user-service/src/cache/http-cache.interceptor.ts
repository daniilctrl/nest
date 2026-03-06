import { ExecutionContext, Injectable } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { Request } from 'express';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  protected override trackBy(context: ExecutionContext): string | undefined {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { id: string } }>();
    const url = request.url;
    if (url?.includes('/profile') && request.user?.id) {
      return `profile:${request.user.id}`;
    }
    return request.url;
  }
}
