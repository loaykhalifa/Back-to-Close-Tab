// backbutton-close-tab.uc.js
// Close the current tab when Back is triggered and no back history exists.
(function () {
    "use strict";

    const SCRIPT_NAME = "backbuttonCloseTab";

    // Remove listeners from a previously loaded copy.
    const previousInstance = window[SCRIPT_NAME];
    if (previousInstance && typeof previousInstance.destroy === "function") {
        previousInstance.destroy();
    }

    const CONFIG = Object.freeze({
        // Trackpad settings
        SWIPE_THRESHOLD_PX: 140,
        GESTURE_RESET_MS: 260,
        ACTION_COOLDOWN_MS: 550,
        HORIZONTAL_DOMINANCE_RATIO: 1.25,

        // Change to "right" if your trackpad direction is reversed.
        BACK_SWIPE_DIRECTION: "left",

        // Safety options
        CLOSE_PINNED_TABS: false,
        CLOSE_LAST_TAB: false,

        DEBUG: false,

        // Zen Browser and Firefox content containers.
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

        listeners: []
    };

    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log(`[${SCRIPT_NAME}]`, ...args);
        }
    }

    function addListener(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        state.listeners.push({
            target,
            type,
            listener,
            options
        });
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

    /**
     * Returns:
     * true  = tab can go back
     * false = tab cannot go back
     * null  = navigation state could not be determined safely
     */
    function getCanGoBack() {
        try {
            const webNavigation = getSelectedBrowser()?.webNavigation;

            if (!webNavigation) {
                return null;
            }

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

        if (!tab || state.isClosingTab || tab.closing) {
            return false;
        }

        if (!CONFIG.CLOSE_PINNED_TABS && tab.pinned) {
            return false;
        }

        const tabCount = window.gBrowser?.tabs?.length ?? 0;

        if (!CONFIG.CLOSE_LAST_TAB && tabCount <= 1) {
            return false;
        }

        return true;
    }

    function shouldCloseCurrentTab() {
        return getCanGoBack() === false && canCloseCurrentTab();
    }

    function isCoolingDown() {
        return (
            Date.now() - state.lastActionTime <
            CONFIG.ACTION_COOLDOWN_MS
        );
    }

    function closeCurrentTab() {
        const tab = getSelectedTab();

        if (!tab || !canCloseCurrentTab()) {
            return false;
        }

        state.isClosingTab = true;

        try {
            window.gBrowser.removeTab(tab, {
                animate: true
            });

            log("Closed tab because no back history was available.");
            return true;
        } catch (error) {
            state.isClosingTab = false;
            console.error(
                `[${SCRIPT_NAME}] Failed to close tab:`,
                error
            );

            return false;
        } finally {
            window.setTimeout(() => {
                state.isClosingTab = false;
            }, 400);
        }
    }

    /**
     * Used for:
     * - Alt + Left
     * - Browser Back key
     * - Toolbar Back button
     * - Browser:Back command
     *
     * When history exists, Firefox/Zen handles Back normally.
     */
    function handleCloseInsteadOfBack() {
        if (!shouldCloseCurrentTab()) {
            return false;
        }

        // Swallow duplicated click/command events.
        if (isCoolingDown()) {
            return true;
        }

        if (closeCurrentTab()) {
            state.lastActionTime = Date.now();
            return true;
        }

        return false;
    }

    /**
     * Trackpad gestures are fully handled here so one physical
     * gesture cannot navigate back and then close the tab.
     */
    function handleSwipeBackIntent() {
        if (isCoolingDown()) {
            return true;
        }

        const canGoBack = getCanGoBack();

        if (canGoBack === true) {
            try {
                getSelectedBrowser().webNavigation.goBack();
                state.lastActionTime = Date.now();

                log("Navigated back.");
                return true;
            } catch (error) {
                console.error(
                    `[${SCRIPT_NAME}] Failed to navigate back:`,
                    error
                );

                return false;
            }
        }

        if (canGoBack === false && closeCurrentTab()) {
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
                event.key === "ArrowLeft"
            )
        );
    }

    function eventPathContains(event, predicate) {
        const path =
            typeof event.composedPath === "function"
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
                node?.getAttribute?.("command") === "Browser:Back"
        );
    }

    function isBrowserBackCommand(event) {
        return eventPathContains(
            event,
            node => node?.id === "Browser:Back"
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

    /**
     * Pointer-down can detect the Back button even when the browser
     * visually disables it because there is no history.
     */
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
        if (
            !event.isTrusted ||
            !isBackButtonEvent(event)
        ) {
            return;
        }

        if (handleCloseInsteadOfBack()) {
            suppressEvent(event);
        }
    }

    function onCommand(event) {
        if (!isBrowserBackCommand(event)) {
            return;
        }

        if (handleCloseInsteadOfBack()) {
            suppressEvent(event);
        }
    }

    function getContentRoot() {
        for (const selector of CONFIG.CONTENT_SELECTORS) {
            const element = document.querySelector(selector);

            if (element) {
                return element;
            }
        }

        return null;
    }

    function isContentWheelEvent(event) {
        const contentRoot = getContentRoot();

        return Boolean(
            contentRoot &&
            contentRoot.contains(event.target)
        );
    }

    function normalizeWheelDelta(event) {
        let multiplier = 1;

        if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
            multiplier = 16;
        } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
            multiplier = Math.max(
                window.innerWidth,
                window.innerHeight
            );
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
        // Ctrl + wheel is often pinch-to-zoom on trackpads.
        if (
            !event.isTrusted ||
            event.defaultPrevented ||
            event.ctrlKey ||
            !isContentWheelEvent(event)
        ) {
            return;
        }

        const now = Date.now();

        if (
            now - state.lastWheelTime >
            CONFIG.GESTURE_RESET_MS
        ) {
            resetGesture();
        }

        state.lastWheelTime = now;
        scheduleGestureReset();

        if (state.gestureHandled) {
            return;
        }

        const { x, y } = normalizeWheelDelta(event);

        if (x === 0) {
            return;
        }

        const absX = Math.abs(x);
        const absY = Math.abs(y);

        state.horizontalDistance += absX;
        state.verticalDistance += absY;

        /*
         * Opposite-direction movement reduces the accumulated
         * distance, preventing shaky gestures from firing.
         */
        if (isBackDirection(x)) {
            state.backDistance += absX;
        } else {
            state.backDistance = Math.max(
                0,
                state.backDistance - absX * 1.5
            );
        }

        const isMostlyHorizontal =
            state.horizontalDistance >=
            state.verticalDistance *
                CONFIG.HORIZONTAL_DOMINANCE_RATIO;

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
        for (
            const {
                target,
                type,
                listener,
                options
            } of state.listeners.splice(0)
        ) {
            try {
                target.removeEventListener(
                    type,
                    listener,
                    options
                );
            } catch (_) {
                // Ignore cleanup errors during browser shutdown.
            }
        }

        resetGesture();

        if (window[SCRIPT_NAME] === api) {
            delete window[SCRIPT_NAME];
        }

        log("Destroyed.");
    }

    const api = Object.freeze({
        config: CONFIG,
        destroy
    });

    window[SCRIPT_NAME] = api;

    addListener(window, "keydown", onKeyDown, true);
    addListener(window, "pointerdown", onPointerDown, true);
    addListener(window, "click", onClick, true);
    addListener(window, "command", onCommand, true);

    addListener(window, "wheel", onWheel, {
        capture: true,
        passive: false
    });

    addListener(window, "unload", destroy, {
        once: true
    });

    console.log(
        `[${SCRIPT_NAME}] Loaded — Back closes tabs with no history; ` +
        `swipe threshold: ${CONFIG.SWIPE_THRESHOLD_PX}px.`
    );
})();
