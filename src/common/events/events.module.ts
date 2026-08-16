import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DomainEventsListener } from './domain-events.listener';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [DomainEventsListener],
  exports: [EventEmitterModule],
})
export class EventsModule {}
