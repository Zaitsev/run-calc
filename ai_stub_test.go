package main

import "testing"

func TestNormalizeToolCallThoughtSignatures_FromExtraContentGoogle(t *testing.T) {
	msg := openAIMessage{
		Role: "assistant",
		ToolCalls: []openAIToolCall{
			{
				ID:   "tc-1",
				Type: "function",
				ExtraContent: &openAIToolCallExtraContent{
					Google: &openAIToolCallExtraGoogle{ThoughtSignature: "sig-A"},
				},
			},
		},
	}
	msg.ToolCalls[0].Function.Name = "evaluate_expression"
	msg.ToolCalls[0].Function.Arguments = `{"expression":"1+1"}`

	normalizeToolCallThoughtSignatures(&msg)

	tc := msg.ToolCalls[0]
	if tc.Function.ThoughtSignature != "sig-A" {
		t.Fatalf("expected function thought signature to be mirrored, got %q", tc.Function.ThoughtSignature)
	}
	if tc.ThoughtSignature != "sig-A" {
		t.Fatalf("expected top-level thought signature to be mirrored, got %q", tc.ThoughtSignature)
	}
	if tc.ExtraContent == nil || tc.ExtraContent.Google == nil || tc.ExtraContent.Google.ThoughtSignature != "sig-A" {
		t.Fatalf("expected extra_content.google.thought_signature to be preserved")
	}
}

func TestNormalizeToolCallThoughtSignatures_ToExtraContentGoogle(t *testing.T) {
	msg := openAIMessage{
		Role: "assistant",
		ToolCalls: []openAIToolCall{
			{
				ID:   "tc-2",
				Type: "function",
			},
		},
	}
	msg.ToolCalls[0].Function.Name = "evaluate_expression"
	msg.ToolCalls[0].Function.Arguments = `{"expression":"sqrt(2)"}`
	msg.ToolCalls[0].Function.ThoughtSignature = "sig-B"

	normalizeToolCallThoughtSignatures(&msg)

	tc := msg.ToolCalls[0]
	if tc.ExtraContent == nil || tc.ExtraContent.Google == nil {
		t.Fatalf("expected extra_content.google to be created")
	}
	if tc.ExtraContent.Google.ThoughtSignature != "sig-B" {
		t.Fatalf("expected extra_content.google.thought_signature to be mirrored, got %q", tc.ExtraContent.Google.ThoughtSignature)
	}
	if tc.ThoughtSignature != "sig-B" {
		t.Fatalf("expected top-level thought signature to be mirrored, got %q", tc.ThoughtSignature)
	}
}

func TestIsGeminiOpenAICompatibleEndpoint(t *testing.T) {
	if !isGeminiOpenAICompatibleEndpoint(AISettings{ProviderPreset: geminiAIProviderPreset, Endpoint: "https://example.com/v1"}) {
		t.Fatalf("expected gemini preset to be detected as gemini-compatible")
	}
	if !isGeminiOpenAICompatibleEndpoint(AISettings{ProviderPreset: customAIProviderPreset, Endpoint: "https://generativelanguage.googleapis.com/v1beta/openai"}) {
		t.Fatalf("expected Gemini host to be detected as gemini-compatible")
	}
	if isGeminiOpenAICompatibleEndpoint(AISettings{ProviderPreset: defaultAIProviderPreset, Endpoint: "https://api.openai.com/v1"}) {
		t.Fatalf("did not expect OpenAI endpoint to be detected as gemini-compatible")
	}
}
