import {
  bind,
  Definition,
  EventSink,
  on,
  RegisterDefinitions,
  ServiceLocator,
  Shutdown,
  Startup,
  AbstractClass,
  Callable,
  callableSetter,
} from '@badbury/ioc';
import { Timer, TimerController, DurationFunction } from './timer-controller';

export class TimerDefinition<A extends AbstractClass[] = []>
  implements Definition<TimerDefinition> {
  definition = TimerDefinition;

  constructor(public readonly timer: Timer, private readonly callable: Callable) {}

  register(resolver: ServiceLocator, sink: EventSink, controller: TimerController): void {
    const timer = this.timer.do(() => this.callable.call([], resolver, sink));
    controller.use(timer);
  }

  emit(): TimerDefinition<A> {
    return new TimerDefinition(this.timer, this.callable.emit());
  }
}

export class TimerDefinitionBuilder<A extends AbstractClass[] = []> {
  constructor(public readonly timer: Timer, public args: A = ([] as unknown) as A) {}

  and: DurationFunction<TimerDefinitionBuilder<A>> = (...args: unknown[]) => {
    const [duration, unit] = args as [number, 'months'];
    return new TimerDefinitionBuilder(this.timer.and(duration, unit), this.args);
  };

  limit(limitRuns: number): TimerDefinitionBuilder<A> {
    return new TimerDefinitionBuilder(this.timer.limit(limitRuns), this.args);
  }

  use<P extends AbstractClass[]>(...args: P): TimerDefinitionBuilder<P> {
    return new TimerDefinitionBuilder(this.timer, args);
  }

  do = callableSetter()
    .withContainerArgs(this.args)
    .map((callable) => new TimerDefinition(this.timer, callable));
}

export class TimerModule {
  register(): Definition[] {
    return [
      bind(TimerController),
      on(RegisterDefinitions)
        .use(TimerController)
        .do((event, controller) => {
          for (const definition of event.definitions) {
            if (definition instanceof TimerDefinition) {
              definition.register(event.container, event.container, controller);
            }
          }
        }),
      on(Startup)
        .use(TimerController)
        .do((_, controller) => controller.start()),
      on(Shutdown)
        .use(TimerController)
        .do((_, controller) => controller.stop()),
    ];
  }
}

export const every: DurationFunction<TimerDefinitionBuilder> = function (...args: unknown[]) {
  const [duration, unit] = args as [number, 'months'];
  return new TimerDefinitionBuilder(new Timer().and(duration, unit));
};
