const Lang = imports.lang;
const {main, viewSelector, workspaceSwitcherPopup} = imports.ui;
const {GLib, St, Clutter, Meta, Shell, GObject} = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

// mostly taken from: Simple Task Bar by fthx - https://extensions.gnome.org/extension/2672/simple-task-bar/
// removed some functionality (interactivity) and added some others

let panelIconBar;

function init() {
}

function enable() {
	panelIconBar = new PanelAppIconBar(); 
}

function disable() {
	panelIconBar._destroy();
	panelIconBar = null;
}

var PanelAppIconBar = new Lang.Class({
    Name: 'PanelAppIconBar.PanelAppIconBar',
    _init: function() {
		this.settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.panel-icons');
		this.iconContainer = new St.BoxLayout({});
		main.panel._leftBox.insert_child_at_index(this.iconContainer, main.panel._leftBox.get_n_children() - 1);
		
		// panelMasker is used to mask the Panel while mainting its functions. See togglePanelVisibility(). 
		// 2px because 1px caused problems with custom hotcorners.
		this.panelMasker = new St.Bin({
			visible: false,
			style : 'background-color : black',
			x: main.panel.get_position()[0],
			y: main.panel.get_position()[1],
			width: main.panel.get_width(),
			height: 2,
		});
		main.layoutManager._backgroundGroup.add_child(this.panelMasker);

		// add keybindings
		main.wm.addKeybinding('focus-prev-window', this.settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT, Shell.ActionMode.NORMAL, this.focusPrevWindow.bind(this));
		main.wm.addKeybinding('focus-next-window', this.settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT, Shell.ActionMode.NORMAL, this.focusNextWindow.bind(this));
		main.wm.addKeybinding('toggle-panel', this.settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT, Shell.ActionMode.NORMAL, this.togglePanelVisibility.bind(this));

		// connect signals
		this.restacked = global.display.connect('restacked', Lang.bind(this, this.updateIcons.bind(this)));
		this.windowChangeMonitor = global.display.connect('window-left-monitor', Lang.bind(this, this.updateIcons.bind(this)));
		this.workspaceChanged = global.workspace_manager.connect('active-workspace-changed', Lang.bind(this, this.updateIcons.bind(this)));
		this.workspaceNumberChanged = global.workspace_manager.connect('notify::n-workspaces', Lang.bind(this, this.updateIcons.bind(this)));
		this.scrolledOnPanel = main.panel.connect('scroll-event', this.onPanelScrollEvent.bind(this));
		this.signalsArray = [];
		this.signalsArray.push( this.settings.connect("changed::use-symbolic-icons", this.updateIcons.bind(this)) );
		this.signalsArray.push( this.settings.connect("changed::icon-size", this.updateIcons.bind(this)) );
		this.signalsArray.push( this.settings.connect("changed::disable-appmenu", this.toggleAppmenu.bind(this)) );
		this.signalsArray.push( this.settings.connect("changed::display-last-workspace", this.updateIcons.bind(this)) );
		this.signalsArray.push( this.settings.connect("changed::panel-height", this.changePanelHeight.bind(this)) );

		// save current height of Panel for later restoration and change to new size
		this.prevPanelHeight = main.panel.get_height();
		this.changePanelHeight();

		// hide AppMenu
		this.toggleAppmenu();

		this.updateIcons();
	},

    _destroy: function() {
		// remove keybindings
		main.wm.removeKeybinding('toggle-panel');
		main.wm.removeKeybinding('focus-prev-window');
		main.wm.removeKeybinding('focus-next-window');

		// restore panel visibility in case it was hidden via the keyboard shortcut and restore previous height
		this.togglePanelVisibility(true);
		this.changePanelHeight(true);

		// restore AppMenu
		this.toggleAppmenu(true);

		// disconnect signals
		global.display.disconnect(this.restacked);
		global.display.disconnect(this.windowChangeMonitor);
		global.workspace_manager.disconnect(this.workspaceChanged);
		global.workspace_manager.disconnect(this.workspaceNumberChanged);
		main.panel.disconnect(this.scrolledOnPanel);
		this.signalsArray.forEach(signalID => this.settings.disconnect(signalID));

		this.settings.run_dispose();

		// remove bgPanel which was used for hiding the Panel
		this.panelMasker.destroy();

		// destroy container for Panel icons
		this.iconContainer.destroy();
	},

	// taken from dash to panel by jderose9
	// https://extensions.gnome.org/extension/1160/dash-to-panel/
	toggleAppmenu: function(extensionDisabled) {
		let parent;
		let appMenu = main.panel.statusArea.appMenu;

        if (appMenu)
            parent = appMenu.container.get_parent();

        if (parent)
            parent.remove_child(appMenu.container);

        if ((extensionDisabled == true || !this.settings.get_boolean("disable-appmenu")) && appMenu)
            main.panel._leftBox.insert_child_above(appMenu.container, null);
	},

	changePanelHeight: function(extensionDisabled) {
		main.panel.set_height((extensionDisabled == true) ? this.prevPanelHeight : this.prevPanelHeight + this.settings.get_int("panel-height"));
		this.updateIcons();
	},

	// hiding the main.panel will disable hotcorners, status and notification areas. To keep them I just set the height of main.panel to 2 and set_opacity(0). 
	// A black bar of 2 pixel is added to mask the wallpaper
	togglePanelVisibility: function(extensionDisabled) {
		if (extensionDisabled == true || this.panelMasker.visible) {
			this.panelMasker.hide();
			main.panel.set_opacity(255);
			main.panel.ease({
				height: (extensionDisabled == true) ? this.prevPanelHeight : this.prevPanelHeight + this.settings.get_int("panel-height"),
				duration: 200,
				mode: Clutter.AnimationMode.EASE_IN,
			});

		} else {
			main.panel.ease({
				height: 2,
				duration: 200,
				mode: Clutter.AnimationMode.EASE_IN,
				onComplete: () => {
					this.panelMasker.show();
					main.panel.set_opacity(0);
				}
			});
		}
	},

	focusPrevWindow: function() {
		this.prevWindow.activate(global.get_current_time());
	},

	focusNextWindow: function() {
		this.nextWindow.activate(global.get_current_time());
	},

	// scroll through WS
	// mainly copied from Dash to Dock by michele_g - https://extensions.gnome.org/extension/307/dash-to-dock/
	onPanelScrollEvent: function (actor, event) {
		// When in overview change workscape only in windows view
		if (main.overview.visible && main.overview.viewSelector.getActivePage() !== viewSelector.ViewPage.WINDOWS)
			return false;

		let activeWs = global.workspace_manager.get_active_workspace();
		let direction = null;

		switch (event.get_scroll_direction()) {
			case Clutter.ScrollDirection.UP:
				direction = Meta.MotionDirection.UP;
				break;
			case Clutter.ScrollDirection.DOWN:
				direction = Meta.MotionDirection.DOWN;
				break;
			case Clutter.ScrollDirection.SMOOTH:
				let [dx, dy] = event.get_scroll_delta();
				if (dy < 0)
					direction = Meta.MotionDirection.UP;
				else if (dy > 0)
					direction = Meta.MotionDirection.DOWN;
				break;
		}
		
		if (direction !== null) {
			// Prevent scroll events from triggering too many workspace switches
			// by adding a 250ms deadtime between each scroll event.
			// Usefull on laptops when using a touchpad.

			// During the deadtime do nothing
			if (this._optionalScrollWorkspaceSwitchDeadTimeId)
				return false;
			else
				this._optionalScrollWorkspaceSwitchDeadTimeId = GLib.timeout_add(
					GLib.PRIORITY_DEFAULT, 250, () => {
					this._optionalScrollWorkspaceSwitchDeadTimeId = 0;
				});

			let ws;
			
			ws = activeWs.get_neighbor(direction)
			
			if (main.wm._workspaceSwitcherPopup == null)
			// Support Workspace Grid extension showing their custom Grid Workspace Switcher
			if (global.workspace_manager.workspace_grid !== undefined) {
				main.wm._workspaceSwitcherPopup =
				global.workspace_manager.workspace_grid.getWorkspaceSwitcherPopup();
			} else {
				main.wm._workspaceSwitcherPopup = new workspaceSwitcherPopup.WorkspaceSwitcherPopup();
			}
			// Set the actor non reactive, so that it doesn't prevent the
			// clicks events from reaching the dash actor. I can't see a reason
			// why it should be reactive.
			main.wm._workspaceSwitcherPopup.reactive = false;
			main.wm._workspaceSwitcherPopup.connect('destroy', function() {
				main.wm._workspaceSwitcherPopup = null;
			});
			
			// If Workspace Grid is installed, let them handle the scroll behaviour.
			if (global.workspace_manager.workspace_grid !== undefined)
				ws = global.workspace_manager.workspace_grid.actionMoveWorkspace(direction);
			else
				main.wm.actionMoveWorkspace(ws);
			
			// Do not show workspaceSwitcher in overview
			if (!main.overview.visible)
				main.wm._workspaceSwitcherPopup.display(direction, ws.index());
			
			return true;
			

		} else {
			return false;
		}
	},

	// update the panel icon bar
    updateIcons: function() {   
    	// destroy old icons	
		this.iconContainer.destroy_all_children();

		let iconSize = this.settings.get_int("icon-size");
		let useSymbolicIcons = this.settings.get_boolean("use-symbolic-icons");
		let workspaceCount = global.workspace_manager.get_n_workspaces();
		if (!this.settings.get_boolean("display-last-workspace"))
			workspaceCount -= 1;

        for (let wsIndex = 0; wsIndex < workspaceCount; wsIndex++) {
			let workspace = global.workspace_manager.get_workspace_by_index(wsIndex);
			let wsIsActive = global.workspace_manager.get_active_workspace_index() == wsIndex;
			let windows = workspace.list_windows().reverse();
			
			// create padding infront of each workspace section
			let padding = new St.Widget({width: 25});
			this.iconContainer.add_child(padding);

			// create workspace labels
			let wsLabel = new PanelWorkspaceLabel(wsIndex + 1, wsIsActive);
			this.iconContainer.add_child(wsLabel);

			// create windows icons
			for (let i = 0; i < windows.length; i++) {
				let appIcon = new PanelAppIcon(windows[i], iconSize, useSymbolicIcons);
				this.iconContainer.add_child(appIcon);

				if (wsIsActive && windows[i].has_focus()) {
					this.prevWindow = windows[i - 1 < 0 ? windows.length - 1 : i - 1]; // wrap on current ws
					this.nextWindow = windows[i + 1 >= windows.length ? 0 : i + 1]; // wrap on current ws
				}
			};
		};
	},
});

var PanelWorkspaceLabel = GObject.registerClass(
	class PanelWorkspaceLabel extends St.Label {
		_init(index, isActive) {
			super._init({
				y_align: Clutter.ActorAlign.CENTER,
				style_class: (isActive) ? 'desk-label-active-panel-icons' : 'desk-label-inactive-panel-icons',
				text: " " + index.toString() + " "
			});
		}
	}
)

var PanelAppIcon = GObject.registerClass(
	class PanelAppIcon extends St.Bin {
		_init(window, iconSize, useSymbolicIcons) {
			super._init({
				style_class: (window.has_focus()) ? 'focused-app-panel-icons' : 'unfocused-app-panel-icons',
				opacity: (window.has_focus()) ? 255 : 150,
				width: main.panel.height,
				height: main.panel.height
			});

			let app = Shell.WindowTracker.get_default().get_window_app(window);
			let icon = app.create_icon_texture(iconSize);
			this.set_child(icon);
			
			// turn icons into symbolic icons
			if (useSymbolicIcons) {
				this.add_style_class_name("icon-mode-symbolic-panel-icons");

				// desaturate icon in case there is no symbolic icon
				let iconEffect = new Clutter.DesaturateEffect();
				this.add_effect(iconEffect);
			}
		}
	}
)