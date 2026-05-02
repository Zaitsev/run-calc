export type HelpPageKey = 'operations' | 'shortcuts' | 'new';

export type HelpContentMap = Record<HelpPageKey, string[]>;

export type OperationVisualStep = {
	id: string;
	title: string;
	summary: string;
	example: string;
	image: string;
	alt: string;
	notes: string[];
};
