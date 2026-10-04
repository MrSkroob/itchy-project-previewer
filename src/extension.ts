// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
// import * as commands from "./commands";
import Stage from "./previewer";
import { watchSprites } from "./watcher";


let stage: Stage | null = null;
let watcher: vscode.FileSystemWatcher | null;


function getStage(context: vscode.ExtensionContext) {
	if (!stage) {
		return new Stage(context);
	}
	return stage;
}


function getProjectPath() {
    const folders = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
        return undefined;
    }
    
    const activeDocument = vscode.window.activeTextEditor?.document;

    if (activeDocument) {
        const folder = vscode.workspace.getWorkspaceFolder(
            activeDocument.uri
        )

        if (folder) {
            return folder.uri;
        }
    }

    if (folders.length ===  1) {
        return folders[0].uri;
    }

    return undefined;
}


async function updateStage(stage: Stage, projectPath: vscode.Uri) {
	stage.removeAllSprites();

	if (!watcher) {
		watcher = watchSprites(projectPath, stage.addSprite, stage.removeSprite);
	}

	const entries = await vscode.workspace.fs.readDirectory(projectPath);
	for (const [name, type] of entries) {
		if (type !== vscode.FileType.Directory) {
			continue;
		}

		const spritePath = vscode.Uri.joinPath(projectPath, name);
		const children = await vscode.workspace.fs.readDirectory(spritePath);

		const hasCostumesFolder = children.some(
			([childName, childType]) =>
				childName === "costumes" &&
				childType === vscode.FileType.Directory
		);

		if (!hasCostumesFolder) {
			continue;
		}

		stage.addSprite(name);
	}
}


async function openPreviewer(context: vscode.ExtensionContext) {
	let projectPath = getProjectPath();
	const stage = getStage(context);
	stage.setProjectPath(projectPath);

	if (watcher) {
		watcher.dispose();
		watcher = null;
	}

	if (!projectPath) {
		stage.showNoProject();
	} else {
		await updateStage(stage, projectPath);
	}


}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// load commands
	context.subscriptions.push(
		vscode.commands.registerCommand('itchy-project-previewer.openPreviewer', async () => {
			openPreviewer(context);
		}),

		vscode.commands.registerCommand("itchy-project-previewer.closePreviewer", () => {
			if (!stage) {
				return;
			}
			stage.getWebPanel().dispose();
			if (watcher) {
				watcher.dispose();
				watcher = null;
			}
		})
	)
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (!stage) {
		return;
	}
	stage.getWebPanel().dispose();
}
