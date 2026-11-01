/**
 * Plays a chart as sound (B54): each series in turn, one note per mark in reading order, higher
 * as the mark's value is higher and panned from left to right with its place on the x axis. The
 * layer loads this module only when a reader presses Play, so pages that never play pay nothing.
 * It reads the drawing, not the data: the server maps values to positions, so a mark's far edge
 * (a bar's end away from its baseline, a point's center) orders and spaces the notes as the data
 * does. No dependency: Web Audio's oscillators.
 */

/** The lowest note (A3) and how many octaves the values span above it. */
const LOW_HZ = 220;
const OCTAVES = 2;
/** Each note's length, the silence after it and the pause between series, in seconds. */
const NOTE = 0.16;
const GAP = 0.04;
const PAUSE = 0.7;
const VOLUME = 0.2;

/** The element holding a mark's geometry: the mark, or the shape inside a linked mark. */
const shapeOf = (mark: Element): Element =>
  mark.hasAttribute("x") || mark.hasAttribute("cx") || !mark.firstElementChild
    ? mark
    : mark.firstElementChild;

/** The most common value, rounded to a pixel: the baseline the bars share. */
function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(Math.round(v), (counts.get(Math.round(v)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

/** Where each mark sits on the value axis, larger for a larger value, and where on the x axis. */
function read(marks: SVGGraphicsElement[], horizontal: boolean): { value: number; x: number }[] {
  const boxes = marks.map((m) => ({ box: m.getBBox(), bar: shapeOf(m).localName === "rect" }));
  const ends = (b: DOMRect): [number, number] =>
    horizontal ? [b.x, b.x + b.width] : [b.y, b.y + b.height];
  const base = mode(boxes.filter((b) => b.bar).flatMap((b) => ends(b.box)));
  return boxes.map(({ box, bar }) => {
    const [a, b] = ends(box);
    const end = bar ? (Math.abs(a - base) > Math.abs(b - base) ? a : b) : (a + b) / 2;
    return {
      value: horizontal ? end : -end,
      x: horizontal ? box.y + box.height / 2 : box.x + box.width / 2,
    };
  });
}

/**
 * Plays `series` (the figure's marks in reading order), calling `onSeries` with each series' name
 * as it starts when there are several, `onNote` as each mark sounds and `done` at the end.
 * Returns the stop, which silences it at once.
 */
export function play(
  figure: HTMLElement,
  series: SVGGraphicsElement[][],
  onSeries: (name: string) => void,
  onNote: (mark: SVGGraphicsElement) => void,
  done: () => void,
): () => void {
  const horizontal = figure.getAttribute("data-enarratio-orientation") === "horizontal";
  const readings = series.map((marks) => read(marks, horizontal));
  const all = readings.flat();
  const span = (pick: (r: { value: number; x: number }) => number): [number, number] => {
    const values = all.map(pick);
    return [Math.min(...values), Math.max(...values)];
  };
  const [low, high] = span((r) => r.value);
  const [left, right] = span((r) => r.x);
  const unit = (v: number, a: number, b: number): number => (b > a ? (v - a) / (b - a) : 0.5);

  const audio = new AudioContext();
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (time: number, run: () => void): void => {
    timers.push(setTimeout(run, Math.max(0, (time - audio.currentTime) * 1000)));
  };
  let time = audio.currentTime + 0.05;
  readings.forEach((notes, s) => {
    const name = series[s]?.[0]?.getAttribute("data-enarratio-series");
    if (name && series.length > 1) at(time, () => onSeries(name));
    notes.forEach((note, i) => {
      const tone = audio.createOscillator();
      tone.type = "triangle";
      tone.frequency.value = LOW_HZ * 2 ** (OCTAVES * unit(note.value, low, high));
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(VOLUME, time + 0.01);
      gain.gain.setValueAtTime(VOLUME, time + NOTE - 0.03);
      gain.gain.linearRampToValueAtTime(0, time + NOTE);
      const pan = audio.createStereoPanner();
      pan.pan.value = unit(note.x, left, right) * 1.6 - 0.8;
      tone.connect(gain).connect(pan).connect(audio.destination);
      tone.start(time);
      tone.stop(time + NOTE);
      const mark = series[s]?.[i];
      if (mark) at(time, () => onNote(mark));
      time += NOTE + GAP;
    });
    time += PAUSE;
  });
  const stop = (): void => {
    for (const t of timers.splice(0)) clearTimeout(t);
    void audio.close();
  };
  at(time - PAUSE, () => {
    stop();
    done();
  });
  return stop;
}
