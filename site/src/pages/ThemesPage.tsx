import { HelpLayout } from '../components/HelpLayout';

export function ThemesPage() {
    return (
        <HelpLayout title="Themes" subtitle="Personalise the editor with built-in options or any VS Code-compatible theme.">
            <section className="panel">
                <h2>Built-in themes</h2>
                <p>
                    Open <strong>Settings → Theme</strong> to switch between the four presets that ship with
                    Run-Calc:
                </p>
                <ul>
                    <li><strong>System</strong> — follows your OS light / dark preference automatically.</li>
                    <li><strong>Light</strong> — a clean light background.</li>
                    <li><strong>Dark</strong> — a comfortable dark background.</li>
                    <li><strong>Custom</strong> —  theme you installed from the Theme Store.</li>
                </ul>
                <p style={{"margin": '1em',overflow: 'hidden'}}>
                    <video controls muted playsInline>
                        <source src="/images/operations/themes.mp4" type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>
                </p>
            </section>

            <section className="panel">
                <h2>Theme Store</h2>
                <p>
                    Run-Calc can install any colour theme published on{' '}
                    <a href="https://open-vsx.org" target="_blank" rel="noopener noreferrer">Open VSX</a>.
                    The Theme Store is built right into the app:
                </p>
                <ol>
                    <li>Open <strong>Settings → Theme Store</strong>.</li>
                    <li>Type a theme name in the search box — results appear as you type.</li>
                    <li>Click <strong>Preview</strong> to see the theme live without saving it.</li>
                    <li>Click <strong>Accept</strong> to keep the theme, or close the panel to revert the preview.</li>
                    <li>The accepted theme is saved automatically and persists across restarts.</li>
                </ol>
                <p>
                    Any theme you previously accepted is restored when you next open the app — no re-download
                    is needed because the colour tokens are stored locally.
                </p>
            </section>

            <section className="panel">
                <h2>How custom themes work</h2>
                <p>
                    Run-Calc reads a subset of VS Code colour tokens from the theme package and maps them to
                    the editor surface. Tokens used include:
                </p>
                <ul>
                    <li>Editor background and foreground</li>
                    <li>Status bar background, foreground, and border</li>
                    <li>Gutter background and line-number colours</li>
                    <li>Syntax token colours for numbers, operators, variables, functions, constants, comments, and punctuation</li>
                    <li>Link, error, and scroll-bar colours</li>
                </ul>
                <p>
                    Tokens not present in the theme package fall back to sensible defaults derived from
                    the theme's declared base (<code>dark</code> or <code>light</code>).
                </p>
            </section>

            <section className="panel">
                <h2>Tips</h2>
                <ul>
                    <li>Search for popular names like <code>One Dark Pro</code>, <code>Dracula</code>, or <code>Catppuccin</code> to find well-known themes quickly.</li>
                    <li>If a theme looks off in one area, try another variant from the same publisher — many themes publish separate dark and light editions.</li>
                    <li>Switching back to <strong>System</strong> or <strong>Light / Dark</strong> does not delete your installed custom theme; it is still available under <strong>Custom</strong>.</li>
                    <li>Font size is independent of the theme — adjust it with <code>Ctrl/Cmd + =</code>, <code>Ctrl/Cmd + -</code>, or <code>Ctrl/Cmd + 0</code>.</li>
                </ul>
            </section>
        </HelpLayout>
    );
}
