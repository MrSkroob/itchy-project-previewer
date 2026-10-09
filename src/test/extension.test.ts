import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

import { ItchyVM, Script } from "../stage/vm/itchyVM";
// import { Backdrop } f
// import { BaseSprite, BaseBackdrop } from '../stage/vm/objects';
import { Stage } from "../stage/stage";

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});


suite('VM Test Suite', () => {
	const vm = new ItchyVM(30);

	

	test('test move', async () => {
		await vscode.commands.executeCommand('itchy-project-previewer.openPreviewer');
	});
});