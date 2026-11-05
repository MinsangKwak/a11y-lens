export type TargetBounds = { x: number; y: number; width: number; height: number };

export function observeTargetBounds(el: HTMLElement, send: (bounds: TargetBounds) => void): () => void {
  let frame = 0;
  let previous: TargetBounds | undefined;
  let disposed = false;

  const measure = () => {
    frame = 0;
    if (disposed) return;
    const rect = el.getBoundingClientRect();
    const next = {
      x: Math.round(rect.x), y: Math.round(rect.y),
      width: Math.round(rect.width), height: Math.round(rect.height),
    };
    if (previous && next.x === previous.x && next.y === previous.y &&
      next.width === previous.width && next.height === previous.height) return;
    previous = next;
    send(next);
  };

  // ResizeObserver와 resize가 같은 프레임에 와도 배치 측정과 IPC는 한 번만 한다.
  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(measure);
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(el);
  window.addEventListener('resize', schedule);
  schedule();

  return () => {
    disposed = true;
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    if (frame) cancelAnimationFrame(frame);
  };
}
