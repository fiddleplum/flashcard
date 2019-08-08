'use strict';

import S3FS from '@fiddleplum/s3-fs';

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

		/** @type {string} */
		this._tag = '';

		this._currentCardIndex = Number.NaN;
	}

	async initialize() {
		let urlParams = new URLSearchParams(document.location.search.substring(1));

		if (urlParams.has('tag')) {
			this._tag = urlParams.get('tag');
		}

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
			for (let card of this._cards) {
				if (card.tags.length === 1 && card.tags[0] === '') {
					card.tags = [];
				}
			}
		}
		catch (error) {
			if (!this._s3fs.exists('cards.json')) {
				this._save();
			}
			else {
				throw error;
			}
		}
		this._updateAverageScore();

		// Show first card
		await this.getNextCard();
	}

	async setTag(tag) {
		this._tag = tag;
		this._updateAverageScore();

		// Show first card
		await this.getNextCard();
	}

	async getNextCard() {
		let totalWeight = 0;
		for (let i = 0, l = this._cards.length; i < l; i++) {
			if (this._tag === '' || this._cards[i].tags.includes(this._tag)) {
				totalWeight += this.getWeight(this._cards[i]);
			}
		}
		let randomWeight = Math.random() * totalWeight;
		for (let i = 0, l = this._cards.length; i < l; i++) {
			if (this._tag === '' || this._cards[i].tags.includes(this._tag)) {
				randomWeight -= this.getWeight(this._cards[i]);
				if (randomWeight <= 0) {
					await this.showCard(i);
					break;
				}
			}
		}
	}

	async showCard(i) {
		this._currentCardIndex = i;
		await Promise.all([this.hideDiv('flashcard_front'), this.hideDiv('flashcard_back')]);
		await this.switchScreen('card_screen');
		let card = this._cards[i];
		document.querySelector('#flashcard_front').innerHTML = '<div class="middle">' + card.front + '<br/>Score: ' + card.score + '</div>';
		document.querySelector('#flashcard_back').innerHTML = '<div class="middle">' + card.back + '<br/>Score: ' + card.score + '</div>';
		if (Math.random() < 0.5) {
			await this.showDiv('flashcard_front');
		}
		else {
			await this.showDiv('flashcard_back');
		}
	}

	getWeight(card) {
		return Math.pow(1.6, -card.score);
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
		this._updateAverageScore();
		return this.getNextCard();
	}

	async markCardIncorrect() {
		this._cards[this._currentCardIndex].score = Math.floor(this._cards[this._currentCardIndex].score / 4);
		await this._save();
		this._updateAverageScore();
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
		if (tags.length === 1 && tags[0] === '') {
			tags = [];
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
		await Promise.all([this.hideDiv('add_screen'), this.showDiv('waiting_screen')]);
		await this._save();
		await this.hideDiv('waiting_screen');

		this._updateAverageScore();

		// If it was hidden (from an editCard call), redisplay it.
		document.querySelector('#add_screen #close').style.display = 'block';

		return this.getNextCard();
	}

	async removeCard() {
		this._cards.splice(this._currentCardIndex, 1);
		await this._save();
		this._updateAverageScore();
		this.getNextCard();
	}

	swapColors() {
		document.body.classList.toggle('invert');
	}

	async listCards() {
		let listDiv = document.querySelector('#list_screen #list');
		let html = '';

		// Get all of the tags.
		let tags = new Set();
		for (let card of this._cards) {
			for (let tag of card.tags) {
				tags.add(tag);
			}
		}
		console.log(tags);

		// Show all tags.
		html += '<header>Tags</header>';
		html += '<div onclick="app.setTag(\'\');"><i>none</i></div>';
		for (let tag of tags) {
			html += '<div onclick="app.setTag(\'' + tag + '\');">' + tag + '</div>';
		}

		// Show all cards using the active tag.
		if (this._tag !== '') {
			html += '<header>Cards using ' + this._tag + '</header>';
		}
		else {
			html += '<header>Cards</header>';
		}
		for (let i = 0, l = this._cards.length; i < l; i++) {
			if (this._tag === '' || this._cards[i].tags.includes(this._tag)) {
				let card = this._cards[i];
				html += '<div onclick="app.showCard(' + i + ');"><span>' + card.front + ' ⇄ ' + card.back + '</span><span class="right">' + card.score + '</span></div>';
			}
		}
		listDiv.innerHTML = html;
		await this.switchScreen('list_screen');
	}

	async editCard() {
		let card = this._cards[this._currentCardIndex];
		this._cards.splice(this._currentCardIndex, 1);
		await this.switchScreen('add_screen');
		document.querySelector('#front_textarea').value = card.front;
		document.querySelector('#back_textarea').value = card.back;
		document.querySelector('#tags_textarea').value = card.tags.join(',');
		document.querySelector('#add_screen #close').style.display = 'none';
	}

	_updateAverageScore() {
		let numCards = 0;
		let totalScore = 0;
		for (let i = 0, l = this._cards.length; i < l; i++) {
			if (this._tag === '' || this._cards[i].tags.includes(this._tag)) {
				totalScore += Math.min(5, this._cards[i].score);
				numCards += 1;
			}
		}
		totalScore /= numCards;
		document.querySelector('#average_score').innerHTML = totalScore.toFixed(2);
	}

	async _save() {
		await this._s3fs.save('cards.json', JSON.stringify(this._cards));
	}

	async showDiv(id) {
		const duration = 0.25;
		const fps = 30.0;
		const div = document.querySelector('#' + id);
		if (div.style.display !== 'block') {
			div.style.opacity = '0';
			div.style.display = 'block';
			return new Promise((resolve, reject) => {
				const timer = setInterval((div) => {
					let u = Number.parseFloat(div.style.opacity);
					u += 1.0 / (duration * fps);
					u = Math.min(u, 1.0);
					div.style.opacity = '' + u;
					if (u >= 1.0) {
						clearInterval(timer);
						resolve();
					}
				}, 1000.0 / fps, div);
			});
		}
		else {
			return Promise.resolve();
		}
	}

	async hideDiv(id) {
		const duration = 0.25;
		const fps = 30.0;
		const div = document.querySelector('#' + id);
		if (div.style.display !== 'none') {
			div.style.opacity = '1';
			return new Promise((resolve, reject) => {
				const timer = setInterval((div) => {
					let u = Number.parseFloat(div.style.opacity);
					u -= 1.0 / (duration * fps);
					u = Math.max(u, 0.0);
					div.style.opacity = '' + u;
					if (u <= 0.0) {
						div.style.display = 'none';
						clearInterval(timer);
						resolve();
					}
				}, 1000.0 / fps, div);
			});
		}
		else {
			return Promise.resolve();
		}
	}

	async switchScreen(id) {
		let hideDivPromises = [];
		for (let child of document.querySelectorAll('#content div[id$=_screen]')) {
			if (child.id === id) {
				continue;
			}
			hideDivPromises.push(this.hideDiv(child.id));
		}
		await Promise.all(hideDivPromises);
		await this.showDiv(id);
	}
}

document.addEventListener('DOMContentLoaded', async () => {
	let app = new App();
	window.app = app;
	app.initialize().then(async () => {
		await app.switchScreen('card_screen');
	});
});

window.App = App;
