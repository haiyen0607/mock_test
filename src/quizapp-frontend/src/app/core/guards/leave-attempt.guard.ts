import { CanDeactivateFn } from '@angular/router';

/** A page that may ask the user to confirm before leaving (e.g. an attempt in progress). */
export interface LeaveConfirmable {
  /** true = leave freely; false/Promise<false> = stay. */
  canLeave(): boolean | Promise<boolean>;
}

/** Asks before leaving the attempt page while the attempt is still in progress. */
export const leaveAttemptGuard: CanDeactivateFn<LeaveConfirmable> = (component) =>
  component?.canLeave ? component.canLeave() : true;
