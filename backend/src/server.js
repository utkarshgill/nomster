const express = require("express");
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.json());
const cors = require("cors");
app.use(cors());

app.listen(3000, () => {
  console.log("Server running on port 3000");
});



app.get('/', (req, res) => {
  const catUrl = 'https://picsum.photos/200/300';
  const catJson = {
    image: catUrl
  };
  res.json(catJson);

});

const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: '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',
});
const openai = new OpenAIApi(configuration);

let lastResponse = null;







