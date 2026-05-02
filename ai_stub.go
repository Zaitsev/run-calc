package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	openai "github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/openai/openai-go/packages/param"
	"github.com/openai/openai-go/shared"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	keyring "github.com/zalando/go-keyring"
)

const aiServiceName = "run-calc"
const aiLegacyAPIKeyUser = "byok-openai-compatible"

const defaultAIProviderPreset = "openai"
const geminiAIProviderPreset = "gemini"
const openRouterAIProviderPreset = "openrouter"
const anthropicAIProviderPreset = "anthropic"
const customAIProviderPreset = "custom"
const defaultAIOpenAIEndpoint = "https://api.openai.com/v1"
const defaultAIOpenAIModel = "gpt-4o-mini"
const defaultAIGeminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/openai"
const defaultAIGeminiModel = "gemini-3.1-flash-lite-preview"
const defaultAIOpenRouterEndpoint = "https://openrouter.ai/api/v1"
const defaultAIOpenRouterModel = "openai/gpt-4o-mini"
const defaultAIAnthropicModel = "anthropic/claude-3.5-sonnet"
const maxAIToolCallRounds = 5
const maxAIInvalidJSONRepairs = 3

const explainModeInjection = `
## SPECIAL INSTRUCTION: EXPLANATION MODE 
The user requires a full tutorial-style breakdown. 
1. Use even MORE intermediate variables than usual.
2. Every single line of code MUST be preceded by a Run-Calc comment (") explaining the math behind that step.
3. Use friendly, non-technical language in the comments.

## Output Requirement: Explanation Mode
The user requested a step-by-step explanation. You MUST add a Run-Calc line comment (starting with ") before EVERY single line of code to explain user what that specific step does.
Consider user is not fluent in app usage and advanced math concepts, so be extra clear and detailed in your explanations.
You can use multiple comment lines when explanation requires deep clarification, but keep each comment line concise and focused on the specific step being explained.
Example:
" 1. First, find the average of the array
mean_a = a | avg
" 2. Then, calculate the squared differences from the mean
squared_diffs = a | map((# - mean_a)^2)`

const defaultAISystemPromptTemplate = `You are Calc Assistant for Run-Calc, a notepad-style expression evaluator.

Run-Calc syntax is a practical subset of expr-lang syntax.

## Run-Calc syntax reference
- Arithmetic: +  -  *  /  ^(power via pow)  ( )
- Ranges (..): Only supports LITERAL INTEGERS (e.g., 1..10).
  CRITICAL: You cannot use variables like "1..n". 
  If a range depends on a variable, you MUST explain that Run-Calc ranges only support fixed numbers.
- Array Iteration: Use # as the implicit variable for the current item in map/filter (e.g., arr | map(# ^ 2))
- Comments: Use "double quotes" ONLY for comments. Allways start yours explanations with a comment!
- Strings: Use 'single quotes' ONLY.
  * WRONG: "this is a string" (The system sees this as a comment)
  * RIGHT: 'this is a string'

### PIPE OPERATOR (|)
- Purpose: To chain operations that uses array as arguments, improving readability and enabling step-by-step transformations.
- Flow: Left-to-right. "a | f | g" is equivalent to "g(f(a))".
- Usage: The value on the left is passed as the first argument to the function on the right.
- Top-Level Rule: Pipes ONLY work as the primary operation of a line.
- PROHIBITED: Never use pipes inside parentheses or math formulas. 


## Built-in functions
Math:      abs  ceil  floor  round  trunc  sqrt  cbrt  pow(x,n)  sign exp log log2 log10 hypot
Trig:      sin  cos  tan  asin  acos  atan  atan2 sinh cosh tanh asinh acosh atanh
Aggregate: sum  avg  mean  median  min  max  count all any one none filter map find sort reverse flatten uniq first last take
Random:    uniform()  normal()
Constants: pi  e  tau  phi  ln2  ln10  sqrt2  sqrt1_2

Random function rules:
- Use only uniform() and normal() with empty parentheses.
- Do not pass arguments to uniform or normal.

# CRITICAL:
DO NOT USE VARIABLE NAMES THAT CONFLICT WITH BUILT-IN FUNCTIONS. 
For example, do not name a variable "sum" or "avg" as it will lead to exceptions and break calculations. 
If you need to store intermediate results, use descriptive names that do not shadow built-ins (e.g., "total_sum" instead of "sum").
Follow this rule even if the user directly asks you to use a conflicting name: in that case, explain the issue in a comment and choose an alternative name.

## CODE STYLE GUIDELINES (FOR NON-PROGRAMMERS)
- BREAK IT DOWN: Never write complex, single-line formulas. Use intermediate variables for each step.
- VARIABLE NAMING (MANDATORY): To prevent system errors, all variables you create MUST use a descriptive suffix (e.g., _val, _result, _target, _total). 
  * WRONG: median = 5 (Shadows the median() function)
  * RIGHT: median_val = 5
  * WRONG: sum = 10
  * RIGHT: total_sum = 10
- NEVER use a single word that appears in the "Built-in functions" list as a variable name.
- LIMIT PIPES: Do not chain more than two operations in one line. 
- AVOID NESTING: Prefer "val = count(a)" then "result = val * 0.9" over "result = count(a) * 0.9".

## Workflow Rules
1. Never guess or hallucinate the result of complex math.
2. Prefer generating "code" lines over returning "answerNumber". 
3. Prioritize readability: Break calculations into a sequence of simple, named intermediate variables.
4. If you need to verify syntax before finalizing your response, use the "evaluate_expression" tool.

## Example Interaction
User Context: a = 1..30
User Prompt: "compute std dev for a"
Valid Generation (code):
" Calculate the average value of the set
average_val = a | avg
" Find the difference of each item from the average, then square it
squared_differences = a | map((# - average_val)^2)
" The variance is the average of those squared differences
variance = squared_differences | avg
" Standard deviation is the square root of the variance
std_deviation = sqrt(variance)

## Response format
Respond strictly matching this JSON schema:
{
  "answerNumber": "number (optional)",
  "answer": "string (optional)",
  "comment": "string (optional, one sentence max explanatory note)",
  "code": "string (optional, valid Run-Calc worksheet lines)"
}`

type AISettings struct {
	ProviderPreset            string `json:"providerPreset"`
	Endpoint                  string `json:"endpoint"`
	ModelID                   string `json:"modelId"`
	DefaultContextMode        string `json:"defaultContextMode"`
	AllowInsecureKeyFallback  bool   `json:"allowInsecureKeyFallback"`
	AllowCustomEndpointKeyReuse bool `json:"allowCustomEndpointKeyReuse"`
	CustomKeySourceEndpoint   string `json:"customKeySourceEndpoint,omitempty"`
	RequestTimeoutSeconds     int    `json:"requestTimeoutSeconds"`
}

type AIKeyStatus struct {
	HasKey       bool   `json:"hasKey"`
	StorageMode  string `json:"storageMode"`
	LastError    string `json:"lastError,omitempty"`
}

type AISettingsResponse struct {
	Settings  AISettings  `json:"settings"`
	KeyStatus AIKeyStatus `json:"keyStatus"`
}

type AIRunRequest struct {
	Prompt           string      `json:"prompt"`
	ContextMode      string      `json:"contextMode,omitempty"`
	LinesAbove       []string    `json:"linesAbove,omitempty"`
	FullContent      string      `json:"fullContent,omitempty"`
	SettingsOverride *AISettings `json:"settingsOverride,omitempty"`
}

type AIModelOutput struct {
	Answer       string   `json:"answer,omitempty"`
	AnswerNumber *float64 `json:"answerNumber,omitempty"`
	Comment      string   `json:"comment,omitempty"`
	Code         string   `json:"code,omitempty"`
}

type AIRequestPreview struct {
	SystemPrompt     string `json:"systemPrompt"`
	UserPrompt       string `json:"userPrompt"`
	ContextMode      string `json:"contextMode"`
	ContextLineCount int    `json:"contextLineCount"`
	Endpoint         string `json:"endpoint,omitempty"`
	ModelID          string `json:"modelId,omitempty"`
	RawContextText   string `json:"rawContextText,omitempty"`
	RawLinesAbove    []string `json:"rawLinesAbove,omitempty"`
	RawFullContent   string `json:"rawFullContent,omitempty"`
	RawInitialPayload string `json:"rawInitialPayload,omitempty"`
	RawExchangeLog   string `json:"rawExchangeLog,omitempty"`
	RawFinalMessage  string `json:"rawFinalMessage,omitempty"`
	RawFinalContent  string `json:"rawFinalContent,omitempty"`
}

type AIRunResponse struct {
	OK      bool             `json:"ok"`
	Error   string           `json:"error,omitempty"`
	Output  AIModelOutput    `json:"output"`
	Preview AIRequestPreview `json:"preview"`
}

type AIProgressEvent struct {
	Message string `json:"message"`
}

type openAIMessage struct {
	Role       string          `json:"role"`
	Content    string          `json:"content,omitempty"`
	ToolCallID string          `json:"tool_call_id,omitempty"`
	ToolCalls  []openAIToolCall `json:"tool_calls,omitempty"`
}

type openAIToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type openAITool struct {
	Type     string          `json:"type"`
	Function openAIToolFn    `json:"function"`
}

type openAIToolFn struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

type openAIChatRequest struct {
	Model       string          `json:"model"`
	Messages    []openAIMessage `json:"messages"`
	Tools       []openAITool    `json:"tools,omitempty"`
	ResponseFormat map[string]string `json:"response_format,omitempty"`
	Temperature float64         `json:"temperature,omitempty"`
}

type openAIChatResponse struct {
	Choices []struct {
		Message      openAIMessage `json:"message"`
		FinishReason string        `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

var calcEvalTool = openAITool{
	Type: "function",
	Function: openAIToolFn{
		Name:        "evaluate_expression",
		Description: "Evaluate a Run-Calc expression and return the result. Use this to verify that code lines you plan to suggest are valid and produce the expected output before including them in your response.",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"expression": map[string]interface{}{
					"type":        "string",
					"description": "A valid Run-Calc expression (e.g. \"sqrt(2)\" or \"avg([1,2,3])\").",
				},
			},
			"required": []string{"expression"},
		},
	},
}

func (a *App) GetAISettings() AISettingsResponse {
	a.aiMu.Lock()
	defer a.aiMu.Unlock()

	settings, err := loadAISettings()
	if err != nil {
		settings = defaultAISettings()
	}
	settings = normalizeAISettings(settings)
	keyStatus := resolveAIKeyStatus(settings)

	return AISettingsResponse{
		Settings:  settings,
		KeyStatus: keyStatus,
	}
}

func (a *App) GetAIKeyStatusForSettings(input AISettings) AIKeyStatus {
	a.aiMu.Lock()
	defer a.aiMu.Unlock()

	settings := normalizeAISettings(input)
	status := resolveAIKeyStatus(settings)
	if !status.HasKey && strings.Contains(strings.ToLower(status.LastError), "no api key configured") {
		status.LastError = fmt.Sprintf("No API key configured for selected provider (%s)", settings.ProviderPreset)
	}
	return status
}

func (a *App) SaveAISettings(next AISettings) AISettingsResponse {
	a.aiMu.Lock()
	defer a.aiMu.Unlock()

	currentSettings, loadErr := loadAISettings()
	if loadErr != nil {
		currentSettings = defaultAISettings()
	}
	currentSettings = normalizeAISettings(currentSettings)

	settings := normalizeAISettings(next)
	if err := validateCustomEndpointKeyReuse(settings); err != nil {
		keyStatus := resolveAIKeyStatus(currentSettings)
		keyStatus.LastError = fmt.Sprintf("settings validation failed: %v", err)
		return AISettingsResponse{Settings: currentSettings, KeyStatus: keyStatus}
	}
	if aiConnectionSettingsChanged(currentSettings, settings) {
		if err := validateAISettingsConnection(settings); err != nil {
			keyStatus := resolveAIKeyStatus(currentSettings)
			keyStatus.LastError = fmt.Sprintf("settings validation failed: %v", err)
			return AISettingsResponse{Settings: currentSettings, KeyStatus: keyStatus}
		}
	}

	if err := saveAISettings(settings); err != nil {
		keyStatus := resolveAIKeyStatus(currentSettings)
		keyStatus.LastError = fmt.Sprintf("settings save failed: %v", err)
		return AISettingsResponse{
			Settings:  currentSettings,
			KeyStatus: keyStatus,
		}
	}

	keyStatus := resolveAIKeyStatus(settings)
	return AISettingsResponse{Settings: settings, KeyStatus: keyStatus}
}

func aiConnectionSettingsChanged(current AISettings, next AISettings) bool {
	return current.ProviderPreset != next.ProviderPreset ||
		current.Endpoint != next.Endpoint ||
		current.ModelID != next.ModelID ||
		current.RequestTimeoutSeconds != next.RequestTimeoutSeconds ||
		current.AllowInsecureKeyFallback != next.AllowInsecureKeyFallback
}

func validateAISettingsConnection(settings AISettings) error {
	if err := validateCustomEndpointKeyReuse(settings); err != nil {
		return err
	}

	apiKey, _, err := loadAIAPIKey(settings)
	if err != nil {
		return fmt.Errorf("AI API key is not available: %w", err)
	}

	payload := openAIChatRequest{
		Model: settings.ModelID,
		Messages: []openAIMessage{
			{Role: "system", Content: "You are a connectivity test assistant. Reply with OK."},
			{Role: "user", Content: "Reply with OK."},
		},
		Temperature: 0,
	}

	_, err = callOpenAICompatibleChat(settings, apiKey, payload)
	if err != nil {
		return err
	}
	return nil
}

func (a *App) SetAIAPIKey(apiKey string, input AISettings) AIKeyStatus {
	a.aiMu.Lock()
	defer a.aiMu.Unlock()

	settings := normalizeAISettings(input)

	if strings.TrimSpace(apiKey) == "" {
		return AIKeyStatus{HasKey: false, StorageMode: "none", LastError: "API key is empty"}
	}

	if err := keyring.Set(aiServiceName, aiAPIKeyUserForSettings(settings), strings.TrimSpace(apiKey)); err == nil {
		_ = removeAIInsecureKeyFileForSettings(settings)
		return resolveAIKeyStatus(settings)
	} else if canUseLinuxFallback(settings) {
		writeErr := writeAIInsecureKeyFileForSettings(settings, strings.TrimSpace(apiKey))
		if writeErr == nil {
			status := resolveAIKeyStatus(settings)
			if status.LastError == "" {
				status.LastError = err.Error()
			}
			return status
		}
		return AIKeyStatus{HasKey: false, StorageMode: "none", LastError: fmt.Sprintf("secure store failed: %v; fallback failed: %v", err, writeErr)}
	} else {
		return AIKeyStatus{HasKey: false, StorageMode: "none", LastError: err.Error()}
	}
}

func (a *App) ClearAIAPIKey(input AISettings) AIKeyStatus {
	a.aiMu.Lock()
	defer a.aiMu.Unlock()

	settings := normalizeAISettings(input)

	_ = keyring.Delete(aiServiceName, aiAPIKeyUserForSettings(settings))
	_ = removeAIInsecureKeyFileForSettings(settings)
	return AIKeyStatus{HasKey: false, StorageMode: "none"}
}

func (a *App) RunAIQuery(request AIRunRequest) AIRunResponse {
	a.aiMu.Lock()
	settings := defaultAISettings()
	if request.SettingsOverride != nil {
		settings = normalizeAISettings(*request.SettingsOverride)
	} else {
		loadedSettings, _ := loadAISettings()
		settings = normalizeAISettings(loadedSettings)
	}
	if reuseErr := validateCustomEndpointKeyReuse(settings); reuseErr != nil {
		a.aiMu.Unlock()
		return AIRunResponse{
			OK:    false,
			Error: fmt.Sprintf("AI settings validation failed: %v", reuseErr),
			Preview: AIRequestPreview{
				SystemPrompt: defaultAISystemPromptTemplate,
				ContextMode:  normalizeAIContextModeWithDefault(request.ContextMode, settings.DefaultContextMode),
				Endpoint:     settings.Endpoint,
				ModelID:      settings.ModelID,
			},
		}
	}
	apiKey, keyMode, keyErr := loadAIAPIKey(settings)
	a.aiMu.Unlock()
	a.emitAIProgress("preparing request")

	prompt, explainMode := parseAIPromptMode(request.Prompt)
	systemPrompt := defaultAISystemPromptTemplate
	if explainMode {
		systemPrompt += explainModeInjection
	}

	if keyErr != nil {
		return AIRunResponse{
			OK:    false,
			Error: fmt.Sprintf("AI API key is not available: %v", keyErr),
			Preview: AIRequestPreview{
				SystemPrompt: systemPrompt,
				ContextMode:  normalizeAIContextMode(request.ContextMode),
				Endpoint:     settings.Endpoint,
				ModelID:      settings.ModelID,
			},
		}
	}

	if prompt == "" {
		return AIRunResponse{
			OK:    false,
			Error: "AI prompt is empty",
			Preview: AIRequestPreview{
				SystemPrompt: systemPrompt,
				UserPrompt:   "",
				ContextMode:  normalizeAIContextModeWithDefault(request.ContextMode, settings.DefaultContextMode),
				Endpoint:     settings.Endpoint,
				ModelID:      settings.ModelID,
			},
		}
	}

	contextMode := normalizeAIContextModeWithDefault(request.ContextMode, settings.DefaultContextMode)
	contextLineCount := len(request.LinesAbove)
	contextText := strings.Join(request.LinesAbove, "\n")
	if contextMode == "full" {
		contextLineCount = len(strings.Split(request.FullContent, "\n"))
		contextText = request.FullContent
	}

	if strings.TrimSpace(contextText) == "" {
		contextText = "(empty worksheet context)"
	}

	preview := AIRequestPreview{
		SystemPrompt:     systemPrompt,
		UserPrompt:       buildAIUserMessage(prompt, contextMode, contextText),
		ContextMode:      contextMode,
		ContextLineCount: contextLineCount,
		Endpoint:         settings.Endpoint,
		ModelID:          settings.ModelID,
		RawContextText:   contextText,
		RawLinesAbove:    append([]string(nil), request.LinesAbove...),
		RawFullContent:   request.FullContent,
	}

	payload := openAIChatRequest{
		Model: settings.ModelID,
		Messages: []openAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: buildAIUserMessage(prompt, contextMode, contextText)},
		},
		Tools:       []openAITool{calcEvalTool},
		Temperature: 0.2,
	}
	if shouldUseJSONResponseFormat(settings) {
		payload.ResponseFormat = map[string]string{"type": "json_object"}
	}
	if payloadJSON, marshalErr := json.Marshal(payload); marshalErr == nil {
		preview.RawInitialPayload = string(payloadJSON)
	}

	// Tool-call loop: allow a bounded number of evaluate_expression calls.
	var rawContent string
	rawExchangeLog := make([]string, 0, maxAIToolCallRounds+maxAIInvalidJSONRepairs)
	for round := 0; round < maxAIToolCallRounds; round++ {
		if round == 0 {
			a.emitAIProgress("thinking")
		} else {
			a.emitAIProgress(fmt.Sprintf("continuing after tool step %d/%d", round, maxAIToolCallRounds))
		}
		requestJSON := ""
		if payloadJSON, marshalErr := json.Marshal(payload); marshalErr == nil {
			requestJSON = string(payloadJSON)
		}

		msg, rawResponseBody, err := callOpenAICompatibleChatMessage(settings, apiKey, payload)
		rawExchangeLog = append(rawExchangeLog,
			fmt.Sprintf("round=%d request_json:\n%s\n\nround=%d raw_response_body:\n%s", round+1, requestJSON, round+1, rawResponseBody),
		)
		preview.RawExchangeLog = strings.Join(rawExchangeLog, "\n\n")
		if err != nil {
			// Some providers (for example Gemini OpenAI-compatible) reject
			// response_format JSON mode when function calling is enabled.
			if payload.ResponseFormat != nil && strings.Contains(strings.ToLower(err.Error()), "function calling") && strings.Contains(strings.ToLower(err.Error()), "application/json") {
				a.emitAIProgress("adjusting provider format settings")
				payload.ResponseFormat = nil
				rawExchangeLog = append(rawExchangeLog, "retry: removing response_format and retrying same round")
				preview.RawExchangeLog = strings.Join(rawExchangeLog, "\n\n")
				round--
				continue
			}
			if keyMode == "insecure-file" {
				return AIRunResponse{OK: false, Error: fmt.Sprintf("AI request failed (%s): %v", keyMode, err), Preview: preview}
			}
			return AIRunResponse{OK: false, Error: fmt.Sprintf("AI request failed: %v", err), Preview: preview}
		}
		if messageJSON, marshalErr := json.Marshal(msg); marshalErr == nil {
			preview.RawFinalMessage = string(messageJSON)
		}

		if len(msg.ToolCalls) == 0 {
			rawContent = strings.TrimSpace(msg.Content)
			preview.RawFinalContent = rawContent
			if rawContent != "" {
				break
			}

			if len(payload.Tools) > 0 && round < maxAIToolCallRounds-1 {
				a.emitAIProgress("asking model for final JSON")
				rawExchangeLog = append(rawExchangeLog, "assistant returned empty content; retrying once without tools for final JSON")
				preview.RawExchangeLog = strings.Join(rawExchangeLog, "\n\n")
				payload.Tools = nil
				payload.Messages = append(payload.Messages, openAIMessage{
					Role:    "user",
					Content: "Return a final JSON object now using keys answerNumber/answer/comment/code as needed. Do not call tools.",
				})
				continue
			}

			return AIRunResponse{OK: false, Error: "AI returned empty content", Preview: preview}
		}

		// Append assistant message with tool calls.
		payload.Messages = append(payload.Messages, msg)

		// Execute each tool call and append results.
		for _, tc := range msg.ToolCalls {
			a.emitAIProgress(fmt.Sprintf("running tool %s", tc.Function.Name))
			var result string
			toolLog := fmt.Sprintf("tool_call id=%s type=%s function=%s args=%s", tc.ID, tc.Type, tc.Function.Name, tc.Function.Arguments)
			if tc.Type == "function" && tc.Function.Name == "evaluate_expression" {
				var args struct {
					Expression string `json:"expression"`
				}
				if jsonErr := json.Unmarshal([]byte(tc.Function.Arguments), &args); jsonErr == nil && strings.TrimSpace(args.Expression) != "" {
					scope := map[string]interface{}{}
					val, evalErr := evaluateExprProgram(args.Expression, scope)
					if evalErr != nil {
						result = fmt.Sprintf("error: %v", evalErr)
					} else {
						result = fmt.Sprintf("%v", val)
					}
				} else {
					result = "error: invalid arguments"
				}
			} else {
				result = "error: unknown tool"
			}
			rawExchangeLog = append(rawExchangeLog, toolLog+"\n"+"tool_result: "+result)
			preview.RawExchangeLog = strings.Join(rawExchangeLog, "\n\n")
			if strings.HasPrefix(result, "error:") {
				a.emitAIProgress("tool found an issue, asking model to correct it")
			} else {
				a.emitAIProgress("tool finished, waiting for model")
			}
			payload.Messages = append(payload.Messages, openAIMessage{
				Role:       "tool",
				ToolCallID: tc.ID,
				Content:    result,
			})
		}
	}

	if rawContent == "" {
		return AIRunResponse{OK: false, Error: "AI did not return a final response after tool calls", Preview: preview}
	}

	parsed, parseErr := parseStructuredAIOutput(rawContent)
	for repairAttempt := 0; parseErr != nil && repairAttempt < maxAIInvalidJSONRepairs; repairAttempt++ {
		a.emitAIProgress(fmt.Sprintf("repairing invalid JSON %d/%d", repairAttempt+1, maxAIInvalidJSONRepairs))
		repairPayload := openAIChatRequest{
			Model: settings.ModelID,
			Messages: []openAIMessage{
				{Role: "system", Content: systemPrompt},
				{Role: "user", Content: buildAIUserMessage(prompt, contextMode, contextText)},
				{Role: "assistant", Content: rawContent},
				{Role: "user", Content: fmt.Sprintf("Your previous response was not valid JSON for the required schema. Fix it and return only a valid JSON object with keys answerNumber/answer/comment/code. Do not use markdown fences. Parse error: %v", parseErr)},
			},
			Temperature: 0.2,
		}
		if shouldUseJSONResponseFormat(settings) {
			repairPayload.ResponseFormat = map[string]string{"type": "json_object"}
		}

		requestJSON := ""
		if payloadJSON, marshalErr := json.Marshal(repairPayload); marshalErr == nil {
			requestJSON = string(payloadJSON)
		}

		rawExchangeLog = append(rawExchangeLog, fmt.Sprintf("json_repair_attempt=%d parse_error=%v", repairAttempt+1, parseErr))
		msg, rawResponseBody, err := callOpenAICompatibleChatMessage(settings, apiKey, repairPayload)
		rawExchangeLog = append(rawExchangeLog,
			fmt.Sprintf("json_repair_attempt=%d request_json:\n%s\n\njson_repair_attempt=%d raw_response_body:\n%s", repairAttempt+1, requestJSON, repairAttempt+1, rawResponseBody),
		)
		preview.RawExchangeLog = strings.Join(rawExchangeLog, "\n\n")
		if err != nil {
			if repairPayload.ResponseFormat != nil && strings.Contains(strings.ToLower(err.Error()), "function calling") && strings.Contains(strings.ToLower(err.Error()), "application/json") {
				a.emitAIProgress("adjusting provider format settings")
				repairPayload.ResponseFormat = nil
				rawExchangeLog = append(rawExchangeLog, fmt.Sprintf("json_repair_attempt=%d retry: removing response_format and retrying", repairAttempt+1))
				preview.RawExchangeLog = strings.Join(rawExchangeLog, "\n\n")
				repairAttempt--
				continue
			}
			return AIRunResponse{OK: false, Error: fmt.Sprintf("AI response repair failed: %v", err), Preview: preview}
		}

		rawContent = strings.TrimSpace(msg.Content)
		preview.RawFinalContent = rawContent
		if messageJSON, marshalErr := json.Marshal(msg); marshalErr == nil {
			preview.RawFinalMessage = string(messageJSON)
		}
		parsed, parseErr = parseStructuredAIOutput(rawContent)
	}
	if parseErr != nil {
		return AIRunResponse{OK: false, Error: fmt.Sprintf("AI response was not valid structured JSON after %d repair attempts: %v", maxAIInvalidJSONRepairs, parseErr), Preview: preview}
	}
	a.emitAIProgress("finalizing response")

	return AIRunResponse{OK: true, Output: parsed, Preview: preview}
}

func (a *App) emitAIProgress(message string) {
	if a == nil || a.ctx == nil {
		return
	}
	wruntime.EventsEmit(a.ctx, "ai:progress", AIProgressEvent{Message: message})
}

func normalizeAIContextMode(mode string) string {
	normalized := strings.ToLower(strings.TrimSpace(mode))
	if normalized == "full" {
		return "full"
	}
	return "above"
}

func normalizeAIContextModeWithDefault(mode string, fallback string) string {
	normalized := strings.ToLower(strings.TrimSpace(mode))
	if normalized == "full" || normalized == "above" {
		return normalized
	}
	return normalizeAIContextMode(fallback)
}

func defaultAISettings() AISettings {
	return AISettings{
		ProviderPreset:           defaultAIProviderPreset,
		Endpoint:                 defaultAIOpenAIEndpoint,
		ModelID:                  defaultAIOpenAIModel,
		DefaultContextMode:       "above",
		AllowInsecureKeyFallback: false,
		AllowCustomEndpointKeyReuse: false,
		RequestTimeoutSeconds:    45,
	}
}

func normalizeAISettings(in AISettings) AISettings {
	settings := in
	preset := strings.ToLower(strings.TrimSpace(settings.ProviderPreset))
	switch preset {
	case defaultAIProviderPreset, geminiAIProviderPreset, openRouterAIProviderPreset, anthropicAIProviderPreset, customAIProviderPreset:
		// allowed preset
	default:
		preset = defaultAIProviderPreset
	}
	settings.ProviderPreset = preset

	if strings.TrimSpace(settings.Endpoint) == "" {
		switch preset {
		case geminiAIProviderPreset:
			settings.Endpoint = defaultAIGeminiEndpoint
		case openRouterAIProviderPreset, anthropicAIProviderPreset:
			settings.Endpoint = defaultAIOpenRouterEndpoint
		default:
			settings.Endpoint = defaultAIOpenAIEndpoint
		}
	}

	if strings.TrimSpace(settings.ModelID) == "" {
		switch preset {
		case geminiAIProviderPreset:
			settings.ModelID = defaultAIGeminiModel
		case openRouterAIProviderPreset:
			settings.ModelID = defaultAIOpenRouterModel
		case anthropicAIProviderPreset:
			settings.ModelID = defaultAIAnthropicModel
		default:
			settings.ModelID = defaultAIOpenAIModel
		}
	}

	settings.DefaultContextMode = normalizeAIContextMode(settings.DefaultContextMode)
	settings.CustomKeySourceEndpoint = strings.TrimSpace(settings.CustomKeySourceEndpoint)
	if settings.ProviderPreset != customAIProviderPreset {
		settings.AllowCustomEndpointKeyReuse = false
		settings.CustomKeySourceEndpoint = ""
	}
	if settings.RequestTimeoutSeconds < 5 || settings.RequestTimeoutSeconds > 180 {
		settings.RequestTimeoutSeconds = 45
	}

	settings.Endpoint = strings.TrimSpace(settings.Endpoint)
	settings.ModelID = strings.TrimSpace(settings.ModelID)

	return settings
}

func aiConfigDir() (string, error) {
	baseDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(baseDir, "Run-Calc"), nil
}

func aiSettingsFilePath() (string, error) {
	dir, err := aiConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "ai_settings.json"), nil
}

func aiInsecureKeyFilePathForSettings(settings AISettings) (string, error) {
	dir, err := aiConfigDir()
	if err != nil {
		return "", err
	}
	preset := strings.ToLower(strings.TrimSpace(settings.ProviderPreset))
	if preset == "" {
		preset = defaultAIProviderPreset
	}
	return filepath.Join(dir, fmt.Sprintf("ai_api_key_%s.txt", preset)), nil
}

func ensureAIConfigDir() error {
	dir, err := aiConfigDir()
	if err != nil {
		return err
	}
	return os.MkdirAll(dir, 0o700)
}

func loadAISettings() (AISettings, error) {
	filePath, err := aiSettingsFilePath()
	if err != nil {
		return AISettings{}, err
	}

	raw, err := os.ReadFile(filePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return defaultAISettings(), nil
		}
		return AISettings{}, err
	}

	var parsed AISettings
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return AISettings{}, err
	}

	return normalizeAISettings(parsed), nil
}

func saveAISettings(settings AISettings) error {
	if err := ensureAIConfigDir(); err != nil {
		return err
	}

	filePath, err := aiSettingsFilePath()
	if err != nil {
		return err
	}

	normalized := normalizeAISettings(settings)
	payload, err := json.MarshalIndent(normalized, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filePath, payload, 0o600)
}

func canUseLinuxFallback(settings AISettings) bool {
	return runtime.GOOS == "linux" && settings.AllowInsecureKeyFallback
}

func writeAIInsecureKeyFileForSettings(settings AISettings, value string) error {
	if err := ensureAIConfigDir(); err != nil {
		return err
	}
	filePath, err := aiInsecureKeyFilePathForSettings(settings)
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, []byte(value), 0o600)
}

func removeAIInsecureKeyFileForSettings(settings AISettings) error {
	filePath, err := aiInsecureKeyFilePathForSettings(settings)
	if err != nil {
		return err
	}
	err = os.Remove(filePath)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func aiAPIKeyUserForSettings(settings AISettings) string {
	preset := strings.ToLower(strings.TrimSpace(settings.ProviderPreset))
	if preset == "" {
		preset = defaultAIProviderPreset
	}
	return fmt.Sprintf("byok-openai-compatible-%s", preset)
}

func loadAIAPIKey(settings AISettings) (string, string, error) {
	secret, secureErr := keyring.Get(aiServiceName, aiAPIKeyUserForSettings(settings))
	if secureErr != nil && errors.Is(secureErr, keyring.ErrNotFound) {
		legacySecret, legacyErr := keyring.Get(aiServiceName, aiLegacyAPIKeyUser)
		if legacyErr == nil {
			return strings.TrimSpace(legacySecret), "secure", nil
		}
	}
	if secureErr == nil {
		return strings.TrimSpace(secret), "secure", nil
	} else if canUseLinuxFallback(settings) {
		filePath, pathErr := aiInsecureKeyFilePathForSettings(settings)
		if pathErr != nil {
			return "", "none", pathErr
		}
		fileData, fileErr := os.ReadFile(filePath)
		if fileErr != nil && errors.Is(fileErr, os.ErrNotExist) {
			legacyFilePath, legacyPathErr := aiConfigDir()
			if legacyPathErr == nil {
				legacyData, legacyFileErr := os.ReadFile(filepath.Join(legacyFilePath, "ai_api_key.txt"))
				if legacyFileErr == nil {
					value := strings.TrimSpace(string(legacyData))
					if value != "" {
						return value, "insecure-file", nil
					}
				}
			}
		}
		if fileErr == nil {
			value := strings.TrimSpace(string(fileData))
			if value != "" {
				return value, "insecure-file", nil
			}
		}
		if errors.Is(secureErr, keyring.ErrNotFound) || errors.Is(fileErr, os.ErrNotExist) {
			return "", "none", fmt.Errorf("no API key configured")
		}
		if fileErr != nil {
			return "", "none", fmt.Errorf("secure store unavailable (%v); fallback key file error (%v)", secureErr, fileErr)
		}
		return "", "none", fmt.Errorf("secure store unavailable: %v", secureErr)
	}

	if errors.Is(secureErr, keyring.ErrNotFound) {
		return "", "none", fmt.Errorf("no API key configured")
	}
	return "", "none", secureErr
}

func resolveAIKeyStatus(settings AISettings) AIKeyStatus {
	_, mode, err := loadAIAPIKey(settings)
	if err != nil {
		return AIKeyStatus{HasKey: false, StorageMode: "none", LastError: err.Error()}
	}
	return AIKeyStatus{HasKey: true, StorageMode: mode}
}

func validateCustomEndpointKeyReuse(settings AISettings) error {
	if settings.ProviderPreset != customAIProviderPreset {
		return nil
	}

	apiKey, _, keyErr := loadAIAPIKey(settings)
	if keyErr != nil || strings.TrimSpace(apiKey) == "" {
		return nil
	}

	source := strings.TrimSpace(settings.CustomKeySourceEndpoint)
	if source == "" {
		return nil
	}

	from, fromErr := normalizedChatEndpointFor(source, true)
	if fromErr != nil {
		from = source
	}
	to, toErr := normalizedChatEndpointFor(settings.Endpoint, true)
	if toErr != nil {
		to = strings.TrimSpace(settings.Endpoint)
	}

	if !strings.EqualFold(from, to) && !settings.AllowCustomEndpointKeyReuse {
		return fmt.Errorf("custom endpoint changed from %q to %q. Existing custom API key would be reused. Enable \"Allow key reuse across custom endpoints\" or clear/save a new key first", from, to)
	}

	return nil
}

func buildAIUserMessage(prompt string, contextMode string, contextText string) string {
	return fmt.Sprintf("Prompt:\n%s\n\nWorksheet context mode: %s\nWorksheet context:\n%s\n\nReturn only a JSON object.", prompt, contextMode, contextText)
}

func parseAIPromptMode(rawPrompt string) (string, bool) {
	trimmed := strings.TrimSpace(rawPrompt)
	if strings.HasPrefix(trimmed, "??") {
		return strings.TrimSpace(strings.TrimPrefix(trimmed, "??")), true
	}
	return trimmed, false
}

// isCustomPreset returns true when the user has selected the custom provider,
// which allows local LLM endpoints (e.g. Ollama on http://localhost).
func isCustomPreset(preset string) bool {
	return strings.EqualFold(strings.TrimSpace(preset), customAIProviderPreset)
}

func normalizedChatEndpoint(rawEndpoint string) (string, error) {
	return normalizedChatEndpointFor(rawEndpoint, false)
}

func normalizedChatEndpointFor(rawEndpoint string, allowInsecureLocalHTTP bool) (string, error) {
	trimmed := strings.TrimSpace(rawEndpoint)
	if trimmed == "" {
		return "", fmt.Errorf("AI endpoint is empty")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", err
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("AI endpoint must be an absolute URL")
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "https" && scheme != "http" {
		return "", fmt.Errorf("AI endpoint scheme must be http or https")
	}

	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	if host == "" {
		return "", fmt.Errorf("AI endpoint host is empty")
	}

	isLocalHost := host == "localhost" || strings.HasSuffix(host, ".localhost")
	if ip := net.ParseIP(host); ip != nil {
		if ip.IsLoopback() {
			isLocalHost = true
		}
	}

	if !allowInsecureLocalHTTP {
		if scheme != "https" {
			return "", fmt.Errorf("AI endpoint must use HTTPS")
		}
		if isLocalHost {
			return "", fmt.Errorf("AI endpoint host is not allowed")
		}
	} else if scheme == "http" && !isLocalHost {
		return "", fmt.Errorf("AI endpoint must use HTTPS for non-local hosts")
	}

	if strings.HasSuffix(parsed.Path, "/chat/completions") {
		return parsed.String(), nil
	}

	if strings.HasSuffix(parsed.Path, "/") {
		parsed.Path += "chat/completions"
	} else {
		parsed.Path += "/chat/completions"
	}

	return parsed.String(), nil
}

func shouldUseJSONResponseFormat(settings AISettings) bool {
	preset := strings.ToLower(strings.TrimSpace(settings.ProviderPreset))
	if preset == defaultAIProviderPreset {
		return true
	}

	endpoint := strings.TrimSpace(settings.Endpoint)
	if endpoint == "" {
		return false
	}

	parsed, err := url.Parse(endpoint)
	if err != nil {
		return false
	}

	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	return host == "api.openai.com"
}

func normalizedSDKBaseURL(rawEndpoint string) (string, error) {
	return normalizedSDKBaseURLFor(rawEndpoint, false)
}

func normalizedSDKBaseURLFor(rawEndpoint string, allowInsecureLocalHTTP bool) (string, error) {
	chatEndpoint, err := normalizedChatEndpointFor(rawEndpoint, allowInsecureLocalHTTP)
	if err != nil {
		return "", err
	}
	parsed, err := url.Parse(chatEndpoint)
	if err != nil {
		return "", err
	}

	parsed.Path = strings.TrimSuffix(parsed.Path, "/chat/completions")
	parsed.RawPath = ""

	return parsed.String(), nil
}

func toSDKMessages(messages []openAIMessage) []openai.ChatCompletionMessageParamUnion {
	result := make([]openai.ChatCompletionMessageParamUnion, 0, len(messages))
	for _, m := range messages {
		role := strings.ToLower(strings.TrimSpace(m.Role))
		switch role {
		case "system":
			result = append(result, openai.SystemMessage(m.Content))
		case "assistant":
			if len(m.ToolCalls) == 0 {
				result = append(result, openai.AssistantMessage(m.Content))
				continue
			}

			toolCalls := make([]openai.ChatCompletionMessageToolCallParam, 0, len(m.ToolCalls))
			for _, tc := range m.ToolCalls {
				toolCalls = append(toolCalls, openai.ChatCompletionMessageToolCallParam{
					ID: tc.ID,
					Function: openai.ChatCompletionMessageToolCallFunctionParam{
						Name:      tc.Function.Name,
						Arguments: tc.Function.Arguments,
					},
				})
			}

			assistant := openai.ChatCompletionAssistantMessageParam{ToolCalls: toolCalls}
			if strings.TrimSpace(m.Content) != "" {
				assistant.Content = openai.ChatCompletionAssistantMessageParamContentUnion{OfString: param.NewOpt(m.Content)}
			}
			result = append(result, openai.ChatCompletionMessageParamUnion{OfAssistant: &assistant})
		case "tool":
			result = append(result, openai.ToolMessage(m.Content, m.ToolCallID))
		case "user":
			fallthrough
		default:
			result = append(result, openai.UserMessage(m.Content))
		}
	}
	return result
}

func callOpenAICompatibleChatMessageLegacy(settings AISettings, apiKey string, payload openAIChatRequest) (openAIMessage, string, error) {
	endpoint, err := normalizedChatEndpointFor(settings.Endpoint, isCustomPreset(settings.ProviderPreset))
	if err != nil {
		return openAIMessage{}, "", err
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return openAIMessage{}, "", err
	}

	timeout := time.Duration(settings.RequestTimeoutSeconds) * time.Second
	client := &http.Client{Timeout: timeout}
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return openAIMessage{}, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return openAIMessage{}, "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return openAIMessage{}, "", err
	}
	rawResponseBody := string(respBody)

	var decoded openAIChatResponse
	if err := json.Unmarshal(respBody, &decoded); err != nil {
		// Some OpenAI-compatible providers can return a top-level array.
		var responseArray []openAIChatResponse
		if arrErr := json.Unmarshal(respBody, &responseArray); arrErr == nil && len(responseArray) > 0 {
			decoded = responseArray[0]
		} else {
			// Fallback: array may directly contain choice objects.
			var choiceArray []struct {
				Message      openAIMessage `json:"message"`
				FinishReason string        `json:"finish_reason"`
			}
			if choiceErr := json.Unmarshal(respBody, &choiceArray); choiceErr == nil && len(choiceArray) > 0 {
				decoded.Choices = make([]struct {
					Message      openAIMessage `json:"message"`
					FinishReason string        `json:"finish_reason"`
				}, len(choiceArray))
				for i, c := range choiceArray {
					decoded.Choices[i].Message = c.Message
					decoded.Choices[i].FinishReason = c.FinishReason
				}
			} else {
				return openAIMessage{}, rawResponseBody, fmt.Errorf("invalid API response JSON: %w", err)
			}
		}
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if decoded.Error != nil && strings.TrimSpace(decoded.Error.Message) != "" {
			return openAIMessage{}, rawResponseBody, fmt.Errorf("%s", decoded.Error.Message)
		}
		return openAIMessage{}, rawResponseBody, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	if len(decoded.Choices) == 0 {
		return openAIMessage{}, rawResponseBody, fmt.Errorf("API returned no choices")
	}

	msg := decoded.Choices[0].Message
	// Trim content when it is a final text response (no tool calls).
	if len(msg.ToolCalls) == 0 {
		msg.Content = strings.TrimSpace(msg.Content)
	}
	return msg, rawResponseBody, nil
}

func callOpenAICompatibleChatMessage(settings AISettings, apiKey string, payload openAIChatRequest) (openAIMessage, string, error) {
	sdkBaseURL, err := normalizedSDKBaseURLFor(settings.Endpoint, isCustomPreset(settings.ProviderPreset))
	if err != nil {
		return openAIMessage{}, "", err
	}

	tools := make([]openai.ChatCompletionToolParam, 0, len(payload.Tools))
	for _, t := range payload.Tools {
		tools = append(tools, openai.ChatCompletionToolParam{
			Function: shared.FunctionDefinitionParam{
				Name:        t.Function.Name,
				Description: param.NewOpt(t.Function.Description),
				Parameters:  shared.FunctionParameters(t.Function.Parameters),
			},
		})
	}

	params := openai.ChatCompletionNewParams{
		Model:    shared.ChatModel(payload.Model),
		Messages: toSDKMessages(payload.Messages),
		Tools:    tools,
	}
	if payload.Temperature != 0 {
		params.Temperature = param.NewOpt(payload.Temperature)
	}
	if payload.ResponseFormat != nil && strings.EqualFold(payload.ResponseFormat["type"], "json_object") {
		rf := shared.NewResponseFormatJSONObjectParam()
		params.ResponseFormat = openai.ChatCompletionNewParamsResponseFormatUnion{OfJSONObject: &rf}
	}

	requestTimeout := time.Duration(settings.RequestTimeoutSeconds) * time.Second
	client := openai.NewClient(
		option.WithAPIKey(apiKey),
		option.WithBaseURL(sdkBaseURL),
		option.WithRequestTimeout(requestTimeout),
		option.WithMaxRetries(0),
	)

	res, sdkErr := client.Chat.Completions.New(context.Background(), params)
	if sdkErr != nil {
		// Fallback for non-standard OpenAI-compatible providers.
		legacyMsg, legacyRaw, legacyErr := callOpenAICompatibleChatMessageLegacy(settings, apiKey, payload)
		if legacyErr == nil {
			return legacyMsg, legacyRaw, nil
		}
		combinedErr := errors.Join(
			fmt.Errorf("sdk chat completions request failed: %w", sdkErr),
			fmt.Errorf("legacy OpenAI-compatible fallback failed: %w", legacyErr),
		)
		if legacyRaw != "" {
			return openAIMessage{}, legacyRaw, fmt.Errorf("%w; legacy response body: %s", combinedErr, legacyRaw)
		}
		return openAIMessage{}, legacyRaw, combinedErr
	}

	rawResponseBody := res.RawJSON()
	if len(res.Choices) == 0 {
		return openAIMessage{}, rawResponseBody, fmt.Errorf("API returned no choices")
	}

	choice := res.Choices[0]
	message := choice.Message
	result := openAIMessage{
		Role:    "assistant",
		Content: message.Content,
	}
	if len(message.ToolCalls) > 0 {
		result.ToolCalls = make([]openAIToolCall, 0, len(message.ToolCalls))
		for _, tc := range message.ToolCalls {
			mapped := openAIToolCall{
				ID:   tc.ID,
				Type: "function",
			}
			mapped.Function.Name = tc.Function.Name
			mapped.Function.Arguments = tc.Function.Arguments
			result.ToolCalls = append(result.ToolCalls, mapped)
		}
	}

	if len(result.ToolCalls) == 0 {
		result.Content = strings.TrimSpace(result.Content)
	}

	_ = choice.FinishReason // already represented by presence/absence of tool calls in current flow.
	return result, rawResponseBody, nil
}

func callOpenAICompatibleChat(settings AISettings, apiKey string, payload openAIChatRequest) (string, error) {
	msg, _, err := callOpenAICompatibleChatMessage(settings, apiKey, payload)
	if err != nil {
		return "", err
	}
	return msg.Content, nil
}

func parseStructuredAIOutput(raw string) (AIModelOutput, error) {
	normalized := strings.TrimSpace(raw)
	if strings.HasPrefix(normalized, "```") {
		normalized = strings.TrimPrefix(normalized, "```json")
		normalized = strings.TrimPrefix(normalized, "```")
		normalized = strings.TrimSuffix(normalized, "```")
		normalized = strings.TrimSpace(normalized)
	}

	var loose map[string]interface{}
	if err := json.Unmarshal([]byte(normalized), &loose); err != nil {
		return AIModelOutput{}, err
	}

	output := AIModelOutput{}
	if rawAnswer, ok := loose["answer"]; ok {
		output.Answer = strings.TrimSpace(fmt.Sprintf("%v", rawAnswer))
	}
	if rawComment, ok := loose["comment"]; ok {
		output.Comment = strings.TrimSpace(fmt.Sprintf("%v", rawComment))
	}
	if rawCode, ok := loose["code"]; ok {
		output.Code = strings.TrimSpace(fmt.Sprintf("%v", rawCode))
	}
	if rawNumber, ok := loose["answerNumber"]; ok {
		switch typed := rawNumber.(type) {
		case float64:
			v := typed
			output.AnswerNumber = &v
		case string:
			if parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64); err == nil {
				v := parsed
				output.AnswerNumber = &v
			}
		}
	}

	if output.Answer == "" && output.AnswerNumber == nil && output.Comment == "" && output.Code == "" {
		return AIModelOutput{}, fmt.Errorf("response JSON has none of answer/answerNumber/comment/code")
	}

	return output, nil
}
