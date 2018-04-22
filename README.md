# Sample

```js
const GapApi = require('gap_api');
const gap = new GapApi(
    '__TOKEN__',
    {
        port: 9000,
    }
);

// { chat_id: '###', from: '{"id":###,"name":"Moein","user":"tje3d"}', type: 'text', data: 'test' }
gap.onText(data => {
    var chatId = data.chat_id;
    return gap.sendText(chatId, `Message received!`);
});
```