interface VsCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

// trust me bro
declare function acquireVsCodeApi(): VsCodeApi;


declare global {
    var vscode: VsCodeApi;
}

globalThis.vscode = acquireVsCodeApi();