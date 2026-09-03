import { timeToMin } from './date.js';

export function layoutOverlappingSlots(slots) {
  const lanes = [];
  const layout = new Map();

  [...slots]
    .sort((a, b) => timeToMin(a.start) - timeToMin(b.start) || timeToMin(a.end) - timeToMin(b.end))
    .forEach((slot) => {
      const start = timeToMin(slot.start);
      const end = timeToMin(slot.end);
      let lane = lanes.findIndex((lastEnd) => lastEnd <= start);
      if (lane < 0) {
        lane = lanes.length;
        lanes.push(end);
      } else {
        lanes[lane] = end;
      }
      layout.set(slot.id, { lane, laneCount: 0 });
    });

  const laneCount = Math.max(lanes.length, 1);
  layout.forEach((position) => {
    position.laneCount = laneCount;
  });
  return layout;
}
