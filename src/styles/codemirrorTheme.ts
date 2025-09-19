import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Ink Goose custom CodeMirror theme
// Two variants are exported: inkGooseLight and inkGooseDark.
// Use with: ...(theme === 'dark' ? inkGooseDark : inkGooseLight)

const lightPalette = {
    background: '#ffffff',
    foreground: '#1f2937',
    selection: '#bfdbfe66',
    cursor: '#111827',
    gutterBg: '#ffffff',
    gutterFg: '#9ca3af',
    gutterActive: '#4b5563',
    lineHighlight: 'rgba(0, 0, 0, 0.05)',
    // Syntax
    keyword: '#2563eb',
    operator: '#7c3aed',
    variable: '#1f2937',
    function: '#0f766e',
    string: '#047857',
    number: '#b91c1c',
    regexp: '#d97706',
    type: '#9333ea',
    comment: '#6b7280',
    meta: '#92400e',
    link: '#0369a1',
    heading: '#111827',
};

const darkPalette = {
    background: 'var(--bg-primary)',
    foreground: '#e5e7eb',
    selection: '#1f293766',
    cursor: '#f3f4f6',
    gutterBg: 'var(--bg-secondary)',
    gutterFg: '#6b7280',
    gutterActive: '#d1d5db',
    lineHighlight: 'rgba(255, 255, 255, 0.06)',
    // Syntax
    keyword: '#93c5fd',
    operator: '#c4b5fd',
    variable: '#e5e7eb',
    function: '#5eead4',
    string: '#86efac',
    number: '#fca5a5',
    regexp: '#fcd34d',
    type: '#d8b4fe',
    comment: '#9ca3af',
    meta: '#f59e0b',
    link: '#7dd3fc',
    heading: '#f3f4f6',
};

const uiTheme = (p: typeof lightPalette, isDark: boolean) =>
    EditorView.theme({
        '&': {
            color: p.foreground,
            backgroundColor: p.background,
            fontFamily: `var(--editor-font)`,
            fontSize: 'var(--editor-font-size)',
            lineHeight: '1.7',
            fontWeight: '400',
            fontVariantLigatures: 'contextual common-ligatures',
            tabSize: '4',
        },
        '.cm-content': {
            caretColor: p.cursor,
            fontFamily: `var(--editor-font)`,
            fontSize: 'var(--editor-font-size)',
            lineHeight: '1.7',
            fontWeight: '400',
            tabSize: '4',
        },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: p.cursor },
        '&.cm-editor.cm-focused': { outline: 'none' },
        '&.cm-editor .cm-selectionBackground, .cm-content ::selection': {
            backgroundColor: p.selection,
        },
        '.cm-gutters': {
            backgroundColor: p.gutterBg,
            color: p.gutterFg,
            border: 'none',
        },
        '.cm-activeLineGutter': {
            color: p.gutterActive,
            fontWeight: 600,
        },
        '.cm-activeLine': {
            backgroundColor: p.lineHighlight,
        },
        '.cm-panels': {
            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
            color: p.foreground,
        },
        '.cm-tooltip': {
            border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
            backgroundColor: isDark ? '#0b1220' : '#ffffff',
        },
        '.cm-searchMatch': {
            backgroundColor: isDark ? '#fde68a55' : '#fef08a99',
            outline: `1px solid ${isDark ? '#f59e0b' : '#d97706'}`,
        },
    }, { dark: isDark });

const syntaxStyle = (p: typeof lightPalette) =>
    HighlightStyle.define([
        { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: p.keyword, fontWeight: '500' },
        { tag: [t.operator, t.punctuation], color: p.operator },
        { tag: [t.variableName], color: p.variable, fontWeight: '400' },
        { tag: [t.definition(t.variableName), t.local(t.variableName)], color: p.variable, fontWeight: '400' },
        { tag: [t.function(t.variableName), t.function(t.propertyName)], color: p.function, fontWeight: '400' },
        { tag: [t.typeName, t.typeOperator, t.typeName], color: p.type, fontWeight: '400' },
        { tag: [t.string, t.special(t.string)], color: p.string, fontWeight: '400' },
        { tag: [t.number, t.integer, t.float], color: p.number, fontWeight: '400' },
        { tag: [t.regexp], color: p.regexp, fontWeight: '400' },
        { tag: [t.comment, t.lineComment, t.blockComment], color: p.comment, fontStyle: 'italic', fontWeight: '400' },
        { tag: [t.meta, t.documentMeta], color: p.meta, fontWeight: '400' },
        { tag: [t.link, t.url], color: p.link, textDecoration: 'underline', fontWeight: '400' },
        // Markdown-specific
        { tag: [t.heading], color: p.heading, fontWeight: '600' },
        { tag: [t.emphasis], fontStyle: 'italic', fontWeight: '400' },
        { tag: [t.strong], fontWeight: '600' },
        { tag: [t.quote], color: p.comment, fontStyle: 'italic', fontWeight: '400' },
        { tag: [t.list], color: p.operator, fontWeight: '400' },
        { tag: [t.monospace], backgroundColor: 'transparent', fontWeight: '400' },
    ]);

export const inkGooseLight = [
    uiTheme(lightPalette, false),
    syntaxHighlighting(syntaxStyle(lightPalette)),
];

export const inkGooseDark = [
    uiTheme(darkPalette, true),
    syntaxHighlighting(syntaxStyle(darkPalette)),
];
