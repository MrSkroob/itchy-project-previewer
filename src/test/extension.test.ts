import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

import { ItchyVM, Script } from "../stage/vm/itchyVM";
import { BaseSprite, BaseBackdrop } from '../stage/vm/objects';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});


suite('VM Test Suite', () => {
	const vm = new ItchyVM(30);

	test('yielding', async () => {
		// const backdrop = new BaseBackdrop()
		const log: string[] = [];
		const main: Script = function*() {
			log.push("main:start");

			yield {
				type: "broadcastAndWait",
				name: "hello"
			};

			log.push("main:resumed");
		};

		const receiverA: Script = function*() {
			log.push("A:start");

			yield { type: "yield" };

			log.push("A:done");
		};

		const receiverB: Script = function*() {
			log.push("B:start");

			yield { type: "yield" };
			yield { type: "yield" };

			log.push("B:done");
		};
		// vm.registerBlockable("hello", receiverA);
		// vm.registerBlockable("hello", receiverB);

		// vm.spawnThread(main);
		// for (let tick = 1; tick <= 8; tick++) {
		// 	// console.log(`\n--- tick ${tick} ---`);

		// 	vm.step();

		// 	await new Promise(resolve =>
		// 		setTimeout(resolve, vm.msPerTick + 1)
		// 	);
		// }
		console.log(log);
	});
});