# Sample

```js
const GapApi = require("gap_api");
const gap = new GapApi("__TOKEN__", { port: 9000 });

// { chat_id: '###', from: '{"id":###,"name":"","user":""}', type: 'text', data: 'test' }
gap.onText(data => {
  gap.sendText(data.chat_id, `Data Received: ${JSON.stringify(data)}`);
});

// sendImage, sendFile, sendVideo
gap.sendImage("CHAT_ID", "Absolute Path to file");
```
