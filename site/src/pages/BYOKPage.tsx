import { HelpLayout } from '../components/HelpLayout';

export function BYOKPage() {
    return (
        <HelpLayout title="BYOK Setup" subtitle="Connect AI in a few simple steps, even if you are not technical.">
            <section className="panel">
                <h2>Quick Start (2 minutes)</h2>
                <ul>
                    <li>In Run-Calc, open <strong>Settings -&gt; AI</strong>.</li>
                    <li>Choose one provider below.</li>
                    <li>Open that provider link, create an API key, and copy it.</li>
                    <li>Back in Run-Calc, paste the key into <strong>API key (BYOK)</strong> and click <strong>Save key</strong>.</li>
                    <li>Click <strong>Test and Save</strong> to finish.</li>
                </ul>
            </section>

            <section className="panel byok-grid" aria-label="Provider key setup links">
                <article className="byok-card">
                    <h3>OpenAI</h3>
                    <p>Best if you already use ChatGPT/OpenAI products.</p>
                    <ul>
                        <li><a href="https://platform.openai.com/api-keys">1) Create/Open your OpenAI API key</a></li>
                        <li><a href="https://developers.openai.com/api/docs/quickstart">2) OpenAI quickstart (optional)</a></li>
                    </ul>
                    <p className="byok-note">In Run-Calc choose preset: OpenAI</p>
                </article>

                <article className="byok-card">
                    <h3>Gemini</h3>
                    <p>Good choice if you prefer Google AI Studio.</p>
                    <ul>
                        <li><a href="https://aistudio.google.com/app/apikey">1) Create/Open Gemini API key</a></li>
                        <li><a href="https://ai.google.dev/gemini-api/docs/api-key">2) Gemini key guide (optional)</a></li>
                    </ul>
                    <p className="byok-note">In Run-Calc choose preset: Gemini</p>
                </article>

                <article className="byok-card">
                    <h3>OpenRouter</h3>
                    <p>Great if you want access to many models from one account.</p>
                    <ul>
                        <li><a href="https://openrouter.ai/settings/keys">1) Create/Open OpenRouter key</a></li>
                        <li><a href="https://openrouter.ai/docs/quickstart">2) OpenRouter quickstart (optional)</a></li>
                    </ul>
                    <p className="byok-note">In Run-Calc choose preset: OpenRouter</p>
                </article>

                <article className="byok-card">
                    <h3>Anthropic</h3>
                    <p>
                        In Run-Calc today, the Anthropic preset works through OpenRouter.
                        So for this preset, create and use an OpenRouter key.
                    </p>
                    <ul>
                        <li><a href="https://openrouter.ai/settings/keys">1) Create/Open OpenRouter key (for Anthropic preset in Run-Calc)</a></li>
                        <li><a href="https://platform.claude.com/settings/keys">2) Anthropic keys page (direct Claude API)</a></li>
                        <li><a href="https://platform.claude.com/docs/en/api/getting-started">3) Anthropic getting started (optional)</a></li>
                    </ul>
                    <p className="byok-note">In Run-Calc choose preset: Anthropic (via OpenRouter)</p>
                </article>
            </section>

            <section className="panel">
                <h2>If Something Fails</h2>
                <ul>
                    <li>"Not configured" means no key is saved yet: paste key and click <strong>Save key</strong>.</li>
                    <li>"Unauthorized" usually means wrong key: create a new key and save it again.</li>
                    <li>"Timeout" means network/provider delay: try again or increase timeout seconds in AI settings.</li>
                    <li>If you changed provider, save a key for the newly selected provider and run <strong>Test and Save</strong> again.</li>
                </ul>
            </section>

            <section className="panel byok-callout">
                <h2>Advanced Notes (Optional)</h2>
                <p>
                    The <strong>Custom</strong> preset is for advanced users who want a manual OpenAI-compatible endpoint and model.
                </p>
                <p>
                    If you change custom endpoints while a custom key is already saved, Run-Calc may warn about key reuse.
                    You can allow reuse explicitly, or save a new key for that endpoint.
                </p>
            </section>
        </HelpLayout>
    );
}