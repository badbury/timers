import {
  bind,
  Definition,
  emitUnknownValue,
  EventSink,
  on,
  RegisterDefinitions,
  ServiceLocator,
  Shutdown,
  Startup,
  Method,
  AbstractClass,
  AllInstanceType,
  Newable,
} from '@badbury/ioc';
import { Timer, TimerController, DurationFunction } from './timer-controller';

export abstract class TimerDefinition<A extends AbstractClass[] = []>
  implements Definition<TimerDefinition> {
  definition = TimerDefinition;
  constructor(public readonly timer: Timer) {}
  abstract register(resolver: ServiceLocator, controller: TimerController, sink: EventSink): void;
  abstract emit(): TimerDefinition<A>;
}

type FunctionOf<
  TArgsType extends AbstractClass[],
  TReturn = void,
  TArgs extends unknown[] = AllInstanceType<TArgsType>
> = (...args: TArgs) => TReturn;

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

  do(target: FunctionOf<A>): TimerDefinition;
  do<C extends Newable, M extends Method<C, A>>(target: C, method: M): TimerDefinition;
  do<C extends Newable, M extends Method<C, A>>(
    target: C | FunctionOf<A>,
    method?: M,
  ): TimerDefinition {
    return method
      ? new ClassTimerDefinition(this.timer, this.args, target as C, method)
      : new FunctionTimerDefinition(this.timer, this.args, target as FunctionOf<A>);
  }
}

export class ClassTimerDefinition<
  A extends AbstractClass[],
  V extends Newable,
  M extends Method<V, A>
> extends TimerDefinition {
  constructor(
    timer: Timer,
    public args: A,
    private listenerClass: V,
    private listenerMethod: M,
    private shouldEmitResponse: boolean = false,
  ) {
    super(timer);
  }

  register(resolver: ServiceLocator, controller: TimerController, sink: EventSink): void {
    const args = this.args.map((key) => resolver.get(key)) as AllInstanceType<A>;
    const handler = resolver.get(this.listenerClass);
    const timer = this.timer.do(() => {
      const result = handler[this.listenerMethod](...args);
      if (this.shouldEmitResponse) {
        emitUnknownValue(result, sink);
      }
    });
    controller.use(timer);
  }

  emit(): ClassTimerDefinition<A, V, M> {
    return new ClassTimerDefinition(
      this.timer,
      this.args,
      this.listenerClass,
      this.listenerMethod,
      true,
    );
  }
}

export class FunctionTimerDefinition<A extends AbstractClass[]> extends TimerDefinition {
  constructor(
    timer: Timer,
    public args: A,
    private handler: FunctionOf<A>,
    private shouldEmitResponse: boolean = false,
  ) {
    super(timer);
  }

  register(resolver: ServiceLocator, controller: TimerController, sink: EventSink): void {
    const args = this.args.map((key) => resolver.get(key)) as AllInstanceType<A>;
    const timer = this.timer.do(() => {
      const result = this.handler(...args);
      if (this.shouldEmitResponse) {
        emitUnknownValue(result, sink);
      }
    });
    controller.use(timer);
  }

  emit(): FunctionTimerDefinition<A> {
    return new FunctionTimerDefinition(this.timer, this.args, this.handler, true);
  }
}

export class TimerModule {
  register(): Definition[] {
    return [
      bind(TimerController),
      on(RegisterDefinitions)
        .use(TimerController, EventSink)
        .do((event, controller, sink) => {
          for (const definition of event.definitions) {
            if (definition instanceof TimerDefinition) {
              definition.register(event.container, controller, sink);
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
