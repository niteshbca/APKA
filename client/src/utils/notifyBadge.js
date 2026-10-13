// Tiny helpers so any screen can tell the navbar bell to refresh / pulse.
export function refreshNotifBadge() {
  window.dispatchEvent(new CustomEvent('pos:notify'));
}

/** Optimistic pulse while a notification send is in flight (billing). */
export function pulseNotifPending() {
  window.dispatchEvent(new CustomEvent('pos:notify-pending'));
}
