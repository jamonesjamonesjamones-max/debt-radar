import "@testing-library/jest-dom";

if (typeof global.IntersectionObserver === "undefined") {
  global.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof window.matchMedia === "undefined") {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  });
}

if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
