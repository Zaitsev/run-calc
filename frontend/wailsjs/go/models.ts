export namespace main {
	
	export class CustomTheme {
	    id: string;
	    colors: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new CustomTheme(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.colors = source["colors"];
	    }
	}
	export class OpenVSXFiles {
	    download: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenVSXFiles(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.download = source["download"];
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

