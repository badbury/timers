import { every, TimerController } from '../src';

const timer = new TimerController();

timer.use(every('second').do(() => console.log('1 second tick')));

timer.start();
