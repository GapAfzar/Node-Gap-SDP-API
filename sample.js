"use strict";

var GapApi = require('gap_api');
var gap = new GapApi('your token');
gap.onText(/test/, (data) => {
	console.log('b', data);
});

try {
    gap.sendText('chat_id', 'salam', [
        [
            {"OK" : 'OK'}
        ],
    ]);
    gap.sendImage('chat_id', 'jamal.jpg', 'desc', [
        [
            {"OK" : 'OK'}
        ],
    ]);
    gap.sendVideo('chat_id', 'aaa.mp4', 'desc video', [
        [
            {"OK" : 'OK'}
        ],
    ]);
} catch(e) {
    console.log(e);
}

