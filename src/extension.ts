// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
// import * as commands from "./commands";
import Stage from "./previewer";
import { watchSprites } from "./watcher";
import { SpriteState } from './messageTypes';


let stage: Stage | null = null;
let watcher: vscode.FileSystemWatcher | null;


function getStage(context: vscode.ExtensionContext) {
	if (!stage || stage.isDisposed()) {
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
        );

        if (folder) {
            return folder.uri;
        }
    }

    if (folders.length ===  1) {
        return folders[0].uri;
    }

    return undefined;
}


async function updateStage(stage: Stage, projectPath: vscode.Uri, data?: {[k: string]: SpriteState}) {
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
		
		if (data) {
			stage.addSprite(name, data[name]);
		}
		else {
			stage.addSprite(name);
		}
	}
}


async function openPreviewer(context: vscode.ExtensionContext) {
	let projectPath = getProjectPath();
	stage = getStage(context);
	stage.setProjectPath(projectPath);

	if (watcher) {
		watcher.dispose();
		watcher = null;
	}

	if (!projectPath) {
		stage.showNoProject();
	} else {

		let data: {[k: string]: SpriteState} = {};
		try {
			const file = vscode.Uri.joinPath(projectPath, "project-previewer.json");
			const stringData = new TextDecoder().decode(await vscode.workspace.fs.readFile(file));
			data = JSON.parse(stringData);
		} catch(error) {
			console.log(error);
		}

		await updateStage(stage, projectPath, data);
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
			if (!stage || stage.isDisposed()) {
				return;
			}
			stage.getWebPanel().dispose();
			if (watcher) {
				watcher.dispose();
				watcher = null;
			}
		}),

		vscode.commands.registerCommand('itchy-project-previewer.saveStage', () => {
			if (!stage) {
				return;
			}
			stage.save();
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (!stage) {
		return;
	}
	stage.saveAndClose();
}
