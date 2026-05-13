// Math
export const OPERATOR_KEY_RE = /^[+\-*/]$/;

// App / Help
export const IS_DEV = import.meta.env.DEV;
export const HELP_SITE_URL = import.meta.env.VITE_HELP_SITE_URL || (IS_DEV ? 'http://localhost:3001' : 'https://run-calc.taalgem.nl/');

// Window state
export const WINDOW_STATE_KEY = 'calc.window.state';
export const WINDOW_STATE_SAVE_DEBOUNCE_MS = 200;
export const WINDOW_STATE_SAVE_INTERVAL_MS = 1500;
export const DEFAULT_WINDOW_WIDTH = 1100;
export const DEFAULT_WINDOW_HEIGHT = 760;

// Font scale
export const FONT_SCALE_STORAGE_KEY = 'calc.editor.fontScale';
export const UI_FONT_SCALE_STORAGE_KEY = 'calc.ui.fontScale';
export const FONT_SCALE_STEP = 0.1;
export const FONT_SCALE_MIN = 0.7;
export const FONT_SCALE_MAX = 2.2;
export const DEFAULT_FONT_SCALE = 1;
export const DEFAULT_UI_FONT_SCALE = 1;

// Editor layout
export const EDITOR_SIDE_PADDING_PX = 20;
export const EDITOR_TOP_PADDING_PX = 42;
export const EDITOR_BOTTOM_PADDING_PX = 18;

// Storage keys
export const MARKED_LINES_STORAGE_KEY = 'calc.editor.markedLines';
export const DECIMAL_DELIMITER_STORAGE_KEY = 'calc.editor.decimalDelimiter';
export const PRECISION_STORAGE_KEY = 'calc.editor.precision';
export const SCIENTIFIC_NOTATION_STORAGE_KEY = 'calc.editor.scientificNotation';
export const WORD_WRAP_STORAGE_KEY = 'calc.editor.wordWrap';
export const WORKSHEET_CONTENT_STORAGE_KEY = 'calc.editor.content';
export const LAST_RESULT_STORAGE_KEY = 'calc.editor.lastResult';
export const VARIABLE_VALUES_STORAGE_KEY = 'calc.editor.variableValues';
export const ACCEPTED_THEMES_STORAGE_KEY = 'calc.themes.accepted';
export const SETTINGS_DRAWER_WIDTH_STORAGE_KEY = 'calc.settings.drawerWidth';
export const MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY = 'calc.window.minimiseToTrayOnClose';
export const RESTORE_SHORTCUT_ENABLED_STORAGE_KEY = 'calc.window.restoreShortcutEnabled';
export const HELP_PANEL_POSITION_STORAGE_KEY = 'calc.help.position';

// Timing
export const DOUBLE_ESCAPE_HIDE_WINDOW_MS = 420;
export const INTELLIGENCE_HINT_SHOW_DELAY_MS = 300;
export const INTELLIGENCE_HINT_HIDE_IDLE_MS = 3000;

// Settings drawer
export const DEFAULT_SETTINGS_DRAWER_WIDTH = 420;
export const SETTINGS_DRAWER_MIN_WIDTH = 360;
export const SETTINGS_DRAWER_MAX_WIDTH = 1520;
export const SETTINGS_DRAWER_MIN_EDITOR_WIDTH = 380;
export const SETTINGS_DRAWER_MIN_WINDOW_WIDTH = 980;

// Precision
export const PRECISION_MIN = 0;
export const PRECISION_MAX = 15;
export const FINANCIAL_PRECISION = 2;
export const FOUR_POINT_PRECISION = 4;
