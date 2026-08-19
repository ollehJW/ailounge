const BODY_LOCK_CLASS = "ai-lounge-modal-open";
let lockCount = 0;

export const lockBodyScroll = () => {
  if (typeof document === "undefined") return;
  lockCount += 1;
  document.body.classList.add(BODY_LOCK_CLASS);
};

export const unlockBodyScroll = () => {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.classList.remove(BODY_LOCK_CLASS);
};
