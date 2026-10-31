/**
 * Layout reads batched across every chart on the page. Each chart queues a read and the write
 * that uses it; all reads run before any write, so a page of charts is laid out once, not once
 * per chart (the gallery spent half a second in forced layouts on a phone). The queue empties
 * after the next frame is drawn, when the browser has just laid the page out, so the reads cost
 * nothing; or in the shared resize callback, which runs right after layout too. Until then a chart
 * works by its marks alone: the targets only enlarge them, and the points only place focus rings.
 */

interface Job {
  read: () => unknown;
  write: (value: unknown) => void;
}

let queue: Job[] = [];
let scheduled = false;

function flush(): void {
  scheduled = false;
  const jobs = queue;
  queue = [];
  const values = jobs.map((job) => job.read());
  jobs.forEach((job, i) => {
    job.write(values[i]);
  });
}

/** Runs `read`, then later `write` with what it read, beside every other chart's. */
export function measure<T>(read: () => T, write: (value: T) => void): void {
  queue.push({ read, write: write as (value: unknown) => void });
  if (scheduled) return;
  scheduled = true;
  // A task after the frame, not the frame's own callback: there the layout is still to come.
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(flush));
  else setTimeout(flush);
}

const resized = new Map<Element, () => void>();
let observer: ResizeObserver | null = null;

/**
 * Calls `run` when `element` changes size, and once when first observed. One observer serves every
 * chart, so the charts that resize together queue their reads in one callback and share one
 * layout. Returns the call that stops observing.
 */
export function onResize(element: Element, run: () => void): () => void {
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) resized.get(entry.target)?.();
    flush();
  });
  resized.set(element, run);
  observer.observe(element);
  return () => {
    resized.delete(element);
    observer?.unobserve(element);
  };
}
