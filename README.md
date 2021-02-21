# Panel Icons

This is a fork of https://github.com/fthx/simple-task-bar. 

This extension is meant to extend and not change GNOME's default (keyboard) workflow. That's why I removed the interactivity from the original extension. 

Instead the following settings were added:

- adjustable height for the top panel
- disable AppMenu & WorkspaceSwitcherPopup
- add keybindings to cycle through the windows on the active workspace based on their order displayed in the top panel (advantage over Super/Alt+Tab is that the order is predictable). I recommend changing the keybindings to move-workspaces to Super+W/S for easy one-handed navigation
- add keybindings to toggle the top panel (while maintaining its functionality)
- cycle through the workspaces by scrolling on the top panel

I recommend "Unite" by hardpixel (https://extensions.gnome.org/extension/1287/unite/) to further improve the panel functionality.

![Preview](preview.png)

## Supported GNOME versions

- 3.36
- 3.38
- 40

## Installation

You should install it via https://extensions.gnome.org. Alternatively, you can download the `panel-icons@leleat-on-github` folder and move it to your extensions folder. Local extensions are in `~/.local/share/gnome-shell/extensions/`.
