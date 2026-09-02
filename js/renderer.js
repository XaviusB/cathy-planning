/**
 * Breaks circular dependencies between modules that need renderAll
 * and modules that are imported by the calendar/view chain.
 * main.js wires the real implementation via setRenderAll().
 */
let _renderAll = () => {};

export function setRenderAll(fn) {
  _renderAll = fn;
}

export function renderAll() {
  _renderAll();
}
