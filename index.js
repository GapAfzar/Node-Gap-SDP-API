"use strict";

var express = require("express"),
  bodyParser = require("body-parser"),
  request = require("request"),
  fs = require("fs");

module.exports = class GapApi {
  constructor(token, options = {httpServer:true}) {
    this.apiUrl = "https://api.gap.im/";
    this.token = token;
    this.port = options.port || 3000;
    this.onUnhandledText = options.onUnhandledText || (() => {});
    this.joinHandler = () => {};
    this.mainHandler = () => {};
    this.triggerButtonHandler = () => {};
    this.textHandlers = [];
    if (options.httpServer === true) {
      this._startHttpServer();
    }
  }

  _startHttpServer() {
    var app = express();
    var self = this;

    app.use(bodyParser.json());

    app.use(
      bodyParser.urlencoded({
        extended: true
      })
    );

    app.post("*", function(req, res) {
      self._onText(req, res);
    });

    app.listen(this.port);
  }

  _onText(req, res) {
    switch (req.body.type) {
      case "join":
        this.joinHandler(req.body);
        break;
      case "triggerButton":
        this.triggerButtonHandler(req.body);
        break;
      default:
        this.mainHandler(req.body);

        if (this.textHandlers.length) {
          this._findTextHandler(req.body);
        }
    }

    res.send();
  }

  _uploadFile(type, address) {
    return new Promise((resolve, reject) => {
      var formData = {};
      formData[type] = fs.createReadStream(address);

      request.post(
        {
          url: this.apiUrl + "upload",
          formData: formData,
          headers: {
            token: this.token
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
        }
      );
    });
  }

  _replyKeyboard(keyboard, once = true, selective = false) {
    if (!keyboard instanceof Array) {
      throw "keyboard must be array";
    }

    let replyKeyboard = {
      keyboard: keyboard,
      once: once,
      selective: selective
    };

    return JSON.stringify(replyKeyboard);
  }

  _sendRequest(msgType, params, method = "sendMessage") {
    return new Promise((resolve, reject) => {
      if (msgType) {
        params["type"] = msgType;
      }

      var options = {
        url: this.apiUrl + method,
        method: "post",
        form: params,
        headers: {
          token: this.token
        }
      };

      request(options, (error, response, body) => {
        if (error || response.statusCode != 200) {
          if (body) {
            return reject(body);
          }

          if (response.statusCode == 403) {
            return reject("Invalid token");
          }

          return reject("an error was encountered");
        }

        resolve(true);
      });
    });
  }

  _findTextHandler(data) {
    var text = data.data || "";
    if (!text.length || data.type != "text") {
      return true;
    }

    var hasCalledAny = !this.textHandlers.every(function(handler) {
      if (handler.regexp.test(text)) {
        handler.callback(data);
        return false;
      }
      return true;
    });

    if (!hasCalledAny) {
      this.onUnhandledText(data);
    }
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

  async sendText(chatId, data, replyKeywords, inlineKeywords) {
    const params = {
      chat_id: chatId,
      data: data
    };

    if (replyKeywords) {
      params["reply_keyboard"] = this._replyKeyboard(replyKeywords);
    }

    if (inlineKeywords) {
      params["inline_keyboard"] = JSON.stringify(inlineKeywords);
    }

    return await this._sendRequest("text", params);
  }

  async sendImage(chatId, img, desc = "", replyKeywords = null) {
    if (typeof img === "string" && !fs.existsSync(img)) {
      throw "Image path is invalid";
    }

    let params = {
      chat_id: chatId,
      data: typeof img === "object" ? JSON.stringify(img) : JSON.stringify({
        ...(await this._uploadFile("image", img)),
        desc
      })
    };

    if (replyKeywords) {
      params["reply_keyboard"] = this._replyKeyboard(replyKeywords);
    }

    return await this._sendRequest("image", params);
  }

  async sendFile(chatId, file, desc = "", replyKeywords = null) {
    if (typeof file === "string" && !fs.existsSync(file)) {
      throw "File path is invalid";
    }

    let params = {
      chat_id: chatId,
      data: typeof file === "object" ? JSON.stringify(file) : JSON.stringify({
        ...(await this._uploadFile("file", file)),
        desc
      })
    };

    if (replyKeywords) {
      params["reply_keyboard"] = self._replyKeyboard(replyKeywords);
    }

    return await this._sendRequest("file", params);
  }

  async sendVideo(chatId, video, desc = "", replyKeywords = null) {
    if (typeof video === "string" && !fs.existsSync(video)) {
      throw "Video path is invalid";
    }

    let params = {
      chat_id: chatId,
      data: typeof video === "object" ? JSON.stringify(video) : JSON.stringify({
        ...(await this._uploadFile("video", video)),
        desc
      })
    };

    if (replyKeywords) {
      params["reply_keyboard"] = self._replyKeyboard(replyKeywords);
    }

    return await this._sendRequest("video", params);
  }

  async sendAudio(chatId, audio, desc = "", replyKeywords = null) {
    if (typeof audio === "string" && !fs.existsSync(audio)) {
      throw "Audio path is invalid";
    }

    let params = {
      chat_id: chatId,
      data: typeof audio === "object" ? JSON.stringify(audio) : JSON.stringify({
        ...(await this._uploadFile("audio", audio)),
        desc
      })
    };

    if (replyKeywords) {
      params["reply_keyboard"] = self._replyKeyboard(replyKeywords);
    }

    return await this._sendRequest("audio", params);
  }

  async editText(chatId, messageId, data, inlineKeywords) {
    var params = {
      chat_id: chatId,
      message_id: messageId
    };

    if (data) {
      params["data"] = data;
    }

    if (inlineKeywords) {
      params["inline_keyboard"] = JSON.stringify(inlineKeywords);
    }

    return await this._sendRequest(false, params, "editMessage");
  }

  async answerCallback(chatId, callback_id, text, show_alert) {
    var params = {
      chat_id: chatId,
      callback_id,
      text,
      show_alert
    };

    return await this._sendRequest(false, params, "answerCallback");
  }
};