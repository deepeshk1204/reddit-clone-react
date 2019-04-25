import "intersection-observer";
import _debounce from "lodash/debounce";
import _find from "lodash/find";

/**
 * Only invoke onUserInteractionEnd X seconds after the last scroll event.
 */
const VIEWPORT_TIMEOUT = 1 * 1000;

/**
 * Set of elements we know are currently visible on the page.
 */
const visibleElements = new Set();

/**
 * Tags whose content we don't care about.
 */
const ignoredTags = [
  "noscript",
  "SCRIPT",
  "OBJECT",
  "EMBED",
  "IMG",
  "IFRAME",
  "AUDIO",
  "VIDEO"
];

/**
 * Checks if an element or any of its children contains text
 * children but text.
 * @param DOMElement element
 * @returns Boolean
 */
const isElementWithText = element => {
  const hasOwnText = _find(element.childNodes, { nodeType: element.TEXT_NODE });
  return element.innerText !== "" && hasOwnText;
};

/**
 * Checks if an element has allowed tag.
 * @param DOMElement element
 * @returns Boolean
 */
const isElementWithAllowedTags = element => {
  return !ignoredTags.includes(element.tagName);
};

/**
 * Checks if `element`, and recursively its children, satisfies all criteria for
 * being added to the intersection monitor list, which is held in the `elements`
 * parameter.
 * If the element does not satisfy the criteria then its children are also
 * skipped.
 * @param DOMElement element
 * @param Array<DOMElement> elements
 */
let scanElementTreeRecursively = (element, elements) => {
  const computedStyle = getComputedStyle(element, null);
  const { position = computedStyle.position, display = computedStyle.display } =
    element.currentStyle || {};
  if (
    isElementWithAllowedTags(element) &&
    display !== "none" &&
    position !== "fixed"
  ) {
    elements.push(element);
    for (let child of element.children) {
      scanElementTreeRecursively(child, elements);
    }
  }
};

/**
 * Finds all elements in the DOM which that do not have one of the blacklisted
 * tags and satisfy all display and position properties criteria
 * @returns {Array<DOMElement>}
 */
const getElementsWithoutBlacklistedTags = () => {
  console.time("getElementsWithoutBlacklistedTags");
  const elements = [];
  window.parent.document
    .querySelectorAll(
      `body > *${ignoredTags.map(tag => `:not(${tag})`).join("")}`
    )
    .forEach(element => scanElementTreeRecursively(element, elements));

  console.timeEnd("getElementsWithoutBlacklistedTags");
  return elements;
};

/**
 * Captures the content we currently know is visible in the viewport and sends
 * the info back to the server.
 */
const getVisibleElementContent = () => {
  console.time("getVisibleElementContent");
  const content = {};
  for (let element of visibleElements) {
    content[element.tagName] = content[element.tagName] || [];
    // Why innerText? See https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent#Differences_from_innerText
    // specifically for not including hidden content.
    if (isElementWithText(element)) {
      content[element.tagName].push(element.innerText);
    }
  }
  console.timeEnd("getVisibleElementContent");
  console.log(
    `%cThe following text has been scraped:\n${JSON.stringify(
      content,
      null,
      4
    )}`,
    "color: purple; font-size: 10px; font-weight: 600; padding: 3px;"
  );
  return content;
};

/**
 * Handles an element's changing intersection with the viewport simply by
 * registering that element as intersecting.
 * @param {Array<IntersectionObserverEntry>} entries
 */
const onIntersectionChange = entries => {
  // FUTURE: Maybe use window.requestIdleCallback(callback[, options])
  for (let entry of entries) {
    if (entry.intersectionRatio >= 0.75) {
      visibleElements.add(entry.target);
    } else {
      visibleElements.delete(entry.target);
    }
  }
};

/**
 * Start keeping track of this element's visibility within the viewport.
 * @param DOMElement element
 */
const watchIntersection = element => {
  viewportIntersectionObserver.observe(element);
};

/**
 * Stop keeping track of this element's visibility within the viewport.
 * @param DOMElement element
 */
const unwatchIntersection = element => {
  viewportIntersectionObserver.unobserve(element);
};

/**
 * The single IntersectionObserver used to detect intersection changes with the
 * viewport.
 */
const viewportIntersectionObserver = new IntersectionObserver(
  onIntersectionChange,
  {
    // null = the browser viewport.
    root: null,
    // handler is called only when this intersection % threshold is crossed, in
    // either direction.
    threshold: 0.75
  }
);

const observeElementsInViewport = callback => {
  // Debounced user interaction handler that runs when we want to capture the
  // current content in the viewport.
  const onUserInteractionEnd = _debounce(
    // () => callback(getVisibleElementContent()),
    () => getVisibleElementContent(),
    VIEWPORT_TIMEOUT
  );

  // Register the hooks on which we want to capture the viewport.
  window.parent.document.addEventListener("scroll", onUserInteractionEnd);
  window.parent.document.addEventListener("click", onUserInteractionEnd);
  window.parent.document.addEventListener("load", onUserInteractionEnd);

  // Register the intersection observer on any element without blacklisted tag
  // in the page at the time this script runs.
  const elements = getElementsWithoutBlacklistedTags();
  console.log({ elements });
  for (let element of elements) {
    watchIntersection(element);
  }

  // Callback function to execute when mutations are observed.
  const onDOMMutation = mutationsList => {
    // XXX: should just re-parse the entire DOM in case e.g. elements changed
    // visibility?
    for (let mutation of mutationsList) {
      if (mutation.type === "childList") {
        for (let element of mutation.addedNodes) {
          // Do not observe elements that are not of the allowed tag
          if (isElementWithAllowedTags(element) && element instanceof Element) {
            watchIntersection(element);
          }
        }
        for (let element of mutation.removedNodes) {
          unwatchIntersection(element);
        }
      }
    }
  };

  // Create an observer instance linked to the callback function.
  const globalMutationObserver = new MutationObserver(onDOMMutation);

  // Start observing the entire document for additions/removals to their children
  // but not to attributes/etc.
  globalMutationObserver.observe(window.parent.document.body, {
    childList: true,
    subtree: true
  });
};

export default observeElementsInViewport;
