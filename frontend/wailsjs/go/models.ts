export namespace main {
	
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

