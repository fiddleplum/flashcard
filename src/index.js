'use strict';

import S3FS from '@fiddleplum/s3-fs';

/**
 * @typedef Card
 * @type {object}
 * @property {string} front
 * @property {string} back
 * @property {string[]} tags
 * @property {number} numCorrect
 */

class App {
	constructor() {
		/** @type {S3FS} */
		this._s3fs = null;

		/** @type Card[] */
		this._cards = [];

		this._currentCardIndex = Number.NaN;
	}

	async initialize() {
		let urlParams = new URLSearchParams(document.location.search.substring(1));

		// Load S3
		let password = urlParams.get('p');
		if (password === null) {
			throw new Error("Need Password");
		}
		let keyFile = 'keys/' + password.replace(/\W/g, '') + '.txt';
		let response = await fetch(keyFile);
		let text = await response.text();
		let [accessKey, secretKey, region] = text.split('\n');
		this._s3fs = new S3FS(accessKey.trim(), secretKey.trim(), region.trim(), 'data-hurley', 'Flashcard');
		if (this._s3fs === null) {
			throw new Error("Need Connection");
		}

		// Load JSON
		try {
			this._cards = JSON.parse(await this._s3fs.load('cards.json'));
		}
		catch (error) {
			if (!this._s3fs.exists('cards.json')) {
				this._save();
			}
			else {
				throw error;
			}
		}

		// Show first card
		if (this._cards.length > 0) {
			this.getNextCard();
		}
	}

	getNextCard() {
		this.hideDiv('flashcard_front');
		this.hideDiv('flashcard_back');

		let totalWeight = 0;
		for (let i = 0, l = this._cards.length; i < l; i++) {
			totalWeight += 1 / (this._cards[i].numCorrect + 1);
		}
		let randomWeight = Math.random() * totalWeight;
		for (let i = 0, l = this._cards.length; i < l; i++) {
			randomWeight -= 1 / (this._cards[i].numCorrect + 1);
			if (randomWeight <= 0) {
				this._currentCardIndex = i;
				let card = this._cards[this._currentCardIndex];
				document.querySelector('#flashcard_front').innerHTML = card.front;
				document.querySelector('#flashcard_back').innerHTML = card.back;
				if (Math.random() < 0.5) {
					this.showDiv('flashcard_front');
				}
				else {
					this.showDiv('flashcard_back');
				}
				break;
			}
		}
	}

	flipFrontAndBack() {
		this.toggleDiv('flashcard_front');
		this.toggleDiv('flashcard_back');
	}

	async markCardCorrect() {
		this._cards[this._currentCardIndex].numCorrect++;
		await this._save();
		this.getNextCard();
	}

	async markCardIncorrect() {
		this._cards[this._currentCardIndex].numCorrect = Math.floor(this._cards[this._currentCardIndex].numCorrect / 4);
		await this._save();
		this.getNextCard();
	}

	async addFromForm() {
		let front = document.querySelector('#front_textarea').value;
		let back = document.querySelector('#back_textarea').value;
		let tags = document.querySelector('#tags_textarea').value;
		tags = tags.split(',');
		for (let i = 0, l = tags.length; i < l; i++) {
			tags[i] = tags[i].trim();
		}
		this._cards.push({
			front: front,
			back: back,
			tags: tags,
			numCorrect: 0
		});
		document.querySelector('#front_textarea').value = '';
		document.querySelector('#back_textarea').value = '';
		document.querySelector('#tags_textarea').value = '';

		document.querySelector('#waiting_screen').innerHTML = 'Saving...';
		app.hideDiv('add_form');
		app.showDiv('waiting_screen');
		await this._save();
		app.hideDiv('waiting_screen');
		this.getNextCard();
	}

	async removeCard() {
		this._cards.splice(this._currentCardIndex, 1);
		await this._save();
		this.getNextCard();
	}

	swapColors() {
		document.body.classList.toggle('invert');
	}

	async _save() {
		await this._s3fs.save('cards.json', JSON.stringify(this._cards));
	}

	showDiv(id) {
		let div = document.querySelector('#' + id);
		document.querySelector('#' + id).classList.remove('hidden');
		document.querySelector('#' + id).classList.add('visible');
	}

	hideDiv(id) {
		let div = document.querySelector('#' + id);
		document.querySelector('#' + id).classList.remove('visible');
		document.querySelector('#' + id).classList.add('hidden');
	}

	toggleDiv(id) {
		let div = document.querySelector('#' + id);
		if (div.classList.contains('visible')) {
			document.querySelector('#' + id).classList.remove('visible');
			document.querySelector('#' + id).classList.add('hidden');
		}
		else {
			document.querySelector('#' + id).classList.remove('hidden');
			document.querySelector('#' + id).classList.add('visible');
		}
	}
}

document.addEventListener('DOMContentLoaded', async() => {
	let app = new App();
	window.app = app;
	app.initialize().then(() => {
		app.hideDiv('waiting_screen');
	});
});

window.App = App;
