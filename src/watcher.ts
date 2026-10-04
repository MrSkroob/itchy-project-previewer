import * as vscode from "vscode";


type MightPromise<T> = T | Promise<T>;
type SpriteHandler = (name: string) => MightPromise<void>;


function getName(uri: vscode.Uri) {
    const name = uri.path.split("/").pop();

    if (!name || name === "Stage") {
        return;
    }

    return name;
}


async function isSpriteFolder(uri: vscode.Uri): Promise<boolean> {
    try {
        const stat = await vscode.workspace.fs.stat(uri);

        if (stat.type !== vscode.FileType.Directory) {
            return false;
        }

        const entries = await vscode.workspace.fs.readDirectory(uri);

        return entries.some(
            ([name, type]) =>
                name === "costumes" &&
                type === vscode.FileType.Directory
        );
    } catch {
        return false;
    }
}


export function watchSprites(
    projectPath: vscode.Uri,
    onAddSprite: SpriteHandler,
    onRemoveSprite: SpriteHandler

) {
    const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(projectPath, "*")
    );

    watcher.onDidCreate(async uri => {
        if (!(await isSpriteFolder(uri))) {
            return;
        }

        const name = getName(uri);
        if (!name) {
            return;
        }

        await onAddSprite(name);
    });

    watcher.onDidDelete(async uri => {
        const name = getName(uri);
        if (!name) {
            return;
        }

        await onRemoveSprite(name);
    });

    return watcher;
}