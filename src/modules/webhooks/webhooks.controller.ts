import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { Public } from '../../common/decorators/public.decorator';
import { FlutterwaveWebhookPayload } from '../flutterwave/flutterwave.types';

@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * `payload` is typed as a plain interface (not a class-validator DTO) so
   * Nest's global whitelist-strict ValidationPipe skips it entirely — a real
   * Flutterwave payload has far more fields than we need, and strict
   * whitelisting would reject it. Only the fields this handler actually uses
   * are validated manually in WebhooksService.
   *
   * @HttpCode(200) — Nest defaults POST to 201 Created, which is wrong here:
   * this endpoint acknowledges/processes an event, it doesn't create a
   * resource the caller should see as "Created".
   */
  @HttpCode(HttpStatus.OK)
  @Post('flutterwave')
  async handleFlutterwave(
    @Headers('verif-hash') signature: string | undefined,
    @Body() payload: FlutterwaveWebhookPayload,
  ) {
    return this.webhooksService.handleFlutterwaveEvent(signature, payload);
  }
}
