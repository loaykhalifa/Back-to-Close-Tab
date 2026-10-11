// backbutton-close-tab.uc.js
// Back navigates normally when history exists; otherwise it closes the selected unpinned tab.
// Behavior: native Back when history exists; close only a historyless unpinned tab.
(function () {
    "use strict";

    const SCRIPT_NAME = "backbuttonCloseTabController";

    const previous = window[SCRIPT_NAME];
    if (previous && typeof previous.destroy === "function") {
        previous.destroy();
    }

    const CONFIG = Object.freeze({
        SWIPE_THRESHOLD_PX: 140,
        GESTURE_RESET_MS: 500,
        ACTION_COOLDOWN_MS: 900,
        HORIZONTAL_DOMINANCE_RATIO: 1.25,

        // Change to "right" only if your trackpad's Back direction is reversed.
        BACK_SWIPE_DIRECTION: "left",

        // Pinned tabs are protected. Unpinned tabs may close even when last.
        CLOSE_PINNED_TABS: false,

        DEBUG: false,

        CONTENT_SELECTORS: [
            "#zen-appcontent-wrapper",
            "#appcontent",
            "#browser"
        ]
    });

    const state = {
        isClosingTab: false,
        lastActionTime: 0,
        lastWheelTime: 0,
        gestureHandled: false,
        backDistance: 0,
        horizontalDistance: 0,
        verticalDistance: 0,
        gestureResetTimer: null,
        listeners: [],
        lastPointerX: null,
        lastPointerY: null,
        nativeSwipeStartedInContent: false
    };

    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log(`[${SCRIPT_NAME}]`, ...args);
        }
    }

    function addListener(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        state.listeners.push({ target, type, listener, options });
    }

    function suppressEvent(event) {
        if (event.cancelable) {
            event.preventDefault();
        }

        event.stopPropagation();

        if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
        }
    }

    function getSelectedBrowser() {
        return window.gBrowser?.selectedBrowser || null;
    }

    function getSelectedTab() {
        return window.gBrowser?.selectedTab || null;
    }

    function rememberPointerPosition(event) {
        if (
            Number.isFinite(event.clientX) &&
            Number.isFinite(event.clientY)
        ) {
            state.lastPointerX = event.clientX;
            state.lastPointerY = event.clientY;
        }
    }

    function getGesturePoint(event) {
        // Some MozSwipeGesture events do not expose useful client
        // coordinates. Fall back to the most recent pointer location.
        if (
            Number.isFinite(event?.clientX) &&
            Number.isFinite(event?.clientY) &&
            (event.clientX !== 0 || event.clientY !== 0)
        ) {
            return { x: event.clientX, y: event.clientY };
        }

        if (
            Number.isFinite(event?.screenX) &&
            Number.isFinite(event?.screenY) &&
            Number.isFinite(window.mozInnerScreenX) &&
            Number.isFinite(window.mozInnerScreenY) &&
            (event.screenX !== 0 || event.screenY !== 0)
        ) {
            return {
                x: event.screenX - window.mozInnerScreenX,
                y: event.screenY - window.mozInnerScreenY
            };
        }

        if (
            Number.isFinite(state.lastPointerX) &&
            Number.isFinite(state.lastPointerY)
        ) {
            return {
                x: state.lastPointerX,
                y: state.lastPointerY
            };
        }

        return null;
    }

    function isPointerOverWebPage(event) {
        const browser = getSelectedBrowser();
        const point = getGesturePoint(event);

        if (!browser || !point) return false;

        const rect = browser.getBoundingClientRect();

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            point.x >= rect.left &&
            point.x < rect.right &&
            point.y >= rect.top &&
            point.y < rect.bottom
        );
    }

    // true: can navigate back, false: no history, null: could not determine safely.
    function getCanGoBack() {
        try {
            const webNavigation = getSelectedBrowser()?.webNavigation;
            if (!webNavigation) return null;

            const value = webNavigation.canGoBack;
            return typeof value === "function"
                ? Boolean(value.call(webNavigation))
                : Boolean(value);
        } catch (error) {
            log("Could not read navigation state:", error);
            return null;
        }
    }

    function canCloseCurrentTab() {
        const tab = getSelectedTab();

        if (!tab || tab.closing || state.isClosingTab) {
            return false;
        }

        if (!CONFIG.CLOSE_PINNED_TABS && tab.pinned) {
            return false;
        }

        // Deliberately no last-tab guard: an unpinned final tab may close.
        return true;
    }

    function shouldCloseCurrentTab() {
        return getCanGoBack() === false && canCloseCurrentTab();
    }

    function isCoolingDown() {
        return Date.now() - state.lastActionTime < CONFIG.ACTION_COOLDOWN_MS;
    }

    function closeCurrentTab() {
        const tab = getSelectedTab();
        if (!tab || !canCloseCurrentTab()) return false;

        state.isClosingTab = true;

        try {
            window.gBrowser.removeTab(tab, { animate: true });
            log("Closed unpinned tab because no Back history was available.");
            return true;
        } catch (error) {
            console.error(`[${SCRIPT_NAME}] Failed to close tab:`, error);
            return false;
        } finally {
            window.setTimeout(() => {
                state.isClosingTab = false;
            }, 400);
        }
    }

    // Used by keyboard, BrowserBack, toolbar button, and Browser:Back.
    function handleCloseInsteadOfBack() {
        // Let Zen handle Back natively whenever history exists.
        // Replace Back with Close only when history is definitely unavailable.
        if (!shouldCloseCurrentTab()) return false;

        // Consume duplicate events generated by the same physical action.
        if (isCoolingDown()) return true;

        if (closeCurrentTab()) {
            state.lastActionTime = Date.now();
            return true;
        }

        return false;
    }

    // Trackpad gestures are handled fully here to avoid Back followed by Close.
    function handleSwipeBackIntent() {
        const canGoBack = getCanGoBack();

        // Never navigate manually. Zen keeps full control of native history.
        if (canGoBack === true || canGoBack === null) {
            return false;
        }

        // Only a historyless, unpinned tab is closed.
        if (isCoolingDown()) return true;

        if (closeCurrentTab()) {
            state.lastActionTime = Date.now();
            return true;
        }

        return false;
    }

    function isKeyboardBackShortcut(event) {
        return (
            event.key === "BrowserBack" ||
            (
                event.altKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.shiftKey &&
                event.key === "ArrowLeft"
            )
        );
    }

    function eventPathContains(event, predicate) {
        const path = typeof event.composedPath === "function"
            ? event.composedPath()
            : [event.target];

        return path.some(node => {
            try {
                return predicate(node);
            } catch (_) {
                return false;
            }
        });
    }

    function isBackButtonEvent(event) {
        return eventPathContains(
            event,
            node =>
                node?.id === "back-button" ||
                node?.getAttribute?.("command") === "Browser:Back" ||
                node?.getAttribute?.("command") === "Browser:BackOrBackDuplicate"
        );
    }

    function isBrowserBackCommand(event) {
        return eventPathContains(
            event,
            node =>
                node?.id === "Browser:Back" ||
                node?.id === "Browser:BackOrBackDuplicate"
        );
    }

    function onKeyDown(event) {
        if (
            !event.isTrusted ||
            event.defaultPrevented ||
            !isKeyboardBackShortcut(event)
        ) {
            return;
        }

        if (handleCloseInsteadOfBack()) {
            suppressEvent(event);
        }
    }

    // Pointer-down also catches a visually disabled Back button.
    function onPointerDown(event) {
        if (
            !event.isTrusted ||
            event.button !== 0 ||
            !isBackButtonEvent(event)
        ) {
            return;
        }

        if (handleCloseInsteadOfBack()) {
            suppressEvent(event);
        }
    }

    function onClick(event) {
        if (!event.isTrusted || !isBackButtonEvent(event)) return;

        if (handleCloseInsteadOfBack()) {
            suppressEvent(event);
        }
    }

    function onCommand(event) {
        if (!isBrowserBackCommand(event)) return;

        if (handleCloseInsteadOfBack()) {
            suppressEvent(event);
        }
    }

    // Zen/Firefox uses native macOS MozSwipeGesture events. When a tab has
    // no history, Zen normally rejects the gesture before a final swipe event
    // is generated. Claim that direction so it can become Close Tab.
    function isNativeBackSwipe(event) {
        return (
            typeof event.DIRECTION_LEFT === "number" &&
            event.direction === event.DIRECTION_LEFT
        );
    }

    function onNativeSwipeMayStart(event) {
        if (!event.isTrusted || !isNativeBackSwipe(event)) return;

        state.nativeSwipeStartedInContent = isPointerOverWebPage(event);

        // Never claim or modify gestures that start over tabs, the sidebar,
        // toolbars, menus, or any other browser interface.
        if (!state.nativeSwipeStartedInContent) {
            return;
        }

        if (isCoolingDown()) {
            event.allowedDirections = event.DIRECTION_LEFT;
            if (event.cancelable) {
                event.preventDefault();
            }
            return;
        }

        if (shouldCloseCurrentTab()) {
            event.allowedDirections = event.DIRECTION_LEFT;
            if (event.cancelable) {
                event.preventDefault();
            }
        }
    }

    function onNativeSwipe(event) {
        if (!event.isTrusted || !isNativeBackSwipe(event)) return;

        const startedInContent =
            state.nativeSwipeStartedInContent ||
            isPointerOverWebPage(event);

        state.nativeSwipeStartedInContent = false;

        // Leave sidebar and browser-interface gestures entirely to Zen.
        if (!startedInContent) {
            return;
        }

        if (isCoolingDown()) {
            suppressEvent(event);
            return;
        }

        const canGoBack = getCanGoBack();

        if (canGoBack === true) {
            state.lastActionTime = Date.now();
            return;
        }

        if (canGoBack === false && closeCurrentTab()) {
            state.lastActionTime = Date.now();
            suppressEvent(event);
        }
    }

    function getContentRoot() {
        for (const selector of CONFIG.CONTENT_SELECTORS) {
            const element = document.querySelector(selector);
            if (element) return element;
        }

        return null;
    }

    function isContentWheelEvent(event) {
        const contentRoot = getContentRoot();
        return Boolean(contentRoot && contentRoot.contains(event.target));
    }

    function normalizeWheelDelta(event) {
        let multiplier = 1;

        if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
            multiplier = 16;
        } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
            multiplier = Math.max(window.innerWidth, window.innerHeight);
        }

        return {
            x: event.deltaX * multiplier,
            y: event.deltaY * multiplier
        };
    }

    function resetGesture() {
        state.lastWheelTime = 0;
        state.gestureHandled = false;
        state.backDistance = 0;
        state.horizontalDistance = 0;
        state.verticalDistance = 0;

        if (state.gestureResetTimer !== null) {
            window.clearTimeout(state.gestureResetTimer);
            state.gestureResetTimer = null;
        }
    }

    function scheduleGestureReset() {
        if (state.gestureResetTimer !== null) {
            window.clearTimeout(state.gestureResetTimer);
        }

        state.gestureResetTimer = window.setTimeout(
            resetGesture,
            CONFIG.GESTURE_RESET_MS
        );
    }

    function isBackDirection(deltaX) {
        return CONFIG.BACK_SWIPE_DIRECTION === "right"
            ? deltaX > 0
            : deltaX < 0;
    }

    function onWheel(event) {
        // Ctrl+wheel is commonly trackpad pinch-to-zoom.
        if (
            !event.isTrusted ||
            event.defaultPrevented ||
            event.ctrlKey ||
            !isPointerOverWebPage(event)
        ) {
            return;
        }

        const now = Date.now();

        if (now - state.lastWheelTime > CONFIG.GESTURE_RESET_MS) {
            resetGesture();
        }

        state.lastWheelTime = now;
        scheduleGestureReset();

        if (state.gestureHandled) return;

        const { x, y } = normalizeWheelDelta(event);
        if (x === 0) return;

        const absX = Math.abs(x);
        const absY = Math.abs(y);

        state.horizontalDistance += absX;
        state.verticalDistance += absY;

        if (isBackDirection(x)) {
            state.backDistance += absX;
        } else {
            // Shaky movement in the opposite direction reduces progress.
            state.backDistance = Math.max(
                0,
                state.backDistance - absX * 1.5
            );
        }

        const isMostlyHorizontal =
            state.horizontalDistance >=
            state.verticalDistance * CONFIG.HORIZONTAL_DOMINANCE_RATIO;

        if (
            isMostlyHorizontal &&
            state.backDistance >= CONFIG.SWIPE_THRESHOLD_PX
        ) {
            state.gestureHandled = true;

            if (handleSwipeBackIntent()) {
                suppressEvent(event);
            }
        }
    }

    function destroy() {
        for (const { target, type, listener, options } of state.listeners.splice(0)) {
            try {
                target.removeEventListener(type, listener, options);
            } catch (_) {}
        }

        resetGesture();

        if (window[SCRIPT_NAME] === api) {
            delete window[SCRIPT_NAME];
        }

        log("Destroyed.");
    }

    const api = Object.freeze({
        config: CONFIG,
        getCanGoBack,
        destroy
    });

    window[SCRIPT_NAME] = api;

    addListener(window, "keydown", onKeyDown, true);
    addListener(window, "pointerdown", onPointerDown, true);
    addListener(window, "click", onClick, true);
    addListener(window, "command", onCommand, true);
    addListener(window, "MozSwipeGestureMayStart", onNativeSwipeMayStart, {
        capture: true,
        passive: false
    });
    addListener(window, "MozSwipeGesture", onNativeSwipe, {
        capture: true,
        passive: false
    });
    addListener(window, "pointermove", rememberPointerPosition, {
        capture: true,
        passive: true
    });
    addListener(window, "wheel", onWheel, {
        capture: true,
        passive: false
    });
    addListener(window, "unload", destroy, { once: true });

    console.log(
        `[${SCRIPT_NAME}] Loaded — Back closes unpinned tabs without history; ` +
        `swipe threshold: ${CONFIG.SWIPE_THRESHOLD_PX}px.`
    );
})();

// zen-btt-glance-state.uc.js
// Sends GLANCE or NORMAL to BetterTouchTool variable "zen_tab_type".
(function () {
    "use strict";

    const SCRIPT_NAME = "zenBTTGlanceState";
    const VARIABLE_NAME = "zen_tab_type";
    const DEBOUNCE_MS = 40;

    const previous = window[SCRIPT_NAME];
    if (previous && typeof previous.destroy === "function") {
        previous.destroy();
    }

    let observer = null;
    let timer = null;
    let retryTimer = null;
    let lastState = null;
    let destroyed = false;
    const listeners = [];

    function addListener(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        listeners.push({ target, type, listener, options });
    }

    function getState() {
        const selectedTab = window.gBrowser?.selectedTab;
        const selectedGlance = document.querySelector(
            'tab[zen-glance-tab][selected="true"], tab[zen-glance-tab][selected]'
        );

        return (
            selectedTab?.hasAttribute?.("zen-glance-tab") ||
            Boolean(selectedGlance)
        ) ? "GLANCE" : "NORMAL";
    }

    async function notifyBTT(force = false) {
        if (destroyed) return;

        const state = getState();
        if (!force && state === lastState) return;

        const url =
            "btt://set_string_variable/?" +
            "variableName=" + encodeURIComponent(VARIABLE_NAME) +
            "&to=" + encodeURIComponent(state);

        try {
            const { Subprocess } = ChromeUtils.importESModule(
                "resource://gre/modules/Subprocess.sys.mjs"
            );

            await Subprocess.call({
                command: "/usr/bin/open",
                arguments: ["-g", url]
            });

            lastState = state;
            console.log(
                `[${SCRIPT_NAME}] BetterTouchTool state: ${state}`
            );
        } catch (error) {
            console.error(
                `[${SCRIPT_NAME}] Could not notify BetterTouchTool:`,
                error
            );
        }
    }

    function scheduleUpdate(force = false) {
        if (timer !== null) {
            window.clearTimeout(timer);
        }

        timer = window.setTimeout(() => {
            timer = null;
            notifyBTT(force);
        }, DEBOUNCE_MS);
    }

    function start() {
        if (destroyed) return;

        if (!window.gBrowser || !document.documentElement) {
            retryTimer = window.setTimeout(start, 250);
            return;
        }

        observer = new MutationObserver(() => scheduleUpdate());

        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: [
                "selected",
                "zen-glance-tab"
            ]
        });

        addListener(
            window.gBrowser.tabContainer,
            "TabSelect",
            () => scheduleUpdate(),
            true
        );
        addListener(window, "focus", () => scheduleUpdate(true), true);
        addListener(window, "unload", destroy, { once: true });

        scheduleUpdate(true);
        console.log(
            `[${SCRIPT_NAME}] Loaded — syncing Zen Glance state to BTT.`
        );
    }

    function destroy() {
        destroyed = true;

        if (observer) {
            observer.disconnect();
            observer = null;
        }

        if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
        }

        if (retryTimer !== null) {
            window.clearTimeout(retryTimer);
            retryTimer = null;
        }

        for (const { target, type, listener, options } of listeners.splice(0)) {
            try {
                target.removeEventListener(type, listener, options);
            } catch (_) {}
        }

        if (window[SCRIPT_NAME] === api) {
            delete window[SCRIPT_NAME];
        }
    }

    const api = Object.freeze({
        getState,
        notifyBTT,
        destroy
    });

    window[SCRIPT_NAME] = api;
    start();
})();
