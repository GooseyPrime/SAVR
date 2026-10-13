// Type declarations for exception-controls.mjs (consumed by the web and mobile test suites).

export declare const FORBIDDEN_BUNDLE_PACKAGES: string[];

export declare function flattenFlatConfig(exported: unknown): Array<{ where: string; config: Record<string, unknown> }>;
export declare function findLintRootDir(exported: unknown, file?: string): string[];
export declare function findUpdateSigning(exp: unknown, label?: string): string[];
export declare function loadFlatConfig(projectDir: string): Promise<{ file: string; exported: unknown }>;
export declare function resolveExpoConfig(projectDir: string): Record<string, unknown>;
export declare function checkWebLintRootDir(projectDir: string): Promise<{ file: string; problems: string[] }>;
export declare function checkMobileUpdateSigning(projectDir: string): string[];
export declare function checkBundleSources(sources: string[]): string[];
