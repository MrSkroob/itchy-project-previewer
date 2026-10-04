import * as vscode from 'vscode';
import * as fs from "fs";
// import * as path from "path";
import { Message, SpriteData } from "./stage/messageTypes";


export default class Stage {
    private html: string;
    private webPanel: vscode.WebviewPanel;
    private projectPath?: vscode.Uri | null;

    constructor(context: vscode.ExtensionContext) {
        const extensionUri = context.extensionUri;
        
        this.webPanel = vscode.window.createWebviewPanel(
            "itchyStage",
            "Itchy Stage",
            vscode.ViewColumn.Beside, 
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );
        this.html = this.getTemplate(this.webPanel.webview, extensionUri);
        this.webPanel.webview.html = this.html;

        this.webPanel.webview.onDidReceiveMessage(async message => {
            if (!this.projectPath) {
                return;
            }
            switch (message.type) {
                case "renameSprite": {
                    const oldUri = vscode.Uri.joinPath(
                        this.projectPath,
                        message.oldName
                    );

                    const newUri = vscode.Uri.joinPath(
                        this.projectPath,
                        message.newName
                    );

                    const edit = new vscode.WorkspaceEdit();

                    edit.renameFile(
                        oldUri,
                        newUri
                    );

                    await vscode.workspace.applyEdit(edit);
                    break;
                }
                case "copiedToClipboard": {
                    vscode.window.setStatusBarMessage(
                        "$(check) Copied to clipboard",
                        2000
                    );
                    break;
                }
            }
        });
    }

    public setProjectPath(projectPath?: vscode.Uri | null) {
        this.projectPath = projectPath;
    }

    public getWebPanel() {
        return this.webPanel;
    }

    public showNoProject() {
        const panel = this.webPanel;
        const message: Message = {
            type: "noProject",
        }
        panel.webview.postMessage(message);
    }

    public async addSprite(name: string) {
        if (!this.projectPath) {
            return;
        }
        const panel = this.webPanel;
        const costumesPath = vscode.Uri.joinPath(this.projectPath, name, "costumes");
        const entries = await vscode.workspace.fs.readDirectory(costumesPath);

        const costumes = entries.filter(
            ([__dirname, type]) => type === vscode.FileType.File
        )
        .map(([filename]) => {
            const fileUri = vscode.Uri.joinPath(costumesPath, filename);

            return panel.webview.asWebviewUri(fileUri).toString();
        });

        
        const message: Message = {
            type: "addSprite",
            sprite: {
                name: name,
                costumes: costumes
            },
        }

        panel.webview.postMessage(message);
    }

    public removeSprite(name: string) {
        const panel = this.webPanel;
        const message: Message = {
            type: "removeSprite",
            sprite: {
                name: name,
                costumes: []
            }
        }
        panel.webview.postMessage(message);
    }

    public removeAllSprites() {
        const panel = this.webPanel;
        const message: Message = {
            type: "removeAllSprites"
        }
        panel.webview.postMessage(message);
    }

    private getTemplate(webview: vscode.Webview, extensionUri: vscode.Uri) {
        // initialises
        const htmlPath = vscode.Uri.joinPath(
            extensionUri,
            "src",
            "stage",
            "stage.html"
        );

        let html = fs.readFileSync(htmlPath.fsPath, "utf8");

        const cssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                extensionUri,
                "src",
                "stage",
                "stage.css"
            )
        );

        const jsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                extensionUri,
                "src",
                "stage",
                "stage.js"
            )
        );

        html = html
            .replace("{{CSS_URI}}", cssUri.toString())
            .replace("{{JS_URI}}", jsUri.toString());

        return html;
    }
}
