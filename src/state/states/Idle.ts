
import { events } from '../../core/EventBus';
import type { SpinService } from '../../services/SpinService';

export class IdleStateController {
  constructor(private spinService: SpinService) {
    events.on('SPIN_REQUESTED', async () => {
      events.emit('SPIN_STARTED', undefined);
      const result = await this.spinService.requestSpin();
      events.emit('SPIN_RESULT', result);
    });
  }
}
