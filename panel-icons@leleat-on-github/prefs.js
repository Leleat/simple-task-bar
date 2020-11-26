const {GObject, Gtk, Gio} = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();

function init () {
}

function buildPrefsWidget () {
  let widget = new PanelIconsPrefsWidget();
  widget.show_all();
  return widget;
}

const PanelIconsPrefsWidget = new GObject.Class({
	Name : "PanelIconsPrefsWidget.PanelIconsPrefsWidget",
	GTypeName : "PanelIconsPrefsWidget",
	Extends : Gtk.Box,
  
	_init : function (params) {
		// get settings
		let gschema = Gio.SettingsSchemaSource.new_from_directory(
			Me.dir.get_child('schemas').get_path(),
			Gio.SettingsSchemaSource.get_default(),
			false
		);

		this.settingsSchema = gschema.lookup('org.gnome.shell.extensions.panel-icons', true);
		this.settings = new Gio.Settings({
			settings_schema: this.settingsSchema
		});
	
		this.parent(params);
		
		this.builder = new Gtk.Builder();
		this.builder.add_from_file(Me.path + '/prefs.ui');   
	
		this.add( this.builder.get_object('main_prefs') );

		// bind settings to the UI objects
		// make sure the objects in prefs.ui have the same name as the keys in the settings (schema.xml)
		this.settingsSchema.list_keys().forEach( key => {
			if (this.builder.get_object(key) != null) {
				this.settings.bind(key, this.builder.get_object(key), this.getBindProperty(key), Gio.SettingsBindFlags.DEFAULT);
			}
		} );

		this.makeShortcutEdit(
			"focus-next-window-treeview",
			"focusNextWindowStore",
			"focus-next-window"
		);
		this.makeShortcutEdit(
			"focus-prev-window-treeview",
			"focusPrevWindowStore",
			"focus-prev-window"
		);
		this.makeShortcutEdit(
			"toggle-panel-treeview",
			"togglePanelStore",
			"toggle-panel"
		);
	},

	// manually add the keys to the arrays in this function
	getBindProperty : function (key) {
		let ints = ["icon-size", "panel-height"];
		let bools = ["use-symbolic-icons","display-last-workspace", "disable-appmenu", "enable-keybinding-to-switch-windows", "enable-keybinding-to-toggle-panel"];

		if (ints.includes(key)) {
			return "value"; // spinbox.value
		} else if (bools.includes(key)) {
			return "active"; //  switch.active
		}
	},

	// taken from Overview-Improved by human.experience
	// https://extensions.gnome.org/extension/2802/overview-improved/
	makeShortcutEdit(widgetId, storeId, settingKey) {
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
		  const [key, mods] = accel ? Gtk.accelerator_parse(accel) : [0, 0];
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
