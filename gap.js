"use strict";

var express = require('express'),
	bodyParser = require('body-parser'),
	request = require('request'),
	fs = require('fs');

module.exports = class GapApi {
	constructor(token, options = {}) {
		this.apiUrl = 'https://api.gap.im/';
		this.token = token;
		this.port = options.port || 3000;
		this.joinHandler = () => {};
		this.mainHandler = () => {};
		this.triggerButtonHandler = () => {};
		this.textHandlers = [];
		this.startHttpServer();
	}

	startHttpServer() {
		var app = express();
		var self = this;
		app.use(bodyParser.json());
		app.use(bodyParser.urlencoded({
			extended: true
		}));
		app.post('*', function(req, res) {
			self._onText(req, res);
		});
		app.listen(this.port);
	}

	onJoin(callback = () => {}) {
		this.joinHandler = callback;
	}

	onTriggerButton(callback) {
		this.triggerButtonHandler = callback || (() => {});
	}

	onText() {
		switch (arguments.length) {
			case 1:
				this.mainHandler = arguments[0] || function() {};
				break;
			case 2:
				this.textHandlers.push({
					regexp: arguments[0],
					callback: arguments[1] || function() {}
				});
				break;
		}
		return true;
	}

	_onText(req, res) {
		// console.log(req, res);
		if (req.body.type == 'join') {
			this.joinHandler(req.body);
		} else if (req.body.type == 'triggerButton') {
			this.triggerButtonHandler(req.body);
		} else {
			this.mainHandler(req.body);
			if (this.textHandlers.length) {
				this.findTextHandler(req.body);
			}
		}
		res.send();
	}

	findTextHandler(data) {
		var text = data.data || '';
		if (!text.length || data.type != 'text') {
			return true;
		}

		this.textHandlers.every(function(handler) {
			if (handler.regexp.test(text)) {
				handler.callback(data);
				return false;
			}
			return true;
		});
	}

	sendText(chatId, data, replyKeywords, inlineKeywords) {
		return new Promise((resolve, reject) => {
			var params = {
				chat_id: chatId,
				data: data
			};
			if (replyKeywords) {
				params['reply_keyboard'] = this._replyKeyboard(replyKeywords);
			}
			if (inlineKeywords) {
				params['inline_keyboard'] = JSON.stringify(inlineKeywords)
			}
			this._sendRequest('text', params)
				.then(resolve)
				.catch(reject);
		})
	}

	sendImage(chatId, img, desc = '', replyKeywords = null) {
		var self = this;

		return new Promise((resolve, reject) => {
			if (!fs.existsSync(img)) {
				return reject("Image path is invalid");
			};

			this._uploadFile('image', img)
				.then(data => {
					data['desc'] = desc;
					let params = {
						chat_id: chatId,
						data: JSON.stringify(data)
					};
					if (replyKeywords) {
						params['reply_keyboard'] = self._replyKeyboard(replyKeywords);
					}
					this._sendRequest('image', params)
						.then(resolve)
						.catch(reject);
				})
				.catch(err => {
					reject(`Upload failed: ${err}`);
				});
		});
	}

	sendFile(chatId, file, desc = '', replyKeywords = null) {
		var self = this;

		return new Promise((resolve, reject) => {
			if (!fs.existsSync(file)) {
				return reject("File path is invalid");
			};

			this._uploadFile('file', file)
				.then(data => {
					data['desc'] = desc;
					let params = {
						chat_id: chatId,
						data: JSON.stringify(data)
					};
					if (replyKeywords) {
						params['reply_keyboard'] = self._replyKeyboard(replyKeywords);
					}
					self._sendRequest('file', params)
						.then(resolve)
						.catch(reject);
				})
				.catch(err => {
					reject(`Upload failed: ${err}`);
				});
		});
	}

	sendVideo(chatId, video, desc = '', replyKeywords = null) {
		var self = this;

		return new Promise((resolve, reject) => {
			if (!fs.existsSync(video)) {
				return reject("Video path is invalid");
			};

			this._uploadFile('video', video)
				.then(data => {
					data['desc'] = desc;
					let params = {
						chat_id: chatId,
						data: JSON.stringify(data)
					};
					if (replyKeywords) {
						params['reply_keyboard'] = self._replyKeyboard(replyKeywords);
					}

					self._sendRequest('video', params)
						.then(resolve)
						.catch(reject);
				})
				.catch(err => {
					reject(`Upload failed: ${err}`);
				});
		})
	}

	editText(chatId, messageId, data, inlineKeywords) {
		return new Promise((resolve, reject) => {
			var params = {
				chat_id: chatId,
				message_id: messageId
			};
			if (data) {
				params['data'] = data
			}
			if (inlineKeywords) {
				params['inline_keyboard'] = JSON.stringify(inlineKeywords)
			}

			this._sendRequest(false, params, 'editMessage')
				.then(resolve)
				.catch(reject);
		});
	}

	answerCallback(chatId, callback_id, text, show_alert) {
		return new Promise((resolve, reject) => {
			var params = {
				chat_id: chatId,
				callback_id,
				text,
				show_alert
			};
			this._sendRequest(false, params, 'answerCallback')
				.then(resolve)
				.catch(reject);
		})
	}

	_uploadFile(type, address) {
		return new Promise((resolve, reject) => {
			var formData = {};
			formData[type] = fs.createReadStream(address);

			request.post({
					url: this.apiUrl + 'upload',
					formData: formData,
					headers: {
						'token': this.token
					}
				},
				(err, httpResponse, body) => {
					if (err) {
						return reject(err);
					}

					try {
						resolve(JSON.parse(body));
					} catch (e) {
						reject(e);
					}
				});
		})
	}

	_replyKeyboard(keyboard, once = true, selective = false) {
		if (!keyboard instanceof Array) {
			throw "keyboard must be array";
		}

		let replyKeyboard = {
			keyboard: keyboard,
			once: once,
			selective: selective,
		};

		return JSON.stringify(replyKeyboard);
	}

	_sendRequest(msgType, params, method = 'sendMessage') {
		return new Promise((resolve, reject) => {
			if (msgType) {
				params['type'] = msgType;
			}
			var options = {
				url: this.apiUrl + method,
				method: 'post',
				form: params,
				headers: {
					'token': this.token
				}
			};
			request(options, (error, response, body) => {
				if (error || response.statusCode != 200) {
					if (body) {
						return reject(body);
					}
					return reject('an error was encountered');
				}
				resolve(true);
			});
		})
	}
}