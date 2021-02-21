const {GObject, Gtk, Gio} = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();

const Config = imports.misc.config;
const shellVersion = parseFloat(Config.PACKAGE_VERSION);

function init() {
}

function buildPrefsWidget() {
  const prefsWidget = new PrefsWidget();
  shellVersion < 40 && prefsWidget.show_all();
  return prefsWidget;
}

const PrefsWidget = new GObject.Class({
	Name: "PanelIconsPrefsWidget.PanelIconsPrefsWidget",
	GTypeName: "PanelIconsPrefsWidget",
	Extends: Gtk.Box,

	_init: function(params) {
		this.parent(params);

		const gschema = Gio.SettingsSchemaSource.new_from_directory(Me.dir.get_child("schemas").get_path(),
				Gio.SettingsSchemaSource.get_default(), false);
		const settingsSchema = gschema.lookup("org.gnome.shell.extensions.panel-icons", true);
		this.settings = new Gio.Settings({settings_schema: settingsSchema});

		this.builder = new Gtk.Builder();
		this.builder.add_from_file(Me.path + "/prefs.ui");

		const mainPrefs = this.builder.get_object("main_prefs");
		shellVersion < 40 ? this.add(mainPrefs) : this.append(mainPrefs);

		this.bindSettingsToWidgets(settingsSchema.list_keys());

		this.makeShortcutEdit("focus-next-window-treeview", "focusNextWindowStore", "focus-next-window");
		this.makeShortcutEdit("focus-prev-window-treeview", "focusPrevWindowStore", "focus-prev-window");
		this.makeShortcutEdit("toggle-panel-treeview", "togglePanelStore", "toggle-panel");
	},

	bindSettingsToWidgets: function(settingsKeys) {
		// the widgets in prefs.ui need to have same ID
		// as the keys in the gschema.xml
		const getBindProperty = function(key) {
			const ints = ["icon-size", "panel-height"];
			const bools = ["use-symbolic-icons","display-last-workspace", "disable-appmenu",
					"enable-keybinding-to-switch-windows", "enable-keybinding-to-toggle-panel",
					"hide-workspace-switcher-popup"];

			if (ints.includes(key))
				return "value"; // Gtk.Spinbox.value
			else if (bools.includes(key))
				return "active"; //  Gtk.Switch.active
			else
				return null;
		};

		settingsKeys.forEach(key => {
			const bindProperty = getBindProperty(key);
			const widget = this.builder.get_object(key);
			if (widget && bindProperty)
				this.settings.bind(key, widget, bindProperty, Gio.SettingsBindFlags.DEFAULT);
		});
	},

	// taken from Overview-Improved by human.experience
	// https://extensions.gnome.org/extension/2802/overview-improved/
	makeShortcutEdit: function(widgetId, storeId, settingKey) {
		const COLUMN_KEY = 0;
		const COLUMN_MODS = 1;

		const view = this.builder.get_object(widgetId);
		const store = this.builder.get_object(storeId);
		const iter = store.append();
		const renderer = new Gtk.CellRendererAccel({ editable: true });
		const column = new Gtk.TreeViewColumn();
		column.pack_start(renderer, true);
		column.add_attribute(renderer, "accel-key", COLUMN_KEY);
		column.add_attribute(renderer, "accel-mods", COLUMN_MODS);
		view.append_column(column);

		const updateShortcutRow = (accel) => {
			// compatibility GNOME 40: GTK4's func returns 3 values / GTK3's only 2
			const array = accel ? Gtk.accelerator_parse(accel) : [0, 0];
			const [key, mods] = [array[array.length - 2], array[array.length - 1]];
			store.set(iter, [COLUMN_KEY, COLUMN_MODS], [key, mods]);
		};

		renderer.connect("accel-edited", (renderer, path, key, mods, hwCode) => {
		  const accel = Gtk.accelerator_name(key, mods);
		  updateShortcutRow(accel);
		  this.settings.set_strv(settingKey, [accel]);
		});

		renderer.connect("accel-cleared", () => {
			updateShortcutRow(null);
			this.settings.set_strv(settingKey, []);
		});

		this.settings.connect("changed::" + settingKey, () => {
			updateShortcutRow(this.settings.get_strv(settingKey)[0]);
		});

		updateShortcutRow(this.settings.get_strv(settingKey)[0]);
	}
});
