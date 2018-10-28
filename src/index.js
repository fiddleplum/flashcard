'use strict';

import S3FS from '@fiddleplum/s3-fs';

const transitionToPromise = (el, property, value) => new Promise((resolve) => {
	if (window.getComputedStyle(el)[property] === value) {
		resolve();
		return;
	}
	el.style[property] = value;
	const transitionEnded = (e) => {
		if (e.propertyName !== property) {
			return;
		}
		el.removeEventListener('transitionend', transitionEnded);
		resolve();
	};
	el.addEventListener('transitionend', transitionEnded);
});

/**
 * @typedef Card
 * @type {object}
 * @property {string} front
 * @property {string} back
 * @property {string[]} tags
 * @property {number} score
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
			throw new Error('Need Password');
		}
		let keyFile = 'keys/' + password.replace(/\W/g, '') + '.txt';
		let response = await fetch(keyFile);
		let text = await response.text();
		let [accessKey, secretKey, region] = text.split('\n');
		this._s3fs = new S3FS(accessKey.trim(), secretKey.trim(), region.trim(), 'data-hurley', 'Flashcard');
		if (this._s3fs === null) {
			throw new Error('Need Connection');
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
			await this.getNextCard();
		}
	}

	async getNextCard() {
		await Promise.all([this.hideDiv('flashcard_front'), this.hideDiv('flashcard_back')]);

		let totalWeight = 0;
		for (let i = 0, l = this._cards.length; i < l; i++) {
			totalWeight += 1 / (this._cards[i].score + 1);
		}
		let randomWeight = Math.random() * totalWeight;
		for (let i = 0, l = this._cards.length; i < l; i++) {
			randomWeight -= 1 / (this._cards[i].score + 1);
			if (randomWeight <= 0) {
				this._currentCardIndex = i;
				let card = this._cards[this._currentCardIndex];
				document.querySelector('#flashcard_front').innerHTML = card.front + '<br/>Score: ' + card.score;
				document.querySelector('#flashcard_back').innerHTML = card.back + '<br/>Score: ' + card.score;
				if (Math.random() < 0.5) {
					await this.showDiv('flashcard_front');
				}
				else {
					await this.showDiv('flashcard_back');
				}
				break;
			}
		}
	}

	async flipFrontAndBack() {
		let div = document.querySelector('#flashcard_front');
		if (window.getComputedStyle(div).opacity === '1') {
			await Promise.all([this.hideDiv('flashcard_front'), this.showDiv('flashcard_back')]);
		}
		else {
			await Promise.all([this.showDiv('flashcard_front'), this.hideDiv('flashcard_back')]);
		}
	}

	async markCardCorrect() {
		this._cards[this._currentCardIndex].score++;
		await this._save();
		return this.getNextCard();
	}

	async markCardIncorrect() {
		this._cards[this._currentCardIndex].score = Math.floor(this._cards[this._currentCardIndex].score / 4);
		await this._save();
		return this.getNextCard();
	}

	async addFromForm() {
		// Get the data from the form.
		let front = document.querySelector('#front_textarea').value;
		let back = document.querySelector('#back_textarea').value;
		let tags = document.querySelector('#tags_textarea').value;
		tags = tags.split(',');
		for (let i = 0, l = tags.length; i < l; i++) {
			tags[i] = tags[i].trim();
		}

		// Check for duplicate.
		for (let i = 0, l = this._cards.length; i < l; i++) {
			if (this._cards[i].front === front) {
				this._cards.splice(i, 1);
				break;
			}
		}

		// Add it.
		this._cards.push({
			front: front,
			back: back,
			tags: tags,
			score: 0
		});

		// Clear the form.
		document.querySelector('#front_textarea').value = '';
		document.querySelector('#back_textarea').value = '';
		document.querySelector('#tags_textarea').value = '';

		document.querySelector('#waiting_screen').innerHTML = 'Saving...';
		await Promise.all([this.hideDiv('add_form'), this.showDiv('waiting_screen')]);
		await this._save();
		await this.hideDiv('waiting_screen');
		return this.getNextCard();
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

	async showDiv(id) {
		let div = document.querySelector('#' + id);
		div.style.visibility = 'visible';
		await transitionToPromise(div, 'opacity', '1');
	}

	async hideDiv(id) {
		let div = document.querySelector('#' + id);
		await transitionToPromise(div, 'opacity', '0');
		div.style.visibility = 'hidden';
	}
}

document.addEventListener('DOMContentLoaded', async () => {
	let app = new App();
	window.app = app;
	app.initialize().then(async () => {
		await app.hideDiv('waiting_screen');
	});
});

window.App = App;
