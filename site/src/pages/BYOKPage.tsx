import { HelpLayout } from '../components/HelpLayout';

const ext = { target: '_blank', rel: 'noopener noreferrer' };

export function BYOKPage() {
    return (
        <HelpLayout title="AI Key Setup" subtitle="Connect AI in a few simple steps, even if you are not technical.">
            <section className="panel">
                <h2>How it works</h2>
                <p>
                    Run-Calc does not have a built-in AI subscription. Instead you connect your own account
                    from one of the providers below — this is called <strong>BYOK</strong> (Bring Your Own Key).
                    Your key is stored safely on your computer only.
                </p>
                <ol className="byok-steps">
                    <li>Open <strong>Settings -&gt; AI</strong> in Run-Calc.</li>
                    <li>Pick a provider preset (OpenAI, Gemini, OpenRouter, or Anthropic).</li>
                    <li>Follow that provider's steps below to get a free or paid API key.</li>
                    <li>Copy the key, paste it into the <strong>API key (BYOK)</strong> box, and click <strong>Save key</strong>.</li>
                    <li>Click <strong>Test and Save</strong>. A green status means you are ready.</li>
                </ol>
            </section>

            <section className="panel byok-grid" aria-label="Provider key setup steps">

                <article className="byok-card">
                    <h3>OpenAI</h3>
                    <p className="byok-tag">Best if you already use ChatGPT or have an OpenAI account</p>
                    <ol>
                        <li><a href="https://platform.openai.com/signup" {...ext}>Create a free OpenAI account</a> (skip if you have one).</li>
                        <li>Sign in, then open <a href="https://platform.openai.com/api-keys" {...ext}>platform.openai.com/api-keys</a>.</li>
                        <li>Click <strong>Create new secret key</strong>, give it a name, and click <strong>Create</strong>.</li>
                        <li>Copy the key immediately — you will not see it again.</li>
                        <li>Paste it into Run-Calc and click <strong>Save key</strong>.</li>
                    </ol>
                    <p className="byok-note">Run-Calc preset: <strong>OpenAI</strong></p>
                </article>

                <article className="byok-card">
                    <h3>Gemini</h3>
                    <p className="byok-tag">Good choice if you have a Google account — has a free tier</p>
                    <ol>
                        <li>Go to <a href="https://aistudio.google.com/app/apikey" {...ext}>Google AI Studio</a> and sign in with your Google account.</li>
                        <li>Click <strong>Create API key</strong>.</li>
                        <li>Copy the key shown.</li>
                        <li>Paste it into Run-Calc and click <strong>Save key</strong>.</li>
                    </ol>
                    <p className="byok-note">Run-Calc preset: <strong>Gemini</strong></p>
                </article>

                <article className="byok-card">
                    <h3>OpenRouter</h3>
                    <p className="byok-tag">Great for trying many AI models from one account</p>
                    <ol>
                        <li><a href="https://openrouter.ai/sign-up" {...ext}>Create a free OpenRouter account</a> (or sign in).</li>
                        <li>Open <a href="https://openrouter.ai/settings/keys" {...ext}>openrouter.ai/settings/keys</a>.</li>
                        <li>Click <strong>Create Key</strong>, give it a name, and confirm.</li>
                        <li>Copy the key shown.</li>
                        <li>Paste it into Run-Calc and click <strong>Save key</strong>.</li>
                    </ol>
                    <p className="byok-note">Run-Calc preset: <strong>OpenRouter</strong></p>
                </article>

                <article className="byok-card">
                    <h3>Anthropic (Claude)</h3>
                    <p className="byok-tag">The Anthropic preset in Run-Calc routes through OpenRouter — use an OpenRouter key</p>
                    <ol>
                        <li><a href="https://openrouter.ai/sign-up" {...ext}>Create a free OpenRouter account</a> (or sign in).</li>
                        <li>Open <a href="https://openrouter.ai/settings/keys" {...ext}>openrouter.ai/settings/keys</a> and create a key.</li>
                        <li>Copy the key shown.</li>
                        <li>In Run-Calc, choose the <strong>Anthropic</strong> preset.</li>
                        <li>Paste the OpenRouter key and click <strong>Save key</strong>.</li>
                    </ol>
                    <p className="byok-note">
                        Run-Calc preset: <strong>Anthropic</strong>{' '}
                        &mdash; wants an OpenRouter key because it uses the OpenRouter endpoint.
                    </p>
                </article>

            </section>

            <section className="panel">
                <h2>If Something Fails</h2>
                <ul>
                    <li><strong>"Not configured"</strong> — no key is saved yet. Paste it and click <strong>Save key</strong>.</li>
                    <li><strong>"Unauthorized"</strong> — key is wrong or expired. Create a new key and save it again.</li>
                    <li><strong>"Timeout"</strong> — network or provider delay. Try again, or raise the timeout in AI settings.</li>
                    <li><strong>Changed provider?</strong> — save a key for the new preset and run <strong>Test and Save</strong> again.</li>
                </ul>
            </section>

            <section className="panel byok-callout">
                <h2>Advanced: Custom Provider</h2>
                <p>
                    The <strong>Custom</strong> preset lets you point Run-Calc at any OpenAI-compatible endpoint
                    (e.g. a local model or a company proxy). Enter the endpoint URL and model id manually, then
                    save the matching API key.
                </p>
                <p>
                    If you switch custom endpoints while a custom key is already saved, Run-Calc will warn you
                    about key reuse. Enable the reuse toggle in settings, or save a new key for the new endpoint.
                </p>
            </section>
        </HelpLayout>
    );
}