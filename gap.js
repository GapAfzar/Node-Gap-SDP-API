"use strict";

var express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    fs = require('fs');

const noop = () => {}

module.exports = class GapApi {
  constructor(token, options) {
    options = options || {}
    this.apiUrl = 'https://api.gap.im/';
    this.token = token;
    this.port = options.port || 3000;
    this.joinHandler = noop;
    this.mainHandler = noop;
    this.triggerButtonHandler = noop;
    this.submitFormHandler = noop;
    this.paidHandler = noop;
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
    app.use(function(req, res) {
      self._onText(req, res);
    });
    app.listen(this.port);
  }

  onJoin(callback) {
    this.joinHandler = callback || noop;
  }

  onTriggerButton(callback) {
    this.triggerButtonHandler = callback || noop
  }

  onSubmitForm(callback) {
    this.submitFormHandler = callback || noop
  }

  onPaid(callback) {
    this.paidHandler = callback || noop
  }

  onText() {
    switch (arguments.length) {
    case 1:
      this.mainHandler = arguments[0] ||
      function() {};
      break;
    case 2:
      this.textHandlers.push({
        regexp: arguments[0],
        callback: arguments[1] ||
        function() {}
      });
      break;
    }
    return true;
  }

  _onText(req, res) {
    if (req.body.type == 'join') {
      this.joinHandler(req.body);
    } else if (req.body.type == 'triggerButton') {
      this.triggerButtonHandler(req.body);
    } else if (req.body.type == 'submitForm') {
      this.submitFormHandler(req.body);
    } else if (req.body.type == 'paycallback') {
      var params = JSON.parse(req.body.data);
      this.paidHandler(params);
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

  sendText(chatId, data, replyKeywords, inlineKeywords, form) {
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
    if (form) {
      params['form'] = JSON.stringify(form)
    }
    return this._sendRequest('text', params);
  }

  sendImage(chatId, img, desc, replyKeywords) {
    if (!fs.existsSync(img)) {
      throw "Image path is invalid";
    };

    var self = this;
    this._uploadFile(img, (data) => {
      data['desc'] = desc;
      let params = {
        chat_id: chatId,
        data: JSON.stringify(data)
      };
      if (replyKeywords) {
        params['reply_keyboard'] = self._replyKeyboard(replyKeywords);
      }
      self._sendRequest('image', params);
    });
  }

  sendVideo(chatId, video, desc, replyKeywords) {
    if (!fs.existsSync(video)) {
      throw "Video path is invalid";
    };

    var self = this;
    this._uploadFile(video, (data) => {
      data['desc'] = desc;
      let params = {
        chat_id: chatId,
        data: JSON.stringify(data)
      };
      if (replyKeywords) {
        params['reply_keyboard'] = self._replyKeyboard(replyKeywords);
      }
      self._sendRequest('video', params);
    });
  }

  editText(chatId, messageId, data, inlineKeywords) {
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
    return this._sendRequest(false, params, 'editMessage');
  }

  deleteMessage(chatId, messageId) {
    var params = {
      chat_id: chatId,
      message_id: messageId
    };
    return this._sendRequest(false, params, 'deleteMessage');
  }

  answerCallback(chatId, callback_id, text, show_alert) {
    var params = {
      chat_id: chatId,
      callback_id,
      text,
      show_alert
    };
    return this._sendRequest(false, params, 'answerCallback');
  }

  payVerify(chatId, ref_id) {
    var params = {
      chat_id: chatId,
      ref_id,
    };
    return this._sendRequest(false, params, 'payVerify');
  }

  _uploadFile(address, callback) {
    callback = callback || noop
    var formData = {
      file: fs.createReadStream(address),
    };

    request.post({
      url: this.apiUrl + 'upload',
      formData: formData
    }, (err, httpResponse, body) => {
      if (err) {
        return console.error('upload failed:', err);
      }
      callback(JSON.parse(body));
    });
  }

  _replyKeyboard(keyboard, once, selective) {
    if (!keyboard instanceof Array) {
      throw "keyboard must be array";
    }

    let replyKeyboard = {
      keyboard: keyboard,
      once: once || true,
      selective: selective,
    };

    return JSON.stringify(replyKeyboard);
  }

  _sendRequest(msgType, params, method) {
    if (msgType) {
      params['type'] = msgType;
    }
    return new Promise((resolve, reject) => {
      var options = {
        url: this.apiUrl + (method || 'sendMessage'),
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
        return resolve(body);
      });
    })
  }
}
