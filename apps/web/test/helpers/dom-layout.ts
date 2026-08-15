/**
 * jsdom performs no layout, so every geometry read the log console relies on
 * comes back zero by default: `@tanstack/react-virtual` sizes its scroll
 * container from `offsetWidth`/`offsetHeight` on mount (not
 * `getBoundingClientRect`, despite that being the commonly-cited API - jsdom
 * hardcodes both to zero, and virtual-core already tolerates the missing
 * `ResizeObserver` via an early return so no polyfill is needed there), and
 * `LogConsole`'s own scroll-detach math reads `scrollHeight`/`scrollTop`/
 * `clientHeight` directly. jsdom also has no `Element.prototype.scrollTo` at
 * all, which the virtualizer calls whenever it programmatically scrolls to
 * the pinned-to-bottom row.
 *
 * Every one of these lives here, once, so production components stay free
 * of test-only props - the only affordances `LogConsole.tsx` adds are
 * `data-testid="log-row"` and `data-testid="log-viewport"`.
 */

/** Fixed "visible" height of the scroll container, in pixels. */
export const VIEWPORT_HEIGHT = 600;

/** Fixed "total content" height, comfortably larger than one viewport. */
const CONTENT_HEIGHT = 10_000;

let installed = false;

export function installDomLayoutStubs(): void {
  if (installed) return;
  installed = true;

  // `offsetWidth`/`offsetHeight` live on `HTMLElement.prototype`, not
  // `Element.prototype` - defining them one level too high in the chain
  // gets silently shadowed by jsdom's own zero-returning getters.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 800,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => VIEWPORT_HEIGHT,
  });
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get: () => VIEWPORT_HEIGHT,
  });
  Object.defineProperty(Element.prototype, 'scrollHeight', {
    configurable: true,
    get: () => CONTENT_HEIGHT,
  });

  Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: VIEWPORT_HEIGHT,
      width: 800,
      height: VIEWPORT_HEIGHT,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };

  Element.prototype.scrollTo = function scrollTo(): void {
    // No-op: jsdom has no layout engine, so there is nothing to scroll to.
    // Tests drive scroll position directly via `scrollTop`, which jsdom
    // already stores as an ordinary settable property.
  };
}
