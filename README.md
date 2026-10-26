# Back to Close Tab

**Go back when you can. Close the tab when you can’t.**

A mod for **Zen Browser** that makes Back useful when there is nowhere left to go. If the current tab has a previous page, Back works normally. Otherwise, it closes the **unpinned tab**.

> [!WARNING]
> Going Back can close a tab, including the last unpinned tab in a window. Save important work before testing. Pinned tabs are protected by default.

## Features

- Navigate back normally when history exists.
- Close unpinned tabs when there is no Back history.
- Keep pinned tabs protected by default.
- Handle page gestures only when the pointer is over the actual selected web page.
- Leave gestures over Spaces, the sidebar, toolbars, and detected overlays to Zen.
- Reduce duplicate actions with gesture and cooldown safeguards.

## How it works

| Current tab | Back action |
|---|---|
| Has a previous page | Returns to that page normally. |
| Has no previous page and is unpinned | Closes the tab. |
| Has no previous page and is pinned | Keeps the tab open with default settings. |
| Navigation state cannot be determined | Does not close the tab based on an unknown state. |

“History” means the **current tab’s session navigation history**, not your browser’s overall browsing-history database.

```text
Open Page A in a new tab
          ↓
Follow a link to Page B in the same tab
          ↓
Back → Page A
          ↓
Wait briefly, then Back again → close the tab
```

## Requirements

- **Zen Browser**
- A compatible privileged browser-interface JavaScript loader, such as **[Sine](https://github.com/CosmoCreeper/Sine)** with its bootloader

This is a **userChrome-style JavaScript script**, not a standard browser extension, CSS theme, or website userscript. It must run in the browser interface rather than inside a website.

No minimum Zen or Sine version is currently specified. Compatibility with other browsers, operating systems, and trackpads is not guaranteed.

## Installation

### 1. Back up your existing setup

Open `about:support` in Zen and locate **Profile Folder**. Quit Zen before backing up your profile or existing mod folder.

Keep backups **outside active mod/script directories** to avoid loading duplicate scripts.

### 2. Install Sine

Follow the [official Sine instructions](https://github.com/CosmoCreeper/Sine) and [installation guide](https://github.com/sineorg/docs/blob/main/src/installation.md). Choose the appropriate installer from [Sine releases](https://github.com/CosmoCreeper/Sine/releases), install it for your active Zen profile, and restart the browser.

Confirm that **Sine** appears in Zen Settings.

### 3. Add the mod

1. Open **Zen Settings → Sine**.
2. Find the option to install a mod from a GitHub repository.
3. Enter:

   ```text
   loaykhalifa/Back-to-Close-Tab
   ```

4. Follow the prompts and enable the mod.
5. Fully quit and reopen Zen.

![Installing Back to Close Tab in Zen Settings](docs/images/installation.jpg)

> [!NOTE]
> Interface labels and standalone-script support vary by Sine version. This repository has no separate mod manifest. If installation is rejected or the script does not load, check your loader’s instructions rather than assuming installation succeeded.

### Alternative: an existing compatible loader

Install [`backbutton-close-tab.uc.js`](./backbutton-close-tab.uc.js) according to your privileged JavaScript loader’s documentation. Follow its script-directory, restart, and startup-cache instructions.

If replacing an existing installation, replace the active script rather than adding another copy. Do not paste JavaScript into `userChrome.css`; placing the file in a profile directory alone does not load it.

### 4. Test the installation

Use disposable tabs without unsaved work:

1. Open a website directly in a fresh, unpinned tab.
2. Press **Alt + Left Arrow**. If there is no Back history, the tab should close.
3. In another tab, follow a link to a second page, then go Back. It should return to the first page normally.
4. Test a page gesture and a Spaces/sidebar gesture separately.

Advanced users can check Zen’s **Browser Console** for a startup message beginning with `[backbuttonCloseTabController] Loaded`. This is separate from a website’s Developer Console.

## Usage

### Back inputs

| Input | Support |
|---|---|
| **Alt + Left Arrow** | Explicit keyboard handler, without Ctrl, Command/Meta, or Shift. |
| **BrowserBack key** | Keyboard events reporting `BrowserBack`. |
| **Toolbar Back button** | Pointer/click handlers, including an attempt to handle a visually disabled button. |
| **Browser Back commands** | `Browser:Back` and `Browser:BackOrBackDuplicate` command events. |
| **Native swipe gestures** | Left-direction browser gesture events with verified page start and completion. |
| **Horizontal wheel/trackpad movement** | Distance-based fallback over the selected page. |

Other shortcuts may work if Zen routes them through a handled command. **Command + [ is not explicitly matched by the keyboard handler.** Mouse side-button compatibility is not guaranteed.

### Trackpad gestures

Keep the pointer over the **web page**, not Spaces or the sidebar. Perform your normal Back gesture and allow about a second between deliberate tests.

The wheel fallback requires mostly horizontal movement and a default accumulated distance of **140 normalized pixels**. Native gesture directions use browser event constants and may not describe your fingers’ physical direction.

The script checks the actual element under the pointer rather than only the page’s bounding rectangle. Native closing gestures must finish on the same tab/browser within two seconds. Wheel bursts that begin over browser UI or encounter a rejected event are ignored until the burst resets.

Keyboard and toolbar Back actions do not require the pointer to be over the page.

> [!CAUTION]
> Horizontal scrolling on a historyless page can be interpreted as Back intent. Disable the mod if it conflicts with horizontally scrolling websites.

### Recovering a closed tab

Use Zen’s **Reopen Closed Tab** command when available. Reopening a tab does not guarantee recovery of unsaved form content. Closing the final tab may close the window, depending on Zen’s settings.

## Configuration

Edit the `CONFIG` object near the top of the script, preserve valid JavaScript syntax, and restart Zen. There is no settings UI supplied by this script.

| Setting | Default | Purpose |
|---|---|---|
| `SWIPE_THRESHOLD_PX` | `140` | Required accumulated distance for the wheel fallback. |
| `GESTURE_RESET_MS` | `500` | Idle interval in milliseconds before wheel gesture state resets. |
| `ACTION_COOLDOWN_MS` | `900` | Cooldown in milliseconds to reduce duplicate closing actions. |
| `HORIZONTAL_DOMINANCE_RATIO` | `1.25` | Required horizontal-to-vertical movement ratio for the wheel fallback. |
| `BACK_SWIPE_DIRECTION` | `"left"` | Wheel fallback uses negative horizontal deltas; `"right"` uses positive deltas. |
| `CLOSE_PINNED_TABS` | `false` | Protect pinned tabs. Enable only if you want eligible pinned tabs to close. |
| `DEBUG` | `false` | Enable additional diagnostic logs. |

Direction, distance, and movement-ratio settings affect the **wheel fallback**, not native swipe recognition. Native recognition remains tied to `DIRECTION_LEFT`.

Back up customizations before updating; mod updates may overwrite them.

## Troubleshooting

### Installation fails or Sine is missing

Check the official Sine guide, your active profile, bootloader setup, and any error message. Restart Zen completely. Clear the startup cache through `about:support` only if your loader’s instructions require it.

### Back does nothing

- Confirm the startup message appears in the Browser Console.
- Check whether the tab is pinned.
- Test **Alt + Left Arrow** before investigating gestures.
- Ensure the pointer is over the actual page for gesture tests.
- Wait at least a second between attempts.
- Temporarily disable conflicting navigation/gesture mods.

Ambiguous hit tests deliberately prevent closing. Some synthetic events are ignored.

### Back navigates instead of closing

This is expected when the current tab has a previous session-history entry.

### Spaces or sidebar swipes do not close tabs

This is intentional. Those gestures should remain under Zen’s control.

### Gestures trigger too easily or not easily enough

Adjust `SWIPE_THRESHOLD_PX` or `HORIZONTAL_DOMINANCE_RATIO`. If wheel deltas are reversed, try `BACK_SWIPE_DIRECTION: "right"`. These changes do not affect native swipe recognition.

### Zen crashes or behaves unexpectedly

Disable the mod, restart Zen, and restore your backup if needed. Do not continue testing with unsaved work.

Report the gesture, pointer location, tab state, browser version, and other mods involved. Gesture safeguards cannot guarantee freedom from all browser crashes or conflicts.

### The last tab closes the window

There is no last-tab guard. Zen determines the outcome after removal of the final unpinned tab.

## Updating and uninstalling

**Update:** use your Sine version’s update controls, or replace the script using your loader’s documented procedure. Back up customizations first and restart Zen afterward.

**Remove:** disable/remove the mod in Sine, or remove it through your loader, then fully restart Zen.

After updates, recheck normal navigation, historyless closing, pinned-tab protection, and Spaces gestures.

## Development and bug reports

Run the mocked regression tests with **Node.js 18 or newer**:

```sh
node --check backbutton-close-tab.uc.js
node tests/gesture-safety.test.cjs
```

Tests use only built-in Node modules. **Node.js is not required to use the mod.** Mock tests cannot verify actual native gesture delivery or browser stability; test those in Zen using disposable tabs.

[Report a bug or request a feature](https://github.com/loaykhalifa/Back-to-Close-Tab/issues). For bugs, include:

- OS and Zen versions
- Loader and bootloader versions
- Installation method and exact Back input
- Pointer location, pinned status, and Back-history state
- Reproduction steps, expected result, and actual result
- Other navigation mods involved
- Relevant Browser Console errors, with personal information removed

Focused improvements and documentation fixes are welcome. Discuss significant behavior changes first and document your test environment.

## Privacy and security

The script uses local navigation state and pointer hit tests. It does not collect analytics or make remote requests.

Browser-interface scripts run with elevated privileges. Review the source and updates before installing, and keep a profile backup.

## License

No `LICENSE` file is currently included. Public visibility alone does not grant an open-source license; ask the maintainer about reuse and distribution terms.
