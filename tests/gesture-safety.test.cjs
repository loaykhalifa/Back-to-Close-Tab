"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.join(__dirname, "..", "backbutton-close-tab.uc.js"), "utf8"
);
new vm.Script(source);

function setup() {
    const listeners = new Map();
    const timers = new Map();
    let timerId = 0;
    let now = 10000;
    let hit;
    let focused = true;
    let closed = 0;
    const tab = { pinned: false, closing: false };
    const browser = {
        isConnected: true,
        webNavigation: { canGoBack: false },
        getBoundingClientRect: () => ({
            left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600
        })
    };
    hit = browser;
    const window = {
        gBrowser: {
            selectedBrowser: browser, selectedTab: tab,
            removeTab: selected => {
                assert.equal(selected, window.gBrowser.selectedTab);
                closed++;
            }
        },
        setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; },
        clearTimeout: id => timers.delete(id),
        addEventListener: (type, fn) => listeners.set(type, fn),
        removeEventListener: (type, fn) => {
            if (listeners.get(type) === fn) listeners.delete(type);
        }
    };
    const document = {
        hidden: false,
        hasFocus: () => focused,
        elementFromPoint: () => hit
    };
    vm.runInNewContext(source, {
        window, document,
        WheelEvent: { DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2 },
        console: { log() {}, error() {} },
        Date: { now: () => now }
    });
    function event(extra = {}) {
        return Object.assign({
            isTrusted: true, clientX: 100, clientY: 100,
            cancelable: true, defaultPrevented: false,
            direction: 1, DIRECTION_LEFT: 1,
            deltaX: -160, deltaY: 0, deltaMode: 0, ctrlKey: false,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() {}, stopImmediatePropagation() {}
        }, extra);
    }
    return {
        window, document, browser, tab, event,
        fire: (type, extra) => {
            const e = event(extra);
            listeners.get(type)?.(e);
            return e;
        },
        hit: value => { hit = value; },
        focus: value => { focused = value; },
        advance: ms => { now += ms; },
        closed: () => closed
    };
}

let passed = 0;
function test(name, run) {
    run(setup());
    passed++;
    console.log("PASS " + name);
}
function nativeStart(s) { return s.fire("MozSwipeGestureMayStart"); }
function nativeEnd(s) { return s.fire("MozSwipeGesture"); }

test("native page swipe closes one historyless tab", s => {
    nativeStart(s); nativeEnd(s);
    assert.equal(s.closed(), 1);
    nativeEnd(s);
    assert.equal(s.closed(), 1);
});
test("Spaces hit inside the page rectangle is ignored", s => {
    s.hit({ id: "mock-spaces" });
    assert.equal(nativeStart(s).defaultPrevented, false);
    assert.equal(nativeEnd(s).defaultPrevented, false);
    assert.equal(s.closed(), 0);
});
test("native completion without a verified start is ignored", s => {
    nativeEnd(s);
    assert.equal(s.closed(), 0);
});
test("native completion over an overlay is ignored", s => {
    nativeStart(s); s.hit({}); nativeEnd(s);
    assert.equal(s.closed(), 0);
});
test("tab change during native swipe cannot close the new tab", s => {
    nativeStart(s);
    s.window.gBrowser.selectedTab = { pinned: false };
    nativeEnd(s);
    assert.equal(s.closed(), 0);
});
test("browser change during native swipe is rejected", s => {
    nativeStart(s);
    s.window.gBrowser.selectedBrowser = { ...s.browser };
    s.hit(s.window.gBrowser.selectedBrowser);
    nativeEnd(s);
    assert.equal(s.closed(), 0);
});
test("expired native swipe is rejected", s => {
    nativeStart(s); s.advance(2001); nativeEnd(s);
    assert.equal(s.closed(), 0);
});
test("pinned tab is protected", s => {
    s.tab.pinned = true;
    nativeStart(s); nativeEnd(s); s.fire("wheel");
    assert.equal(s.closed(), 0);
});
test("unknown history never authorizes closing", s => {
    s.browser.webNavigation.canGoBack = undefined;
    nativeStart(s); nativeEnd(s); s.fire("wheel");
    assert.equal(s.closed(), 0);
});
test("native navigation with history is left to Zen", s => {
    s.browser.webNavigation.canGoBack = true;
    assert.equal(nativeStart(s).defaultPrevented, false);
    assert.equal(nativeEnd(s).defaultPrevented, false);
    assert.equal(s.closed(), 0);
});
test("hidden document rejects gestures", s => {
    s.document.hidden = true;
    nativeStart(s); nativeEnd(s); s.fire("wheel");
    assert.equal(s.closed(), 0);
});
test("unfocused document rejects gestures", s => {
    s.focus(false);
    nativeStart(s); nativeEnd(s); s.fire("wheel");
    assert.equal(s.closed(), 0);
});
test("pointer outside the page cannot arm a native close", s => {
    s.fire("MozSwipeGestureMayStart", { clientX: 900 });
    nativeEnd(s);
    assert.equal(s.closed(), 0);
});
test("disconnected browser rejects gestures", s => {
    s.browser.isConnected = false;
    nativeStart(s); nativeEnd(s); s.fire("wheel");
    assert.equal(s.closed(), 0);
});
test("wheel on a historyless page closes once per burst", s => {
    s.fire("wheel"); s.fire("wheel");
    assert.equal(s.closed(), 1);
});
test("wheel burst starting over Spaces stays rejected on page", s => {
    s.hit({}); s.fire("wheel");
    s.hit(s.browser); s.fire("wheel");
    assert.equal(s.closed(), 0);
});
test("wheel burst crossing browser UI stays rejected", s => {
    s.fire("wheel", { deltaX: -30 });
    s.hit({}); s.fire("wheel");
    s.hit(s.browser); s.fire("wheel");
    assert.equal(s.closed(), 0);
});
test("wheel burst cannot Back then close after history changes", s => {
    s.browser.webNavigation.canGoBack = true;
    s.fire("wheel", { deltaX: -30 });
    s.browser.webNavigation.canGoBack = false;
    s.fire("wheel");
    assert.equal(s.closed(), 0);
});
test("wheel burst cannot close a newly selected tab", s => {
    s.fire("wheel", { deltaX: -30 });
    s.window.gBrowser.selectedTab = { pinned: false };
    s.fire("wheel");
    assert.equal(s.closed(), 0);
});
test("vertical wheel movement does not close", s => {
    s.fire("wheel", { deltaX: -20, deltaY: 200 });
    assert.equal(s.closed(), 0);
});
test("Ctrl+wheel does not close", s => {
    s.fire("wheel", { ctrlKey: true });
    assert.equal(s.closed(), 0);
});
test("default-prevented wheel event does not close", s => {
    s.fire("wheel", { defaultPrevented: true });
    assert.equal(s.closed(), 0);
});
test("untrusted events do not close", s => {
    s.fire("wheel", { isTrusted: false });
    s.fire("MozSwipeGestureMayStart", { isTrusted: false });
    nativeEnd(s);
    assert.equal(s.closed(), 0);
});
test("blur disarms an already started native swipe", s => {
    nativeStart(s); s.fire("blur"); nativeEnd(s);
    assert.equal(s.closed(), 0);
});
test("keyboard Back still works with pointer over browser UI", s => {
    s.hit({});
    s.fire("keydown", {
        key: "ArrowLeft", altKey: true,
        ctrlKey: false, metaKey: false, shiftKey: false
    });
    assert.equal(s.closed(), 1);
});
test("destroy removes registered listeners", s => {
    s.window.backbuttonCloseTabController.destroy();
    s.fire("wheel");
    assert.equal(s.closed(), 0);
    assert.equal(s.window.backbuttonCloseTabController, undefined);
});

console.log("\n" + passed + " mocked regression tests passed.");
