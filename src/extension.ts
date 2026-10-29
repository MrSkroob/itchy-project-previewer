// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
// import * as commands from "./commands";
import Previewer from "./previewer";
import { watchSprites } from "./watcher";
import { ObjectState, VariableData } from './stage/messageTypes';
// import * as fs from 'fs';
// import { json } from 'stream/consumers';

let stage: Previewer | null = null;
let watcher: vscode.FileSystemWatcher | null;

function getStage(context: vscode.ExtensionContext) {
	if (!stage || stage.isDisposed()) {
		return new Previewer(context);
	}
	return stage;
}


function mergeVariableState(
    owner: string,
    variables: VariableData[],
    savedState?: ObjectState
): NonNullable<ObjectState["variableState"]> {
    const savedVariables = new Map(savedState?.variableState ?? []);

    return variables
        .filter(variable => variable.owner === owner)
        .map(variable => {
            const saved = savedVariables.get(variable.name);

            return [
                variable.name,
                {
                    name: variable.name,
                    owner: variable.owner,
                    type: variable.type,
                    visible: saved?.visible ?? false,
                    x: saved?.x ?? -230,
                    y: saved?.y ?? 170
                }
            ];
        });
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


async function updateStage(stage: Previewer, projectPath: vscode.Uri, data?: {[k: string]: ObjectState}) {
	let contents;
	let variables: VariableData[] = [];
	try {
		contents = await vscode.workspace.fs.readFile(
			vscode.Uri.joinPath(projectPath, "project-variables.json")
		);
		variables = JSON.parse(
			new TextDecoder().decode(contents)
		);
		// stage.updateVariables(variables);
	} catch(error) {
		console.log(error);
	}

	stage.removeAllSprites();

	if (!watcher) {
		watcher = watchSprites(projectPath, stage.addSprite, stage.removeSprite);
	}

	const entries = await vscode.workspace.fs.readDirectory(projectPath);
	for (const [_name, type] of entries) {
		if (type !== vscode.FileType.Directory) {
			continue;
		}

		const name = _name.toLowerCase();

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
			data[name].variableState = mergeVariableState(name, variables, data[name]);
			stage.addSprite(name, data[name]);
		}
		else {
			const tempData: ObjectState = {
				name: name,
				costumeNumber: 0,
				visible: true,
				size: 100,
				x: 0,
				y: 0, 
				layer: 1,
				rotation: 90,
				rotationStyle: "all-around",
				variableState: mergeVariableState(name, variables)
			}
			stage.addSprite(name, tempData);
		}
	}

	// fs.readFile(vscode.Uri.joinPath(projectPath, "project-variables.json").fsPath, {encoding: 'utf-8'}, (err, data) => {
	// 	if (err) { throw err;}
	// 	const jsonData = JSON.parse(data);
	// 	if (!stage) { return; }
	// 	stage.updateVariables(jsonData);
	// })
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

		let data: {[k: string]: ObjectState} | undefined = {};
		try {
			const file = vscode.Uri.joinPath(projectPath, "project-previewer.json");
			const stringData = new TextDecoder().decode(await vscode.workspace.fs.readFile(file));
			data = JSON.parse(stringData);
		} catch(error) {
			console.log(error);
			data = undefined;
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
			await openPreviewer(context);
		}),

		vscode.commands.registerCommand("itchy-project-previewer.closePreviewer", () => {
			if (!stage || stage.isDisposed()) {
				return;
			}
			stage.stopProject();
			stage.getWebPanel().dispose();
			stage = null;
			if (watcher) {
				watcher.dispose();
				watcher = null;
			}
		}),

		vscode.commands.registerCommand('itchy-project-previewer.saveStage', () => {
			if (!stage || stage.isDisposed()) {
				return;
			}
			stage.save();
		}),

		vscode.commands.registerCommand('itchy-project-previewer.runProject', () => {
			if (!stage || stage.isDisposed()) {
				return;
			}
			
			stage.runProject();
		}),

		vscode.commands.registerCommand('itchy-project-previewer.stopProject', () => {
			if (!stage || stage.isDisposed()) {
				return;
			}

			stage.stopProject();
		}),

		vscode.commands.registerCommand('itchy-project-previwer.reloadPreviewer', async () => {
			vscode.commands.executeCommand('itchy-project-previewer.stopProject');
			await vscode.commands.executeCommand('itchy-project-previewer.closePreviewer');
			await vscode.commands.executeCommand('itchy-project-previewer.openPreviewer');
		}),

		// TODO: test this actually works
		vscode.commands.registerCommand(
            "itchy-previewer.updateVariables",
            (data: VariableData[]) => {
				if (!stage || stage.isDisposed()) {
					return;
				}
				stage.updateVariables(data);
            }
        )
	);
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (!stage) {
		return;
	}
	stage.saveAndClose();
}
