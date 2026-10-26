# Back to Close Tab

**Go back when you can. Close the tab when you can’t.**

Back to Close Tab closes the current tab when you navigate back and there are no previous pages—instead of doing nothing.

## How It Works

| Current tab’s history | What happens when you go back |
|---|---|
| A previous page exists | Returns to the previous page normally. |
| No previous page exists | Closes the current tab. |

### Example

```text
Open Page A in a new tab
          ↓
Navigate to Page B in the same tab
          ↓
Go back → Returns to Page A
          ↓
Go back again → Closes the tab
```

“Back history” means the navigation history of the **current tab**, not your browser’s overall browsing history.

> [!IMPORTANT]
> Going back can close the current tab when there are no previous pages.

## Requirements

- **Zen Browser**
- **[Sine](https://github.com/CosmoCreeper/Sine)** installed and configured

## Installation

### 1. Install Sine

If you haven’t installed Sine yet, follow the instructions in the [official Sine repository](https://github.com/CosmoCreeper/Sine).

### 2. Open Sine Settings

Open **Zen Settings** and navigate to the **Sine** section.

### 3. Add the Repository

Find the option to install a mod from a GitHub repository, then paste:

```text
loaykhalifa/Back-to-Close-Tab
```

### 4. Finish Installation

Follow Sine’s prompts, ensure **Back to Close Tab** is enabled, and restart Zen if prompted.

### Installation Screenshot

![Installing Back to Close Tab using Sine in Zen Settings](https://github.com/user-attachments/assets/f978c452-95e2-460d-b726-fe20259acf09)

## Usage

### Close a Tab Without Back History

1. Open a website directly in a new tab.
2. Without visiting another page in that tab, navigate back.
3. The tab should close.

### Navigate Back Normally

1. Open a website in a new tab.
2. Follow a link to another page in the same tab.
3. Navigate back.
4. You should return to the previous page.

## Troubleshooting

### Nothing Happens When Going Back

- Confirm that the mod is installed and enabled in Sine.
- Restart Zen if requested during installation.
- Test in a newly opened tab.
- Temporarily disable other navigation-related mods to check for conflicts.

### The Tab Goes Back Instead of Closing

This is expected when the tab still has a previous page in its navigation history.

### Installation Fails

- Confirm that Sine is installed and working.
- Check your internet connection.
- Make sure the repository identifier is entered exactly as shown above.
- If the problem continues, [open an issue](https://github.com/loaykhalifa/Back-to-Close-Tab/issues) with the error message.

## Uninstallation

1. Open **Zen Settings → Sine**.
2. Find **Back to Close Tab** among your installed mods.
3. Disable or remove it.
4. Restart Zen if prompted.

## Bug Reports and Feature Requests

[Open an issue](https://github.com/loaykhalifa/Back-to-Close-Tab/issues) to report a problem or suggest an improvement. Please check existing issues first.

For bug reports, include:

- Operating system
- Zen Browser version
- Sine version
- Steps to reproduce
- Expected and actual behavior
- Navigation method used: button, shortcut, or gesture
- Other navigation-related mods installed
- Relevant screenshots or error messages

For feature requests, explain what you want, why it would help, and how you expect it to work.

## Contributing

Suggestions, documentation improvements, and bug fixes are welcome.

For substantial changes, open an issue first to discuss your proposal. In your pull request, describe what changed and how you tested it.
