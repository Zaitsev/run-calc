export namespace main {
	
	export class AIKeyStatus {
	    hasKey: boolean;
	    storageMode: string;
	    lastError?: string;
	
	    static createFrom(source: any = {}) {
	        return new AIKeyStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hasKey = source["hasKey"];
	        this.storageMode = source["storageMode"];
	        this.lastError = source["lastError"];
	    }
	}
	export class AIModelOutput {
	    answer?: string;
	    answerNumber?: number;
	    comment?: string;
	    code?: string;
	
	    static createFrom(source: any = {}) {
	        return new AIModelOutput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.answer = source["answer"];
	        this.answerNumber = source["answerNumber"];
	        this.comment = source["comment"];
	        this.code = source["code"];
	    }
	}
	export class AIRequestPreview {
	    systemPrompt: string;
	    userPrompt: string;
	    contextMode: string;
	    contextLineCount: number;
	    endpoint?: string;
	    modelId?: string;
	    rawContextText?: string;
	    rawLinesAbove?: string[];
	    rawFullContent?: string;
	    rawInitialPayload?: string;
	    rawExchangeLog?: string;
	    rawFinalMessage?: string;
	    rawFinalContent?: string;
	
	    static createFrom(source: any = {}) {
	        return new AIRequestPreview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.systemPrompt = source["systemPrompt"];
	        this.userPrompt = source["userPrompt"];
	        this.contextMode = source["contextMode"];
	        this.contextLineCount = source["contextLineCount"];
	        this.endpoint = source["endpoint"];
	        this.modelId = source["modelId"];
	        this.rawContextText = source["rawContextText"];
	        this.rawLinesAbove = source["rawLinesAbove"];
	        this.rawFullContent = source["rawFullContent"];
	        this.rawInitialPayload = source["rawInitialPayload"];
	        this.rawExchangeLog = source["rawExchangeLog"];
	        this.rawFinalMessage = source["rawFinalMessage"];
	        this.rawFinalContent = source["rawFinalContent"];
	    }
	}
	export class AISettings {
	    providerPreset: string;
	    endpoint: string;
	    modelId: string;
	    defaultContextMode: string;
	    allowInsecureKeyFallback: boolean;
	    allowCustomEndpointKeyReuse: boolean;
	    customKeySourceEndpoint?: string;
	    requestTimeoutSeconds: number;
	
	    static createFrom(source: any = {}) {
	        return new AISettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.providerPreset = source["providerPreset"];
	        this.endpoint = source["endpoint"];
	        this.modelId = source["modelId"];
	        this.defaultContextMode = source["defaultContextMode"];
	        this.allowInsecureKeyFallback = source["allowInsecureKeyFallback"];
	        this.allowCustomEndpointKeyReuse = source["allowCustomEndpointKeyReuse"];
	        this.customKeySourceEndpoint = source["customKeySourceEndpoint"];
	        this.requestTimeoutSeconds = source["requestTimeoutSeconds"];
	    }
	}
	export class AIRunRequest {
	    prompt: string;
	    contextMode?: string;
	    linesAbove?: string[];
	    fullContent?: string;
	    settingsOverride?: AISettings;
	
	    static createFrom(source: any = {}) {
	        return new AIRunRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.prompt = source["prompt"];
	        this.contextMode = source["contextMode"];
	        this.linesAbove = source["linesAbove"];
	        this.fullContent = source["fullContent"];
	        this.settingsOverride = this.convertValues(source["settingsOverride"], AISettings);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AIRunResponse {
	    ok: boolean;
	    error?: string;
	    output: AIModelOutput;
	    preview: AIRequestPreview;
	
	    static createFrom(source: any = {}) {
	        return new AIRunResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.error = source["error"];
	        this.output = this.convertValues(source["output"], AIModelOutput);
	        this.preview = this.convertValues(source["preview"], AIRequestPreview);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class AISettingsResponse {
	    settings: AISettings;
	    keyStatus: AIKeyStatus;
	
	    static createFrom(source: any = {}) {
	        return new AISettingsResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.settings = this.convertValues(source["settings"], AISettings);
	        this.keyStatus = this.convertValues(source["keyStatus"], AIKeyStatus);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CustomTheme {
	    id: string;
	    colors: Record<string, string>;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new CustomTheme(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.colors = source["colors"];
	        this.type = source["type"];
	    }
	}
	export class ExprEvalResponse {
	    ok: boolean;
	    error?: string;
	    value?: any;
	    variables: Record<string, any>;
	    isNumber: boolean;
	    numberValue?: number;
	
	    static createFrom(source: any = {}) {
	        return new ExprEvalResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.error = source["error"];
	        this.value = source["value"];
	        this.variables = source["variables"];
	        this.isNumber = source["isNumber"];
	        this.numberValue = source["numberValue"];
	    }
	}
	export class OpenVSXFiles {
	    download: string;
	    icon: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenVSXFiles(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.download = source["download"];
	        this.icon = source["icon"];
	    }
	}
	export class OpenVSXExtension {
	    namespace: string;
	    name: string;
	    publisher: string;
	    displayName: string;
	    description: string;
	    version: string;
	    url: string;
	    files: OpenVSXFiles;
	    downloadCount: number;
	    downloadUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenVSXExtension(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	        this.publisher = source["publisher"];
	        this.displayName = source["displayName"];
	        this.description = source["description"];
	        this.version = source["version"];
	        this.url = source["url"];
	        this.files = this.convertValues(source["files"], OpenVSXFiles);
	        this.downloadCount = source["downloadCount"];
	        this.downloadUrl = source["downloadUrl"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

