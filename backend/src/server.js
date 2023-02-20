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

app.post('/generate', async (req, res) => {
  const prompt = req.body.prompt;
  const prevJSON = req.body.prevJSON;

  let inputPrompt = prompt;
  if (lastResponse != null) {
    // inputPrompt = prompt + '*/' + +  '\n\n /*Return a JSON in this format {"html": "<!DOCTYPE html>", "css": "",}*/';
    inputPrompt = prompt;
    const result = await openai.createEdit({
      input: JSON.stringify(lastResponse),
      instruction: inputPrompt,
      model:'text-davinci-edit-001',
      n:1
    });
    console.log('has a last response');
    const response = result.data.choices[0].text;
    
    res.json(JSON.parse(response));
    lastResponse = JSON.parse(response);
    
  } else {
    inputPrompt =  prompt +  '\n\n /* Return a JSON in this format {"html": "", "css": "",}*/';
    const result = await openai.createCompletion({
      max_tokens : 500,
      n:1,
      model: "text-davinci-003",
      prompt: inputPrompt
    });

    const response = result.data.choices[0].text;
    
  res.json(JSON.parse(response));
  lastResponse = JSON.parse(response);
  }


  console.log('response is: '+lastResponse.text);
 
});






